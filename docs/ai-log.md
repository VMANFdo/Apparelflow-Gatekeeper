# AI Usage Log — ApparelFlow ERP

This file tracks all AI tool usage and mistakes caught during development.
It will be converted to `AI_OPTIMIZATION_REPORT.md` on Day 4.

---

## 1. Tools & Prompting

- **Tool:** Antigravity IDE (Google DeepMind)
- **Strategy:** Full SKILLS.md provided as context before each task. Task prompts taken verbatim from TASKS.md.
- **What worked:** Providing the full schema spec upfront produced accurate Drizzle table definitions on the first attempt.

---

## 2. Flawed / Broken AI Code

_Add a row here each time you catch an AI mistake. Be specific: file name, what was wrong, how you fixed it._

| # | File | What AI did wrong | How it was fixed |
|---|---|---|---|
| 1 | `src/server/auth/session.ts` | Assumed the `@/*` tsconfig alias covered the repo-root `db/` folder and wrote `import { users } from '@/db/schema'` — resolution failed (`Cannot find module '@/db/schema'`) in `npm test`. | Added a dedicated `"@/db/*": ["./db/*"]` path in `tsconfig.json` and a matching `/^@\/db\//` alias in `vitest.config.ts`, so the whole team can import the schema by alias instead of fragile relative paths. |
| 2 | `tests/session.test.ts` | Passed `{ alg: 'HS384' }` as the second argument to jose's `SignJWT.sign()` — `SignOptions` has no `alg` field, so `tsc --noEmit` failed. | Set the algorithm in the protected header only (`.setProtectedHeader({ alg: 'HS384' })`) and let jose derive the signing algorithm from it. |
| 3 | `src/components/app-shell.tsx` | Defined `SidebarContent` as a function *inside* the `AppShell` component body and rendered it twice — every render created a new component type, remounting the sidebar and losing its state; failed ESLint `react-hooks/static-components`. | Extracted `SidebarContent` to a module-level component taking `role`, `pathname` and `onClose` as props, so React reuses the same component identity across renders. |
| 4 | `src/domain/auth.ts` | `loginSchema` was written without `.strict()`, deviating from SKILLS skill 9 — a body containing a tampered `role` field would be silently stripped (still safe, because the role is read from the DB, but the tampering attempt would return 200 instead of an explicit 400). | Added `.strict()` so unknown keys fail validation with 400 + `unrecognized_keys` details, plus `tests/login-schema.test.ts` covering the tampered-role case. |

---

## 3. Human Refactoring

_Changes you made to AI output to improve correctness, security, or clarity._

---

## 4. Defensive Architecture

_Intentional design decisions that defend against both bugs and AI mistakes._

- **Status transitions** enforced at DB level by `trg_valid_status_transition` — even a compromised server cannot write an illegal status.
- **`verification_logs` immutability** enforced by `trg_immutable_verification_logs` — audit trail cannot be altered.
- **Verified item freeze** enforced by `trg_freeze_verified_items` — counts cannot be changed after approval.
- **RLS with no policies** on all 6 tables — Supabase's public/anon API cannot read any data; only the server's direct connection works.
- **Partial unique index** `idx_one_approved_log_per_order` — database-level guarantee of one APPROVED log per order.
- **Approve endpoint** uses `SELECT ... FOR UPDATE` inside a transaction and re-reads counts from DB — prevents race conditions and body-injection attacks.
- **Server-side authority** — expected quantities, statuses, verifier IDs, and timestamps are always computed or sourced by the server, never trusted from the client.
- **RBAC inside every handler** — `requireUser()` / `requireRole()` run inside `handle()` before any business logic; hiding controls in the UI is cosmetic only, and middleware/proxy is never the security boundary.
- **Role is read from the DB, not the JWT** — `getCurrentUser()` re-loads the user row on every request, so a deactivated or demoted user loses access immediately even with a valid 8-hour token.
- **Origin check on mutations** — `assertSameOrigin()` runs before the handler for POST/PUT/PATCH/DELETE: a present `Origin` must match the request host (403 otherwise), while header-less cURL/Postman requests are allowed by design.
- **Login hardening** — one generic `Invalid email or password` for every failure, a dummy bcrypt compare when the email does not exist (no timing oracle), and a DB-persisted 5-failure / 15-minute lockout (no in-memory rate-limit state, which would not survive serverless cold starts).
- **Strict request schemas** — `loginSchema` uses Zod `.strict()`: unknown body fields (e.g. a tampered `role`) return 400 instead of being ignored, and authorization still reads the role from the DB row, never from the request or the JWT claim alone.
- **No per-IP rate limiting (accepted gap)** — the spec only requires the per-account lockout; per-IP counters would have to live in the DB on serverless (in-memory state dies with the instance), so brute force is mitigated by the account lockout plus the generic error and bcrypt's constant work factor.
- **Order creation computes everything server-side** — `expected_qty`, `expected_fabric_yds`, `order_no` (from `order_no_seq`) and `created_by` are derived inside one transaction from the DB recipe and the session actor; a forged `expected_qty` in the body is stripped by `createOrderSchema` (user-approved: TASKS T18 says "confirm it is ignored", SKILLS skill 6 allows "strip and ignore"; `loginSchema` stays `.strict()` per skill 9).
- **CSP tradeoff** — `script-src` keeps `'unsafe-inline'` because Next.js injects an inline bootstrap script; `frame-ancestors 'none'`, `nosniff` and strict Referrer-Policy still apply, and no third-party script origins are allow-listed.
