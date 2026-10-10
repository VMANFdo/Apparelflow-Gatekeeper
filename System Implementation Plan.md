# ApparelFlow ERP: Implementation Plan (4 Days, 8 Phases)

Production Batch Verification & Sewing Queue Gate, built for Vercel + Supabase.

Each day is about 7-8 hours, which fits the 28-32 hour budget. The days follow the milestones in the assessment document exactly.

---

## 1. Stack (all Vercel + Supabase compatible)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | UI and REST route handlers in one deploy. Route handlers give `/api/...` endpoints the evaluator can hit with cURL/Postman. |
| Database | Supabase Postgres, used as plain Postgres | The schema requires `password_hash`, so Supabase Auth is not used. |
| ORM | Drizzle + `postgres` (with `prepare: false`) | Works with Supabase's transaction pooler on serverless. |
| Auth | `bcryptjs` + `jose` JWT in an httpOnly cookie | Both are pure JS, so there are no native-module problems on Vercel. |
| Validation | Zod | Shared by client forms and server routes. |
| UI | Tailwind + shadcn/ui (Radix) + lucide-react | Accessible modals and dropdowns out of the box. |
| Tests | Vitest + PGlite (in-memory Postgres) | `npm test` passes with no env vars or DB setup, and never touches real data. |

**Design principle:** route handlers stay thin (parse, guard, call a service, map errors to HTTP). All business rules live in `src/server/services/*` and a shared pure `domain/` folder (state machine, traffic light, wastage). The tests target this layer.

### Why a modular monolith (not ESB / microservices / event-driven)

- **ESB** adds a central broker, adapters and message-translation layers. For a 3-role domain with six tables and no external integrations it is pure overhead: a single point of failure, an extra network hop and orchestration complexity with no real work to do.
- **Microservices / SOA** would break the domain's atomicity. Approving an order must write the audit log (+ variance snapshot + wastage %), freeze the counts and flip the status in one ACID transaction (`SELECT … FOR UPDATE` + DB triggers). Splitting this across services forces distributed-transaction choreography and duplicate rule sets.
- **Event-driven (Kafka etc.)** has no place here: the lifecycle has no asynchronous consumers — every step is a synchronous, human-initiated state change best enforced by a database trigger.
- **Modular monolith** keeps one deployable and one source of truth: the pure `domain/` rules compile into both client and server (the UI preview and the server hard stop can never drift), PGlite tests replay the real schema and triggers, and the cleanly bounded modules (`domain/`, `server/services/`, `db/migrations/`) can be extracted later if the product ever outgrows a single process.

---

## 2. Database design

Required tables: `users`, `recipes`, `recipe_components`, `cutting_orders`, `verification_items`, `verification_logs`.

Additions beyond the minimum:

- **`cutting_orders`**: add `expected_fabric_yds` (a snapshot of target qty × std yards taken at creation) and `sewing_started_at` / `sewing_started_by`.
- **`verification_items`**: rows are **created at order creation** with `actual_qty = NULL`. This is how "uncounted" is detected. Unique index on (`order_id`, `component_id`).
- **`verification_logs`**: add `approval_note`, `variance_snapshot` (JSONB) and `attempt_no`. One partial unique index allows a single APPROVED log per order.
- **`users`**: add `failed_attempts` and `locked_until` for login throttling.
- **Statuses**: `PENDING_VERIFICATION`, `REJECTED`, `VERIFIED`. The status stays `VERIFIED` after "Start Sewing" and `sewing_started_at` is recorded instead, so the queue query stays the literal `WHERE status = 'VERIFIED'`.

**Database-level safeguards (defense in depth):**

1. A trigger blocks UPDATE and DELETE on `verification_logs`.
2. A trigger freezes `verification_items` once the order is VERIFIED.
3. A trigger allows status changes only along valid transitions.
4. CHECK constraints: counts >= 0, and a rejection requires a note.
5. **RLS** is enabled on every table with no policies, so Supabase's public API cannot read anything. Only the server connection can.

---

## 3. Day 1: Architecture, database and repo

### Phase 1: Foundation and schema (about 4h)

- Create the public GitHub repo and scaffold Next.js. Add `.env.example`, a strict `.gitignore`, ESLint and Prettier. Use conventional commits from the first commit (`feat:`, `chore:`, `test:`).
- Start `AI_OPTIMIZATION_REPORT.md` now (repo root) and add to it whenever AI gets something wrong. It becomes the final AI report on Day 4.
- Create the Drizzle schema and first migration, with enums, CHECK constraints and indexes.
- Write a custom SQL migration for the triggers and RLS.

**Manual configuration (Supabase):**

1. Create the project in the region nearest you and save the DB password.
2. Copy two connection strings from the Connect panel:
   - **Transaction pooler (port 6543)** for `DATABASE_URL`
   - **Session pooler (port 5432)** for `DIRECT_URL` (migrations). The direct connection is IPv6-only, so use the session pooler if your network doesn't support IPv6.
3. Put both in `.env.local` and run `npm run db:migrate`.
4. In the dashboard, confirm RLS shows as enabled on all tables.

### Phase 2: Seed data and deployed skeleton (about 3.5h)

- Write `db/seed.ts` (idempotent): 3 demo users (bcrypt-hashed), Recipe A and B with all 10 components, plus the std yards and wastage caps from the PDF. Add the `db:seed` script.
- Build a skeleton page that reads recipes from the DB (proves connectivity) and a `/api/health` route.
- Add security headers in `next.config` (CSP, `frame-ancestors 'none'`, nosniff, Referrer-Policy).
- Set up design tokens (palette, spacing, forced light `color-scheme`).

**Manual configuration (Vercel):**

1. Import the repo.
2. Add env vars `DATABASE_URL` and `AUTH_SECRET` (generate with `openssl rand -base64 32`) for **Production and Preview**. Never prefix them with `NEXT_PUBLIC_`.
3. Set the function region to match Supabase (e.g. `sin1`).
4. Run migrate and seed **from your laptop** against Supabase.
5. Open the production URL in an incognito window to confirm it's public (check Deployment Protection settings if not).

**Done when:** the live URL shows seeded recipes from Supabase.

---

## 4. Day 2: Supervisor and order engine

### Phase 1: Authentication, RBAC and role switcher (about 4h)

- Implement `POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/auth/me`.
  - JWT with an 8-hour expiry carrying `sub` and `role`. Cookie flags: httpOnly, Secure, SameSite=Lax.
  - The user is re-loaded from the DB on every request, so a deactivated or changed user takes effect immediately.
  - Login uses a generic error message, a dummy-hash compare for unknown emails, and lockout after repeated failures.
- Build a `requireRole(...roles)` guard: 401 for no session, 403 for the wrong role.
- Add an Origin check on mutating requests. If an Origin header is present it must match, and if absent (cURL/Postman) the request is allowed.
- Build the login page with a **Demo Credentials panel** and one-click "Sign in as" buttons. They still go through real authentication. The header has a "Switch role" menu that signs out and returns to that panel.
- Build the app shell: sidebar and nav that differ per role, a role badge, and responsive behavior.
- Middleware is only for redirect convenience. The real enforcement is `requireRole` in every handler.

### Phase 2: Order creation and multiplier engine (about 3.5h)

- `GET /api/recipes` and `POST /api/orders` (supervisor only).
  - The body accepts only `recipe_id`, `target_qty`, `fabric_roll_id` and `actual_fabric_yds`.
  - The server computes expected pieces per component, `expected_fabric_yds` and the `order_no` (a Postgres sequence, e.g. `CO-2026-0001`). All of this happens in one transaction that also inserts the `verification_items` rows with NULL counts.
- Validation rules:
  - `target_qty` is an integer from 1 to 100,000.
  - Yards is positive with at most 2 decimals.
  - The roll ID is trimmed and matches a regex.
- Build the "Create Cutting Order" modal with a **live preview table** of expected pieces and fabric. Use `inputMode="numeric"`, block `e`, `-` and `.` in integer fields, and show inline errors.
- Build the supervisor order list with a **summary card strip**: four clickable cards (Total / Pending / Verified / Rejected) that show live counts and act as the table filter. Clicking the active card clears the filter.
- Add `POST /api/orders/:id/resubmit` for REJECTED orders, which resets counts and returns to PENDING_VERIFICATION.

**Done when:** a Verifier session gets 403 from `POST /api/orders`, and a created order persists across refresh.

---

## 5. Day 3: Verifier terminal and server hard stop

### Phase 1: Gatekeeper backend (about 4h)

- Pure functions in `domain/`:
  - `evaluateComponent(expected, actual)` returns GREEN, YELLOW or RED (NULL counts as uncounted).
  - The state transition map.
  - `computeWastage(expected, actual)`, using Fabric Wastage % = (Actual - Expected) / Expected x 100, rounded to 2 decimals.
- `PUT /api/verification/:orderId/counts` saves counts. The server recomputes every status itself and never accepts a status from the client.
- `POST /api/verification/:orderId/approve`:
  1. Open a transaction and `SELECT ... FOR UPDATE` on the order.
  2. Return **409** if the status is not PENDING_VERIFICATION.
  3. Re-read the counts from the DB (never from the body). If any is RED or NULL, return **422** listing the offending components.
  4. Otherwise write the log row (verifier ID and timestamp from the session, variance snapshot, wastage %) and set the status to VERIFIED, all atomically.
- `POST /api/verification/:orderId/reject` requires a note (Zod, min and max length) and returns 400 if it is missing.
- Add an error-to-HTTP mapper: 400 validation, 401, 403, 404, 409 invalid transition, 422 business rule.

### Phase 2: Verifier UI (about 3.5h)

- Verifier queue page (pending orders) and a terminal page per order. Each component row shows expected, an actual input and a traffic-light badge (colour + icon + text, never colour alone).
- Real-time validation: the client imports the same `evaluateComponent` for instant feedback. This is only UX, since the server remains the authority.
- The "Approve Batch" button is disabled while any component is RED or uncounted, with a message explaining why. Add a "Reject Batch" dialog with a required reason.
- Yellow rows show "+N surplus". Add success/error toasts and a loading state on submit.
- Add **verifier history** on the queue page, read from the immutable `verification_logs` audit trail: a *Verified* section (order, verifier, decision date, wastage %) and a *Rejected* section (attempt number and rejection reason).

**Done when:** a cURL approve on a shortage order returns 422 with the button bypassed.

---

## 6. Day 4: Sewing queue, tests and AI report

### Phase 1: Sewing handoff and wastage view (about 3.5h)

- `GET /api/sewing/queue` runs the DB query with `WHERE status = 'VERIFIED'` and takes **no** filter params.
- `GET /api/sewing/queue/:id` returns 404 for non-VERIFIED orders, so nothing leaks.
- `POST /api/sewing/:id/start` (sewing role) sets `sewing_started_at/by` and returns 409 if already started.
- Sewing UI: queue cards and a detail view showing piece counts, variance, verifier name and timestamp, wastage % (flag it if above the recipe's cap, but don't block), and the approval note. Add the "Start Sewing Assembly" button.
- Add the supervisor-side view of REJECTED orders with the reason note.

### Phase 2: Tests, contrast audit and documentation (about 4h)

- Vitest with PGlite, applying the same migrations (including triggers) as production:
  1. All-GREEN order can be approved by the verifier.
  2. An order with a RED component returns 422 and stays PENDING_VERIFICATION.
  3. Reject without a note fails validation.
  4. Supervisor and sewing roles get 403 on approve.
  5. Unapproved orders never appear in the sewing queue query.
  - Extras: NULL counts return 422, double approve returns 409, wastage maths, and the immutable log trigger.
- Contrast audit: click every input, select, dropdown option, autofill state and focus state. Run Lighthouse and axe, and aim for WCAG AA (4.5:1).
- Write the README (architecture summary, schema, API table, demo credentials for all 3 roles, test instructions).
- Finalise `AI_OPTIMIZATION_REPORT.md` with its four sections (Tools & Prompting, Flawed AI Code, Human Refactoring, Defensive Architecture) from your running log.
- Final pass: run `npm audit`, re-run the evaluator's 5-minute checklist on the **live URL**, then tag a release.
- Optional: a GitHub Actions workflow that runs `npm test` (needs no secrets).

---

## 7. API reference

| Method | Endpoint | Role | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | Generic errors, lockout |
| POST | `/api/auth/logout` | any | |
| GET | `/api/auth/me` | any | |
| GET | `/api/recipes` | supervisor, verifier | |
| GET | `/api/orders` | supervisor | Verifier sees pending only |
| POST | `/api/orders` | supervisor | Server computes expected values |
| POST | `/api/orders/:id/resubmit` | supervisor | REJECTED to PENDING_VERIFICATION |
| PUT | `/api/verification/:orderId/counts` | verifier | Server recomputes statuses |
| POST | `/api/verification/:orderId/approve` | verifier | 422 on RED or uncounted, 409 on bad state |
| POST | `/api/verification/:orderId/reject` | verifier | Note required (400 if missing) |
| GET | `/api/sewing/queue` | sewing | `WHERE status = 'VERIFIED'` |
| GET | `/api/sewing/queue/:id` | sewing | 404 if not VERIFIED |
| POST | `/api/sewing/:id/start` | sewing | 409 if already started |

**HTTP code convention:** 400 schema validation, 401 no session, 403 wrong role, 404 not found or not visible, 409 invalid state transition, 422 business-rule violation (hard stop).

## 8. Role permission matrix

| Endpoint group | Supervisor | Verifier | Sewing |
|---|---|---|---|
| Recipes (read) | Yes | Yes | No |
| Create / resubmit orders | Yes | No | No |
| Counts, approve, reject | No | Yes | No |
| Sewing queue and start | No | No | Yes (VERIFIED only) |

## 9. Security checklist

- [ ] Every handler calls `requireRole`; middleware is not the boundary
- [ ] Verifier ID and timestamps come from the session, never the request body
- [ ] Expected quantities and statuses are computed by the server only
- [ ] Approve re-reads counts from the DB inside a locked transaction
- [ ] Sewing queue query hard-codes `status = 'VERIFIED'`
- [ ] DB triggers protect logs, frozen items and valid transitions
- [ ] RLS enabled on all tables; no Supabase anon or service key in the client
- [ ] httpOnly + Secure + SameSite cookie; Origin check on mutations
- [ ] Zod validation on every input, with sane upper bounds
- [ ] Login lockout and generic error messages
- [ ] Security headers set; secrets never committed; `npm audit` clean
- [ ] Keep Next.js on a current patched version

## 10. UI and accessibility standards

- Force a light colour scheme. Inputs use explicit dark text on a light background, with explicit placeholder, disabled, focus and autofill styles.
- Style `<select>` and its options explicitly, since this is where white-on-white defects usually appear.
- WCAG AA contrast (4.5:1) everywhere, visible focus rings, and status shown by colour **and** icon **and** text.
- Responsive layout: sidebar collapses to a menu on mobile, tables collapse to cards.

## 11. Manual configuration summary

| Where | What | When |
|---|---|---|
| GitHub | Create public repo (and optionally the CI workflow) | Day 1 P1 |
| Supabase | Create project, choose region, save DB password | Day 1 P1 |
| Supabase | Copy the pooler (6543) and session (5432) connection strings | Day 1 P1 |
| Supabase | Verify RLS is enabled on all tables | Day 1 P1 |
| Vercel | Import repo, add `DATABASE_URL` and `AUTH_SECRET`, set function region | Day 1 P2 |
| Local terminal | `npm run db:migrate` and `db:seed` against Supabase | Day 1 P2, and after any schema change |
| Vercel | Check the production URL is public in incognito | Day 1 P2 and Day 4 |

## 12. Submission checklist

- [ ] Live deployed URL (public and tested)
- [ ] Public GitHub repo with atomic commit history
- [ ] `AI_OPTIMIZATION_REPORT.md` in the repo root (4 sections, at least 2 genuine AI flaws)
- [ ] `README.md` with architecture, schema and demo credentials for all 3 roles
- [ ] Passing `npm test`
- [ ] Evaluator's 5-minute audit passed on the live URL (contrast, RBAC, hard stop, sewing handoff, persistence)
