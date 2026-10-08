# ApparelFlow ERP: Task List (for vibe coding with AI)

## How to use this file

1. Work **top to bottom**. Do not skip ahead. Each task builds on the previous one.
2. Put `SKILLS.md` in your repo root (also copy it to `CLAUDE.md`, `AGENTS.md` or `.cursorrules`, depending on your AI tool) so the AI always follows the project rules.
3. For each task: paste the **Prompt** into your AI tool, then review the output against the **Verify** line.
4. **Do not accept AI output blindly.** If you catch a mistake, add a line to `docs/ai-log.md` (this becomes your `AI_OPTIMIZATION_REPORT.md`).
5. Work on the **branch shown under each task** (see "Branching workflow" below). Commit after every task using the suggested message, then tick the checkbox. When you finish the last task of a branch, open a PR and merge it before starting the next branch.

Legend: 🧑 = manual step you must do yourself (not the AI) | ✅ = verification | 📝 = log to `docs/ai-log.md` | 🌿 = git branch | 🔀 = open PR and merge

---

# Branching workflow (GitHub Flow)

`main` is protected and always deployable (it deploys to Vercel Production). All work happens on short-lived branches named `type/short-kebab-description`.

| Prefix | Use for |
|---|---|
| `feat/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Setup, config, tooling, deployment |
| `docs/` | README, reports |
| `test/` | Test suites |
| `refactor/` | Code changes with no behaviour change |
| `hotfix/` | Urgent fix to something already on `main` |

**Per-branch routine:**

```bash
git checkout main && git pull
git checkout -b feat/database-schema        # use the branch name shown on the task
# ...work, committing after each task with the suggested message...
git push -u origin feat/database-schema
# open a PR, review your own diff, merge, then:
git checkout main && git pull
git branch -d feat/database-schema
```

**Rules:**
1. Merge each branch **before** starting the next one. UI branches depend on API branches.
2. Use **"Create a merge commit"** on GitHub, **not** "Squash and merge". The assessment wants an atomic commit history.
3. PR description: what changed, task IDs covered, how you verified it (e.g. "curl approve on shortage order returns 422"), and any AI mistakes you caught.
4. Keep branches small (1-3 hours each).
5. Pushing a branch creates a Vercel **Preview** deployment, and Preview shares the same Supabase DB as Production. Keep migrations additive, and apply them from your laptop only when the branch is ready.
6. Protect `main` in GitHub (Settings, Branches): require a PR before merging, and require status checks once CI exists.

---

# DAY 1: Architecture, database and repo

## Phase 1: Foundation and schema (about 4h)

- [x] **T01: Scaffold the project**
  🌿 **Branch:** `chore/project-scaffold`
  ```text
  Follow SKILLS.md. Scaffold a Next.js (App Router) + TypeScript + Tailwind project in the current folder.
  Add: ESLint, Prettier, Vitest, Zod, drizzle-orm, drizzle-kit, postgres, bcryptjs, jose, lucide-react.
  Create the folder structure from SKILLS.md section 1 (empty folders with .gitkeep).
  Add scripts: dev, build, test, db:generate, db:migrate, db:seed.
  Create .env.example (DATABASE_URL, DIRECT_URL, AUTH_SECRET) and a strict .gitignore (never commit .env*).
  ```
  ✅ `npm run dev` starts. `.env.local` is git-ignored. | Commit: `chore: scaffold next.js project and tooling`
  🔀 **Last task on this branch:** push, open PR "`chore: scaffold project and tooling`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T02: 🧑 Create GitHub repo and Supabase project**
  🌿 **Branch:** none (manual setup on GitHub and Supabase). Do it after T01 is merged.
  1. Create a **public** GitHub repo, push the scaffold.
  2. Supabase: New project, choose the region nearest you, save the DB password.
  3. Supabase Connect panel: copy the **transaction pooler (6543)** string into `DATABASE_URL` and the **session pooler (5432)** string into `DIRECT_URL` in `.env.local`.
  4. Generate the secret: `openssl rand -base64 32` and put it in `AUTH_SECRET`.

  ✅ `.env.local` has all 3 values and is not tracked by git.

- [x] **T03: Drizzle schema**
  🌿 **Branch:** `feat/database-schema`
  ```text
  Follow SKILLS.md skill 2. Create db/schema.ts with these tables: users, recipes, recipe_components,
  cutting_orders, verification_items, verification_logs. Use the exact columns in SKILLS.md skill 2,
  including the extra columns (expected_fabric_yds, sewing_started_at/by, approval_note, variance_snapshot,
  attempt_no, failed_attempts, locked_until). Use UUID primary keys, pgEnums for role/status/decision,
  CHECK constraints, indexes, and a Postgres sequence for order_no. verification_items.actual_qty must be nullable.
  Create drizzle.config.ts using DIRECT_URL.
  ```
  ✅ `npm run db:generate` creates a migration without errors. | Commit: `feat(db): add relational schema`

- [x] **T04: Custom SQL migration (triggers and RLS)**
  🌿 **Branch:** `feat/database-schema`
  ```text
  Follow SKILLS.md skill 2. Create a custom Drizzle migration containing: (1) trigger blocking UPDATE/DELETE on
  verification_logs, (2) trigger blocking UPDATE on verification_items when the parent order status is VERIFIED,
  (3) trigger allowing cutting_orders.status changes only along: PENDING_VERIFICATION->VERIFIED,
  PENDING_VERIFICATION->REJECTED, REJECTED->PENDING_VERIFICATION, (4) ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  on every table, with no policies, (5) partial unique index allowing one APPROVED log per order.
  ```
  ✅ Read the SQL yourself. Triggers must raise exceptions, not silently ignore. | Commit: `feat(db): add immutability triggers and RLS`

- [x] **T05: Run the migration on Supabase**
  🌿 **Branch:** `feat/database-schema`
  🧑 Run `npm run db:migrate`. In the Supabase dashboard confirm all 6 tables exist and RLS shows as **enabled** on each.

  ✅ Tables visible, RLS on. | Commit: `chore(db): apply initial migration`
  🔀 **Last task on this branch:** push, open PR "`feat(db): add relational schema, triggers and RLS`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T06: Start the AI log**
  🌿 **Branch:** `docs/ai-usage-log`
  Create `docs/ai-log.md` with 4 headings: Tools & Prompting, Flawed AI Code, Human Refactoring, Defensive Architecture. Add one line per AI mistake you catch from now on. 📝

  | Commit: `docs: start ai usage log`
  🔀 **Last task on this branch:** push, open PR "`docs: start ai usage log`", self-review the diff, merge (merge commit, not squash), delete branch.

## Phase 2: Seed data and deployed skeleton (about 3.5h)

- [x] **T07: Seed script**
  🌿 **Branch:** `feat/seed-data`
  ```text
  Follow SKILLS.md skill 2. Write db/seed.ts (idempotent, safe to re-run). Seed 3 users with bcrypt-hashed passwords:
  cutting_supervisor, cutting_verifier, sewing_supervisor (emails and passwords from SKILLS.md section 16).
  Seed recipe REC-BL01 "Casual Blouse" (Blouse, 1.8 yds/piece, cap 5.0%) with components:
  Front Body Panel 1, Back Body Panel 1, Sleeves (Left & Right) 2, Collar & Stand 1, Sleeve Cuffs 2.
  Seed recipe REC-CT02 "Crop Top" (Crop Top, 1.1 yds/piece, cap 8.0%) with components:
  Front Chest Panel 1, Back Support Panel 1, Neck Binding Strip 1, Hem Elastic Casing 1, Side Strap Accents 2.
  ```
  ✅ `npm run db:seed` twice produces no duplicates. Password hashes are bcrypt, not plain text. | Commit: `feat(db): seed users and recipes`
  🔀 **Last task on this branch:** push, open PR "`feat(db): seed demo users and recipes`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T08: Skeleton page and health route**
  🌿 **Branch:** `feat/app-skeleton-security-headers`
  ```text
  Follow SKILLS.md skill 12. Create src/server/db/index.ts using postgres() with prepare:false and max:1.
  Create GET /api/health (runtime nodejs) that runs SELECT 1. Create a home page (server component) that lists recipes
  and component counts from the DB.
  ```
  ✅ Local page shows both recipes. | Commit: `feat: add db client, health route and skeleton page`

- [x] **T09: Security headers and design tokens**
  🌿 **Branch:** `feat/app-skeleton-security-headers`
  ```text
  Follow SKILLS.md skills 10 and 12. In next.config add security headers: Content-Security-Policy (self + needed inline for Next),
  X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, frame-ancestors 'none'.
  In globals.css define light-theme CSS variables and force color-scheme: light. Add base styles for input, select, option,
  textarea (explicit dark text on light background, visible focus ring, placeholder color with 4.5:1 contrast).
  ```
  ✅ Check response headers in the browser Network tab. | Commit: `feat(ui): add security headers and design tokens`
  🔀 **Last task on this branch:** push, open PR "`feat: add db client, health route, security headers and design tokens`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T10: 🧑 Deploy to Vercel**
  🌿 **Branch:** `chore/vercel-deployment`
  1. Vercel: Add New Project, import the repo.
  2. Environment Variables (Production **and** Preview): `DATABASE_URL`, `AUTH_SECRET`. Do **not** prefix with `NEXT_PUBLIC_`.
  3. Settings, Functions: set the region to match your Supabase region (e.g. `sin1`).
  4. Deploy.
  5. Open the URL in an **incognito window** to confirm it is public.

  ✅ Live URL shows seeded recipes from Supabase. | Commit: `chore: configure vercel deployment`
  🔀 **Last task on this branch:** push, open PR "`chore: configure vercel deployment`", self-review the diff, merge (merge commit, not squash), delete branch.


---

# DAY 2: Supervisor and order engine

## Phase 1: Authentication, RBAC and role switcher (about 4h)

- [x] **T11: Errors and HTTP mapper**
  🌿 **Branch:** `feat/auth-session-api`
  ```text
  Follow SKILLS.md skill 4. Create src/domain/errors.ts with AppError subclasses: ValidationError(400), UnauthorizedError(401),
  ForbiddenError(403), NotFoundError(404), ConflictError(409), BusinessRuleError(422, with details array).
  Create src/server/http/handler.ts: a wrapper handle(fn) that catches errors and returns JSON {error:{code,message,details}}
  with the right status. Unknown errors return 500 with a generic message and never leak stack traces.
  ```
  ✅ Unit test the mapper quickly. | Commit: `feat(api): add typed errors and response mapper`

- [x] **T12: Session utilities**
  🌿 **Branch:** `feat/auth-session-api`
  ```text
  Follow SKILLS.md skill 3. Create src/server/auth/session.ts: signSession({sub, role}) and verifySession(token) using jose HS256
  with AUTH_SECRET and 8h expiry; setSessionCookie/clearSessionCookie with httpOnly, Secure (except localhost), SameSite=Lax, Path=/.
  Create getCurrentUser(): reads cookie, verifies JWT, then loads the user from the DB and checks they exist and are active.
  Role comes from the DB row, never trusted from the token alone.
  ```
  ✅ Commit: `feat(auth): add jwt session utilities`

- [x] **T13: Auth routes**
  🌿 **Branch:** `feat/auth-session-api`
  ```text
  Follow SKILLS.md skill 3. Implement POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
  Login: Zod-validate body; look up user by lowercased email; if user not found still run bcrypt.compare against a dummy hash;
  return the same generic 'Invalid email or password' for all failures; increment failed_attempts and set locked_until
  (15 min) after 5 failures; reset on success. Never return password_hash.
  ```
  ✅ Test wrong password 6 times via curl and confirm lockout. 📝 AI often leaks whether the email exists. | Commit: `feat(auth): add login, logout and me endpoints`

- [x] **T14: RBAC guard and Origin check**
  🌿 **Branch:** `feat/auth-session-api`
  ```text
  Follow SKILLS.md skill 4. Create requireUser() (401 if no valid session) and requireRole(...roles) (403 if wrong role)
  in src/server/auth/guard.ts. Create assertSameOrigin(request) for POST/PUT/PATCH/DELETE: if an Origin header exists it must
  match the request host, otherwise 403; if absent, allow (cURL/Postman). Compose these into the handle() wrapper.
  ```
  ✅ Commit: `feat(auth): add requireRole guard and origin check`
  🔀 **Last task on this branch:** push, open PR "`feat(auth): add session auth, RBAC guard and typed errors`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T15: Login page with demo credentials panel**
  🌿 **Branch:** `feat/login-page-app`
  ```text
  Follow SKILLS.md skills 9 and 10. Build /login: a clean centered card with email and password inputs (inline errors),
  and a 'Demo accounts' panel listing the 3 roles with a 'Sign in as' button each. Buttons call the real /api/auth/login.
  After login, redirect by role: supervisor -> /supervisor/orders, verifier -> /verifier, sewing -> /sewing.
  ```
  ✅ All three one-click logins work. Inputs readable. | Commit: `feat(ui): add login page with demo credential panel`

- [x] **T16: App shell and role switcher**
  🌿 **Branch:** `feat/login-page-app`
  ```text
  Follow SKILLS.md skill 10. Create an authenticated layout: left sidebar with nav items shown per role, top bar with user full name,
  role badge and a 'Switch role' menu (signs out, returns to /login). On mobile the sidebar collapses into a menu.
  Server-side layout check: redirect to /login if there is no session, and redirect to the user's own home if they open another role's page.
  ```
  ✅ Verifier does not see 'Create order'. | Commit: `feat(ui): add role-aware app shell and role switcher`
  🔀 **Last task on this branch:** push, open PR "`feat(ui): add login page, demo credentials and role-aware shell`", self-review the diff, merge (merge commit, not squash), delete branch.

## Phase 2: Order creation and multiplier engine (about 3.5h)

- [x] **T17: Domain multiplier and schemas**
  🌿 **Branch:** `feat/order-creation-api`
  ```text
  Follow SKILLS.md skills 5 and 9. Create src/domain/orders.ts: computeExpectedPieces(components, targetQty) and
  computeExpectedFabric(stdYards, targetQty). Create Zod schema createOrderSchema: recipe_id uuid, target_qty int 1..100000,
  fabric_roll_id string trimmed 3..40 matching /^[A-Za-z0-9-]+$/, actual_fabric_yds number > 0, max 2 decimals, max 1000000.
  Add unit tests: 50 blouses -> 100 cuffs; fabric 50 x 1.8 = 90.
  ```
  ✅ `npm test` passes. | Commit: `feat(domain): add multiplier engine and order schema`

- [x] **T18: Orders service and endpoints**
  🌿 **Branch:** `feat/order-creation-api`
  ```text
  Follow SKILLS.md skills 4 and 6. Create src/server/services/orders.ts createOrder(db, actor, input): in ONE transaction insert
  the order (status PENDING_VERIFICATION, created_by = actor.id, order_no from the sequence, expected_fabric_yds computed on the server)
  and one verification_items row per component with expected_qty computed on the server and actual_qty NULL.
  Routes: POST /api/orders (supervisor only), GET /api/orders (supervisor sees all; verifier sees only PENDING_VERIFICATION),
  GET /api/recipes (supervisor, verifier). Ignore any extra fields in the body.
  ```
  ✅ curl as verifier returns 403. Try sending `expected_qty` in the body and confirm it is ignored. | Commit: `feat(api): add order creation with server-side multiplier`
  🔀 **Last task on this branch:** push, open PR "`feat(api): add order creation with server-side multiplier`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T19: Create-order modal with live preview**
  🌿 **Branch:** `feat/supervisor-orders-ui`
  ```text
  Follow SKILLS.md skills 9 and 10. Build a 'Create cutting order' modal (shadcn Dialog): recipe select, target quantity,
  fabric roll ID, fabric used (yards). Show a live preview table of expected pieces per component and expected fabric as the user types.
  Block e, +, -, . keys in the integer field. Show inline errors under each field. Disable submit while invalid or submitting.
  On success close the modal, show a toast and refresh the list.
  ```
  ✅ Try -5, 2.5, empty, abc: all rejected with inline errors. | Commit: `feat(ui): add create order modal with live preview`

- [x] **T20: Supervisor order list and resubmit**
  🌿 **Branch:** `feat/supervisor-orders-ui`
  ```text
  Follow SKILLS.md skills 6 and 10. Build /supervisor/orders: table (cards on mobile) with order_no, recipe, qty, roll ID, status badge,
  created date. Rejected orders show the rejection reason and a 'Resubmit' button.
  Implement POST /api/orders/:id/resubmit (supervisor only, only from REJECTED): resets all actual_qty to NULL and sets status
  to PENDING_VERIFICATION, in one transaction. Return 409 for any other status.
  ```
  ✅ Refresh the page and orders persist. | Commit: `feat: add supervisor order list and resubmit flow`
  🔀 **Last task on this branch:** push, open PR "`feat(ui): add create-order modal, order list and resubmit flow`", self-review the diff, merge (merge commit, not squash), delete branch.

---

# DAY 3: Verifier terminal and server hard stop

## Phase 1: Gatekeeper backend (about 4h)

- [x] **T21: Domain rules (traffic light, transitions, wastage)**
  🌿 **Branch:** `feat/verification-domain-rules`
  ```text
  Follow SKILLS.md skill 5. Create src/domain/verification.ts: evaluateComponent(expected, actual|null) returning
  'GREEN' | 'YELLOW' | 'RED' | 'UNCOUNTED'; canApprove(items) true only if every item is GREEN or YELLOW (no RED, no UNCOUNTED);
  src/domain/stateMachine.ts: allowed transitions map and assertTransition(from, to) throwing ConflictError;
  src/domain/wastage.ts: computeWastagePct(expected, actual) = ((actual-expected)/expected)*100 rounded to 2 decimals.
  Write unit tests for all branches, including null, 0 and equal values.
  ```
  ✅ Commit: `feat(domain): add traffic light, state machine and wastage logic`
  🔀 **Last task on this branch:** push, open PR "`feat(domain): add traffic light, state machine and wastage rules`", self-review the diff, merge (merge commit, not squash), delete branch.

- [x] **T22: Save counts endpoint**
  🌿 **Branch:** `feat/verification-gatekeeper-api`
  ```text
  Follow SKILLS.md skill 7. PUT /api/verification/:orderId/counts (verifier only): body {counts:[{component_id, actual_qty}]}.
  Zod: actual_qty integer >= 0 and <= 1000000. Only works while the order is PENDING_VERIFICATION (else 409).
  Server recomputes each item's status. Never accept a status from the client. Reject component_ids that do not belong to the order.
  ```
  ✅ Send `status: 'GREEN'` in the body and confirm it is ignored. | Commit: `feat(api): add verifier count saving`

- [x] **T23: Approve endpoint (the hard stop)**
  🌿 **Branch:** `feat/verification-gatekeeper-api`
  ```text
  Follow SKILLS.md skill 7 exactly. POST /api/verification/:orderId/approve (verifier only), optional approval_note.
  In ONE transaction: SELECT the order FOR UPDATE; 409 if status != PENDING_VERIFICATION; re-read items from the DB (ignore any
  counts in the request body); if canApprove is false return 422 with the list of RED/UNCOUNTED components; otherwise insert the
  verification_logs row (verifier_id and timestamp from the session/server, variance_snapshot JSONB, wastage_pct computed on the server)
  and set status VERIFIED.
  ```
  ✅ curl approve on a shortage order returns **422**. curl as supervisor returns **403**. Double approve returns **409**. 📝 | Commit: `feat(api): add server-enforced approve hard stop`

- [x] **T24: Reject endpoint**
  🌿 **Branch:** `feat/verification-gatekeeper-api`
  ```text
  Follow SKILLS.md skill 7. POST /api/verification/:orderId/reject (verifier only): Zod requires note trimmed, 5..500 chars
  (400 if missing/blank). In one transaction: lock order, 409 if not PENDING_VERIFICATION, insert a REJECTED log row with the note,
  the variance snapshot and wastage_pct, set status REJECTED.
  ```
  ✅ Empty note returns 400. | Commit: `feat(api): add reject endpoint with mandatory reason`
  🔀 **Last task on this branch:** push, open PR "`feat(api): add server-enforced verification gatekeeper`", self-review the diff, merge (merge commit, not squash), delete branch.

## Phase 2: Verifier UI (about 3.5h)

- [x] **T25: Verifier queue page**
  🌿 **Branch:** `feat/verifier-terminal-ui`
  ```text
  Follow SKILLS.md skill 10. Build /verifier: list of PENDING_VERIFICATION orders (order_no, recipe, qty, submitted by, date)
  with an 'Open terminal' button, and an empty state. Add a count badge in the nav.
  ```
  ✅ Commit: `feat(ui): add verifier queue`

- [x] **T26: Verification terminal with traffic lights**
  🌿 **Branch:** `feat/verifier-terminal-ui`
  ```text
  Follow SKILLS.md skills 5, 9, 10. Build /verifier/[orderId]: a table with one row per component showing name, expected, an actual
  count input and a status badge (colour + icon + text). Import evaluateComponent from src/domain for real-time feedback.
  Integer-only inputs, inline errors. Save counts via PUT /api/verification/:orderId/counts (debounced or on a 'Save counts' button).
  Show a summary strip: number of GREEN, YELLOW, RED and uncounted rows.
  ```
  ✅ Typing a lower value turns the row red instantly. | Commit: `feat(ui): add verification terminal with traffic lights`

- [x] **T27: Approve and reject actions**
  🌿 **Branch:** `feat/verifier-terminal-ui`
  ```text
  Follow SKILLS.md skills 7 and 10. Add 'Approve Batch' (disabled with an explanatory tooltip/message whenever any row is RED or uncounted)
  and 'Reject Batch' which opens a dialog with a required reason textarea (inline error if empty). Show the server's 422 message
  if approval is rejected. On success show a toast and go back to the queue. Yellow rows show '+N surplus'.
  ```
  ✅ Open dev tools, force-enable the button, click it: the server must still return 422 and the UI must show the error. | Commit: `feat(ui): add approve and reject actions`
  🔀 **Last task on this branch:** push, open PR "`feat(ui): add verifier queue and terminal with traffic lights`", self-review the diff, merge (merge commit, not squash), delete branch.

---

# DAY 4: Sewing queue, tests and AI report

## Phase 1: Sewing handoff and wastage view (about 3.5h)

- [ ] **T28: Sewing endpoints**
  🌿 **Branch:** `feat/sewing-queue-api`
  ```text
  Follow SKILLS.md skill 8. GET /api/sewing/queue (sewing_supervisor only): query hard-coded with WHERE status = 'VERIFIED',
  taking NO filter or status params from the URL. GET /api/sewing/queue/:id: 404 if the order is not VERIFIED.
  POST /api/sewing/:id/start: lock the order, require VERIFIED and sewing_started_at IS NULL (else 409), set sewing_started_at and
  sewing_started_by from the session.
  Include verifier name, verified timestamp, item variances and wastage_pct in the detail response.
  ```
  ✅ Try `?status=PENDING_VERIFICATION` and confirm it is ignored. | Commit: `feat(api): add sewing queue with isolated query`
  🔀 **Last task on this branch:** push, open PR "`feat(api): add isolated sewing queue endpoints`", self-review the diff, merge (merge commit, not squash), delete branch.

- [ ] **T29: Sewing UI**
  🌿 **Branch:** `feat/sewing-queue-ui`
  ```text
  Follow SKILLS.md skill 10. Build /sewing (queue cards) and /sewing/[orderId] (detail): piece counts with variance, verifier name and
  timestamp, approval note, fabric wastage % with a warning badge if it exceeds the recipe's wastage cap (do NOT block),
  and a 'Start Sewing Assembly' button that changes to a 'Started' state afterwards.
  ```
  ✅ Approve a green order as the verifier, then see it appear for sewing. Refresh and it persists. | Commit: `feat(ui): add sewing queue and detail view`
  🔀 **Last task on this branch:** push, open PR "`feat(ui): add sewing queue and detail view`", self-review the diff, merge (merge commit, not squash), delete branch.

## Phase 2: Tests, contrast audit and documentation (about 4h)

- [ ] **T30: Test harness and the 5 required tests**
  🌿 **Branch:** `test/core-test-suite`
  ```text
  Follow SKILLS.md skill 11. Set up Vitest with PGlite: tests/helpers/testDb.ts creates an in-memory DB and applies ALL migrations
  (including triggers), plus helpers to seed users, a recipe and an order. Services take db as a parameter. Write exactly these tests:
  1) all-GREEN order approved by verifier; 2) order with a RED component returns 422 and stays PENDING_VERIFICATION;
  3) reject without a note fails validation (400); 4) supervisor and sewing roles get 403 on approve;
  5) unapproved orders never appear in the sewing queue query.
  ```
  ✅ `npm test` is green with no env vars set. | Commit: `test: add core domain and security tests`

- [ ] **T31: Extra edge-case tests**
  🌿 **Branch:** `test/core-test-suite`
  ```text
  Add tests: uncounted (NULL) items block approval with 422; approving twice returns 409; yellow (excess) order can be approved;
  wastage % calculation; direct UPDATE on verification_logs fails (trigger); invalid state transition is rejected by the DB trigger;
  negative/decimal/empty inputs are rejected by the Zod schemas.
  ```
  ✅ Commit: `test: add edge-case and trigger tests`
  🔀 **Last task on this branch:** push, open PR "`test: add core and edge-case test suite`", self-review the diff, merge (merge commit, not squash), delete branch.

- [ ] **T32: Contrast and usability audit**
  🌿 **Branch:** `fix/ui-contrast-audit`
  Manually click **every** input, select, dropdown option, textarea, disabled state, focus state and browser-autofilled field in light mode. Run Lighthouse Accessibility and axe DevTools. Test at 375px width. Fix every issue. 📝

  ✅ No white-on-white anywhere. Text/background contrast >= 4.5:1. | Commit: `fix(ui): resolve contrast and responsive issues`
  🔀 **Last task on this branch:** push, open PR "`fix(ui): resolve contrast and responsive issues`", self-review the diff, merge (merge commit, not squash), delete branch.

- [ ] **T33: README**
  🌿 **Branch:** `docs/readme-and-ai-report`
  ```text
  Write README.md: project overview, architecture summary (modular monolith diagram in text), tech stack, schema documentation
  (tables and key columns), state machine, API table with role and status codes, security measures, setup instructions
  (env vars, migrate, seed, test, run), and a Demo Credentials table for all 3 roles. Include the live URL.
  ```
  ✅ A stranger could run the project from the README. | Commit: `docs: add readme`

- [ ] **T34: AI optimization report**
  🌿 **Branch:** `docs/readme-and-ai-report`
  Convert `docs/ai-log.md` into `AI_OPTIMIZATION_REPORT.md` in the repo root, with exactly these 4 sections: **1. Tools & Prompting**, **2. Flawed / Broken AI Code** (at least 2 real, specific examples), **3. Human Refactoring**, **4. Defensive Architecture** (state machine, guards, triggers, transactions). Be honest and specific, with file names and what you changed.

  | Commit: `docs: add ai optimization report`
  🔀 **Last task on this branch:** push, open PR "`docs: add readme and ai optimization report`", self-review the diff, merge (merge commit, not squash), delete branch.

- [ ] **T35: 🧑 Final audit on the LIVE URL**
  🌿 **Branch:** `main` (no feature branch). Tag the release on `main`.
  Run the evaluator checklist in an incognito window:
  - [ ] Click every input and dropdown: dark readable text
  - [ ] Verifier cannot see "Create order"; sewing sees no unverified batches
  - [ ] Shortage count: Approve disabled **and** curl returns 422
  - [ ] Approve a green batch: appears in the sewing queue; refresh keeps it
  - [ ] `npm test` passes; commit history is clean; no secrets in the repo
  - [ ] `npm audit` has no high/critical issues
  - [ ] Submit: live URL, GitHub link, README, AI report

  | Commit/tag: `chore: final release v1.0.0`

---

## Progress tracker

| Day | Phase 1 | Phase 2 |
|---|---|---|
| Day 1 | T01 to T06 | T07 to T10 |
| Day 2 | T11 to T16 | T17 to T20 |
| Day 3 | T21 to T24 | T25 to T27 |
| Day 4 | T28 to T29 | T30 to T35 |

## Branch overview

| # | Branch | Tasks |
|---|---|---|
| 1 | `chore/project-scaffold` | T01 |
| 2 | `feat/database-schema` | T03, T04, T05 |
| 2b | `docs/ai-usage-log` | T06 |
| 3 | `feat/seed-data` | T07 |
| 4 | `feat/app-skeleton-security-headers` | T08, T09 |
| 5 | `chore/vercel-deployment` | T10 |
| 6 | `feat/auth-session-api` | T11, T12, T13, T14 |
| 7 | `feat/login-page-app` | T15, T16 |
| 8 | `feat/order-creation-api` | T17, T18 |
| 9 | `feat/supervisor-orders-ui` | T19, T20 |
| 10 | `feat/verification-domain-rules` | T21 |
| 11 | `feat/verification-gatekeeper-api` | T22, T23, T24 |
| 12 | `feat/verifier-terminal-ui` | T25, T26, T27 |
| 13 | `feat/sewing-queue-api` | T28 |
| 14 | `feat/sewing-queue-ui` | T29 |
| 15 | `test/core-test-suite` | T30, T31 |
| 16 | `fix/ui-contrast-audit` | T32 |
| 17 | `docs/readme-and-ai-report` | T33, T34 |
| - | `main` (tag `v1.0.0`) | T35 |
| opt | `chore/ci-github-actions` | Optional CI running lint, test and build |

T02 (creating the GitHub repo and Supabase project) needs no branch.
