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
