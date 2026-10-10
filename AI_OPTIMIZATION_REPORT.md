# AI Optimization Report — ApparelFlow ERP

Live record of how the AI assistant was used, where it failed, what I had to refactor, and the defensive architecture that keeps both safe. Kept beside the code so every future session can learn from the same traps.

---

## 1. Tools & Prompting

The build used three kinds of AI: planning assistants for scoping, a no-code builder for the prototype, and coding assistants for the implementation itself.

### Planning — Claude.ai

- Used to simplify the original spec into a buildable scope (requirements analysis of the assessment PDF), produce the 4-day implementation plan (`System Implementation Plan.md`) and author the reusable skill set (`SKILLS.md`, mirrored as `CLAUDE.md` and `AGENTS.md`). I reviewed and changed the AI-generated plan myself — for example, I rejected order delete/edit on audit-trail grounds and kept different sort orders per role.

### Prototyping — Lovable

- Used to stand up a basic interactive prototype of the system, validating the screens and flow before any real code was written.
- Prototype: [apparelflowerp.lovable.app](https://apparelflowerp.lovable.app)

### AI coding tools — Antigravity, GitHub Copilot, opencode

- **Antigravity IDE (Google DeepMind)** — primary coding assistant; full `SKILLS.md` provided as context and task prompts fed verbatim from `TASKS.md`.
- **GitHub Copilot** — in-editor completions and quick suggestions during hands-on coding.
- **opencode** — terminal-based multi-agent CLI that drove the branch-by-branch implementation (plan, code, test, commit) from the same `TASKS.md` prompts, including this report.
- All three share the conventions: commit messages match the repo style, every change is verified before it lands, and anything caught is logged here.

### Prompting workflow (shared)

- **Prompt discipline:** plan first (confirm before touching code), then implement, then verify (`npm test`, `npx tsc --noEmit`, `npm run lint`) before committing. Docs changes get the same treatment.
- **What worked:**
  - Providing the full schema spec upfront produced accurate Drizzle table definitions on the first attempt.
  - Keeping the domain rules pure (`src/domain/*`, `src/server/services/*`) lets the same code compile into both client and server — the UI preview and the server hard stop can never drift.
  - PGlite-based integration tests replay the real schema and DB triggers (`tests/helpers/testDb.ts`), so trigger-level guarantees are tested without a live Postgres.

### Example prompts

- **T23 approve endpoint** — from `TASKS.md`: "Follow SKILLS.md skill 7 exactly. POST /api/verification/:orderId/approve (verifier only), optional approval_note."
- **Verification gatekeeper rule** — from `SKILLS.md` §7: "Compute each item's status on the server. Never accept a status or expected value from the client."

---

## 2. Flawed / Broken AI Code

#### Flawed AI code #1: wrong relative import path breaks the production build

**Where:** `src/app/page.tsx` (task T08, branch `feat/app-skeleton-security-headers`)

**What the AI generated:**

```tsx
import { recipes, recipeComponents } from '../../../db/schema'
```

**What went wrong:** The file lives at `src/app/page.tsx`, so `../../../` climbs one level above the repository root and points to a folder that doesn't exist. The AI miscounted the directory depth while mixing an alias import (`@/server/db`) with a relative one in the same file. The import was not validated by a production build before it was pushed.

**How it was caught:** The first Vercel deployment failed with `Module not found: Can't resolve '../../../db/schema'`. The dev server alone didn't expose it.

**Fix:** I corrected the import to use the tsconfig alias `@/db/*` (`"@/db/*": ["./db/*"]`), so imports no longer depend on counting `../` segments. I also added `export const dynamic = 'force-dynamic'` to the page so it isn't prerendered at build time against the database.

#### Flawed AI code #2: inconsistent and non-deterministic queue ordering

**Where:** `src/server/services/orders.ts`, `verification.ts` and `sewing.ts` (supervisor list, verifier queue, sewing queue)

**What the AI generated:** Three queue queries sorted only by `createdAt`, with no tiebreaker. The sewing queue also displayed the *verified* date but sorted by the order’s *created* date.

**What went wrong:**

- **Mismatch in the sewing queue.** A batch verified just now could appear below older-created batches, so the queue didn’t reflect how long each batch had actually been waiting for sewing.
- **Non-deterministic order.** Sorting by one timestamp column alone means rows with identical timestamps can swap places between requests.

**How it was caught:** I asked an AI reviewer (Copilot) to compare the three dashboard queries. It traced the ordering through the services and UI components, and confirmed the UI does no re-sorting of its own.

**Human decision:** After Copilot reported the differences, I first considered sorting all three views by order ID ascending for consistency, but rejected it because the roles use their lists differently (supervisor newest first; verifier and sewing oldest first, FIFO). Sorting by the random UUID `id` would not be chronological, so `orderNo` is used only as a tiebreaker.

**Fix:**

- Added `orderNo` (sequence-based, unique) as a tiebreaker to all three queries.
- Changed the sewing queue to sort by the APPROVED verification log’s `created_at` (time verified), keeping the hard-coded `WHERE status = 'VERIFIED'`.
- Added “Newest first” / “Oldest first” labels in the UI so the difference reads as intentional.

---

## 3. Human Refactoring

- **Home page added** — the initial plan had no home page, so I added a brand hero with background image, overlay and copy tone specified by me rather than invented by the AI.
- **Supervisor summary cards** — a clickable card strip (Total / Pending / Verified / Rejected) with live counts that doubles as the table filter.
- **Verifier history tables** — Verified (order, verifier, wastage %) and Rejected (attempt, reason) history sections on the verifier queue, read from the immutable `verification_logs` audit trail.
- **Contrast & accessibility pass (T32)** — the AI UI failed WCAG: low-contrast `border-slate-300` inputs, too-light disabled states, and duplicated/unlabelled count inputs. My audit (Lighthouse + axe + 375 px) drove the fixes: `border-slate-500`, dark disabled styles, `blue-700` badge, labelled `-desktop` count inputs, `overflow-x-auto` tables. Shipped as `38f1dc2`.
- **Docs scope (T33)** — the AI's outline was a bare walkthrough; I added the modular-monolith-vs-ESB rationale and `system-architecture.png` to the README and plan.

---

## 4. Defensive Architecture

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
- **Order creation computes everything server-side** — `expected_qty`, `expected_fabric_yds`, `order_no` (from `order_no_seq`) and `created_by` are derived inside one transaction from the DB recipe and the session actor; a forged `expected_qty` in the body is stripped by `createOrderSchema` (I approved this: TASKS T18 says "confirm it is ignored", SKILLS skill 6 allows "strip and ignore"; `loginSchema` stays `.strict()` per skill 9).
- **Error handler sanitizes exports** — unexpected errors map to one generic 500 that never leaks stack traces or SQL internals to the client (`src/server/http/handler.ts`).
- **CSP tradeoff** — `script-src` keeps `'unsafe-inline'` because Next.js injects an inline bootstrap script; `frame-ancestors 'none'`, `nosniff` and strict Referrer-Policy still apply, and no third-party script origins are allow-listed.