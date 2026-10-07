# SKILLS.md: ApparelFlow AI Skill Set and Project Rules

> Drop this file in the repo root. Also copy it to the filename your AI tool reads:
> `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex and others), `.cursorrules` (Cursor), `.github/copilot-instructions.md` (Copilot).
>
> **Instruction to the AI:** Read this entire file before writing any code. These rules override your defaults.
> If a request conflicts with a rule here, stop and tell the user instead of silently breaking the rule.

---

## 0. Project context (always true)

**Product:** ApparelFlow ERP, Cutting Operations and Gatekeeper Verification Terminal for a garment factory.
**Flow:** Cutting Supervisor creates an order from a recipe, the Cutting Verifier counts physical pieces per component and approves or rejects, and the Sewing Supervisor sees only verified batches and starts assembly.

**Roles:** `cutting_supervisor`, `cutting_verifier`, `sewing_supervisor`.

**Core business rule (non-negotiable):** an order can become `VERIFIED` only if **every** component is counted and none is RED (shortage). This must be enforced **on the server and database**, never only in the UI.

**Traffic light:** GREEN = actual == expected. YELLOW = actual > expected (allowed). RED = actual < expected (blocks approval). NULL = uncounted (also blocks approval).

**Wastage:** `Fabric Wastage % = ((actualFabric - expectedFabric) / expectedFabric) * 100`, where `expectedFabric = targetQty x recipe.stdFabricYards`. Round to 2 decimals. Compare to `recipe.wastageCap` for a warning only, never block.

**Stack:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Drizzle ORM + `postgres`, Supabase Postgres (plain Postgres only, **no Supabase Auth, no supabase-js**), `bcryptjs`, `jose`, Zod, Vitest + PGlite. Deployed on **Vercel + Supabase**.

---

## 1. Skill: Project structure and conventions

```text
src/
  app/
    (auth)/login/
    (app)/supervisor/orders/
    (app)/verifier/ and (app)/verifier/[orderId]/
    (app)/sewing/ and (app)/sewing/[orderId]/
    api/auth/{login,logout,me}/route.ts
    api/recipes/route.ts
    api/orders/route.ts, api/orders/[id]/resubmit/route.ts
    api/verification/[orderId]/{counts,approve,reject}/route.ts
    api/sewing/queue/route.ts, api/sewing/queue/[id]/route.ts, api/sewing/[id]/start/route.ts
    api/health/route.ts
  components/        (UI only, no business rules)
  domain/            (PURE functions, no DB, no HTTP: errors, stateMachine, verification, wastage, orders)
  server/
    db/index.ts      (db client)
    auth/            (session.ts, guard.ts)
    services/        (orders.ts, verification.ts, sewing.ts; take `db` and `actor` as parameters)
    http/handler.ts  (error-to-response wrapper)
db/                  (schema.ts, migrations/, seed.ts)
tests/               (helpers/testDb.ts and *.test.ts)
docs/ai-log.md
```

**Rules:**
- Route handlers are **thin**: parse, guard, call a service, return. No business logic in routes or components.
- Business logic lives in `src/domain` (pure) and `src/server/services` (DB). Services receive `db` and `actor` as arguments so tests can inject PGlite.
- TypeScript strict mode. No `any`. No unused code.
- Every API route file declares `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.

---

## 2. Skill: Database and migrations (Drizzle + Supabase)

**Tables and columns (minimum + required extras):**
- `users`: id (uuid), email (unique, lowercase), password_hash, role (enum), full_name, is_active (bool), failed_attempts (int), locked_until (timestamptz null), created_at
- `recipes`: id, recipe_code (unique), name, category, std_fabric_yards (numeric 8,2), wastage_cap (numeric 5,2)
- `recipe_components`: id, recipe_id (fk), component_name, pieces_per_garment (int > 0), image_url (nullable)
- `cutting_orders`: id, order_no (unique, from a sequence, e.g. `CO-2026-0001`), recipe_id (fk), target_qty (int > 0), fabric_roll_id, actual_fabric_yds (numeric 10,2 > 0), expected_fabric_yds (numeric 10,2), status (enum: PENDING_VERIFICATION | REJECTED | VERIFIED), created_by (fk users), sewing_started_at (nullable), sewing_started_by (nullable fk), created_at, updated_at
- `verification_items`: id, order_id (fk), component_id (fk), expected_qty (int), actual_qty (int **nullable**, >= 0), status (nullable enum GREEN|YELLOW|RED), unique(order_id, component_id)
- `verification_logs`: id, order_id (fk), verifier_id (fk), decision (APPROVED|REJECTED), rejection_note (nullable), approval_note (nullable), wastage_pct (numeric 7,2), variance_snapshot (jsonb), attempt_no (int), created_at (timestamptz default now())

**Rules:**
- UUID primary keys. Use `numeric` for fabric yards (never float).
- CHECK constraints: quantities >= 0 / > 0 as above; `decision = 'REJECTED'` requires a non-empty `rejection_note`.
- Index `cutting_orders(status)`, `verification_items(order_id)`.
- **Custom SQL migration** must add: (1) trigger blocking UPDATE/DELETE on `verification_logs`; (2) trigger blocking UPDATE on `verification_items` when the parent order is VERIFIED; (3) trigger allowing status transitions only `PENDING_VERIFICATION->VERIFIED`, `PENDING_VERIFICATION->REJECTED`, `REJECTED->PENDING_VERIFICATION`; (4) `ENABLE ROW LEVEL SECURITY` on **every** table with **no policies**; (5) partial unique index so only one `APPROVED` log exists per order. Triggers must `RAISE EXCEPTION`.
- Never edit an applied migration. Create a new one.
- Migrations use `DIRECT_URL` (session pooler 5432). The app runtime uses `DATABASE_URL` (transaction pooler 6543).
- Seed must be idempotent (upsert by unique keys) and store **bcrypt hashes only**.

**Seed data:**
- REC-BL01 "Casual Blouse", category Blouse, 1.8 yds, cap 5.0%: Front Body Panel x1, Back Body Panel x1, Sleeves (Left & Right) x2, Collar & Stand x1, Sleeve Cuffs x2.
- REC-CT02 "Crop Top", category Crop Top, 1.1 yds, cap 8.0%: Front Chest Panel x1, Back Support Panel x1, Neck Binding Strip x1, Hem Elastic Casing x1, Side Strap Accents x2.

---

## 3. Skill: Authentication and sessions

- Custom auth against the `users` table. **Do not use Supabase Auth.**
- `bcryptjs` (pure JS) for hashing, cost 10-12. **Never** use native `bcrypt`.
- `jose` for JWT: HS256, secret from `AUTH_SECRET`, 8h expiry, payload `{ sub, role }`.
- Cookie: `httpOnly: true`, `secure: true` (production), `sameSite: "lax"`, `path: "/"`, `maxAge` 8h.
- `getCurrentUser()` verifies the JWT, then **loads the user from the DB** and confirms `is_active`. The role used for authorization comes from the **DB row**.
- Login: validate with Zod; lowercase the email; if user not found, still run `bcrypt.compare` against a dummy hash; return the same generic message `"Invalid email or password"` for every failure; increment `failed_attempts` and set `locked_until = now + 15 min` after 5 failures; reset on success. Never return `password_hash`.
- Never log passwords, tokens or hashes.

---

## 4. Skill: RBAC guards, errors and API responses

- `requireUser()` returns 401 if no valid session.
- `requireRole(...roles)` returns 403 if the role does not match. **Every** protected handler calls it as its first step.
- Middleware may redirect for UX, but it is **not** the security boundary. Real enforcement happens inside every handler.
- State-changing requests (POST, PUT, PATCH, DELETE): if an `Origin` header is present it must match the host, else 403. If absent, allow (for cURL and Postman).
- **HTTP status convention:**

| Code | When |
|---|---|
| 400 | Zod/schema validation failure, malformed JSON, missing reject note |
| 401 | No or invalid session |
| 403 | Authenticated but wrong role |
| 404 | Not found, **or not visible to this role** (e.g. non-VERIFIED order for sewing) |
| 409 | Invalid state transition or already processed |
| 422 | Business-rule violation (hard stop: RED or uncounted components) |

- Response shape: `{ "error": { "code": "...", "message": "...", "details": [] } }`. Never leak stack traces or SQL errors.

---

## 5. Skill: Domain logic (pure functions)

- `src/domain` has **no** DB, HTTP, React or env access. It is fully unit-testable.
- `evaluateComponent(expected, actual | null)` returns `"GREEN" | "YELLOW" | "RED" | "UNCOUNTED"`.
- `canApprove(items)` is true only if no item is RED or UNCOUNTED.
- `STATE_TRANSITIONS` map plus `assertTransition(from, to)` which throws `ConflictError` if the move is not allowed.
- `computeExpectedPieces(components, targetQty)` = `pieces_per_garment x targetQty`. `computeExpectedFabric(stdYards, targetQty)`.
- `computeWastagePct(expected, actual)` rounded to 2 decimals; guard against division by zero.
- The **same** `evaluateComponent` is imported by the client for instant feedback and by the server as the authority.

---

## 6. Skill: Order creation

- `POST /api/orders` accepts **only**: `recipe_id`, `target_qty`, `fabric_roll_id`, `actual_fabric_yds`. Strip and ignore everything else (use Zod `.strict()` or pick fields).
- The server computes `expected_qty` for each component, `expected_fabric_yds`, `order_no` and `created_by` (from session).
- In **one transaction**: insert the order with status `PENDING_VERIFICATION`, then insert one `verification_items` row per component with `actual_qty = NULL`.
- `POST /api/orders/:id/resubmit`: supervisor only, only from `REJECTED`, resets all `actual_qty` to NULL and sets status `PENDING_VERIFICATION`. Otherwise 409.
- Visibility: supervisor sees all orders; verifier sees only `PENDING_VERIFICATION`; sewing cannot call this endpoint.

---

## 7. Skill: Verification gatekeeper (most important)

**Save counts:** `PUT /api/verification/:orderId/counts` (verifier only, order must be PENDING_VERIFICATION else 409). Body is `{ counts: [{ component_id, actual_qty }] }`. `actual_qty` is an integer from 0 to 1,000,000. Reject component IDs not belonging to this order. **Compute each item's status on the server. Never accept a status or expected value from the client.**

**Approve:** `POST /api/verification/:orderId/approve` (verifier only). Required order of operations, **inside one DB transaction**:

```ts
// pseudocode, follow this order exactly
requireRole("cutting_verifier");
return db.transaction(async (tx) => {
  const order = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
  if (!order) throw new NotFoundError();
  assertTransition(order.status, "VERIFIED");            // 409 if not PENDING_VERIFICATION
  const items = await tx.select().from(items).where(eq(items.orderId, id)); // RE-READ from DB, ignore request body
  if (!canApprove(items)) throw new BusinessRuleError("...", blockingComponents); // 422
  const wastage = computeWastagePct(order.expectedFabricYds, order.actualFabricYds);
  await tx.insert(logs).values({ orderId: id, verifierId: actor.id, decision: "APPROVED",
    wastagePct: wastage, varianceSnapshot: buildSnapshot(items), approvalNote });
  await tx.update(orders).set({ status: "VERIFIED" }).where(eq(orders.id, id));
});
```

**Reject:** `POST /api/verification/:orderId/reject`. `note` is required, trimmed, 5 to 500 characters (400 otherwise). Same transaction and lock pattern. Insert a `REJECTED` log (with note, snapshot, wastage), set status `REJECTED`.

**Never:** trust `verifier_id`, timestamps, statuses or counts from the request body. Never update the order status without the lock and transition check. Never skip the DB re-read.

---

## 8. Skill: Sewing queue

- Role: `sewing_supervisor` only.
- `GET /api/sewing/queue`: the query **hard-codes** `WHERE status = 'VERIFIED'`. It accepts **no** filter, status or search params from the URL.
- `GET /api/sewing/queue/:id`: `WHERE id = ? AND status = 'VERIFIED'`; return **404** otherwise.
- Response includes the order, component counts and variances, verifier full name, verified timestamp, approval note, and `wastage_pct` with the recipe's cap.
- `POST /api/sewing/:id/start`: lock the order; require `VERIFIED` and `sewing_started_at IS NULL` (else 409); set `sewing_started_at = now()` and `sewing_started_by` from the session. The status **stays** `VERIFIED`.

---

## 9. Skill: Input validation (client and server)

- Server: **Zod on every input**, including route params (UUID) and query strings. `.strict()` on object bodies.
- Integers (`target_qty`, `actual_qty`): `z.number().int().min(...).max(...)`. Parse from JSON numbers, **do not** loosely coerce strings like `"5abc"` or `""`.
- Yards: positive, max 2 decimals, upper bound.
- Roll ID: trimmed, regex `^[A-Za-z0-9-]+$`, length 3 to 40.
- Client forms (react-hook-form + zodResolver or equivalent): `inputMode="numeric"`, block the keys `e E + - .` in integer inputs, show an **inline error under the field** immediately, and disable submit while invalid or submitting.
- Reject: negatives, decimals (where integers are required), non-numeric strings, empty values and whitespace-only values.
- Client validation is for UX only. The server must independently reject the same inputs.

---

## 10. Skill: UI, contrast and professional design

**Zero-tolerance rule: no white-on-white or low-contrast text, ever.**
- Set `color-scheme: light` and use a light theme only (avoid half-implemented dark mode).
- Inputs, selects, textareas: explicit `bg-white text-slate-900 border-slate-300 placeholder:text-slate-500`. Also style: `:focus-visible` (2px visible ring), `:disabled` (still readable), and browser autofill (`-webkit-text-fill-color`, box-shadow inset trick).
- Dropdowns: if using native `<select>`, style `option` with explicit `color` and `background`. If using shadcn Select/Popover, verify the popover text and background colors.
- All text and UI contrast >= **WCAG AA (4.5:1)**.
- Status is **never colour-only**: use colour + icon + text (e.g. check-circle "Match", alert-triangle "Excess +5", x-circle "Shortage -3").
- Layout: left sidebar (collapses to a menu under 768px), top bar with user name, role badge and "Switch role", content max-width container, consistent spacing scale, subtle borders, rounded cards, neutral slate palette with one primary accent.
- Components: tables become cards on mobile; modals via Radix Dialog (focus trap, Esc to close); toasts for success and error; skeleton or spinner loading states; clear empty states; confirm dialog for reject.
- Disabled buttons must explain why (message or tooltip), e.g. "Approval blocked: 2 components have shortages".
- Do not hide security behind UI: hiding or disabling a control is cosmetic only.

---

## 11. Skill: Testing (Vitest + PGlite)

- `npm test` must pass with **no env vars** and without touching Supabase.
- `tests/helpers/testDb.ts`: create a PGlite in-memory DB, apply **all** migrations (including triggers and RLS), and expose helpers `seedUsers()`, `seedRecipe()`, `createOrderFixture()`.
- Services take `db` and `actor`, so tests call them directly.
- **Required 5 tests:**
  1. An order with all GREEN components can be approved by an authenticated verifier.
  2. An order with a RED component returns 422 and stays `PENDING_VERIFICATION`.
  3. Rejecting without a note fails validation (400).
  4. Supervisor and sewing roles get 403 when approving.
  5. Unapproved orders never appear in the sewing queue query.
- **Extras:** uncounted (NULL) blocks approval; double approve gives 409; YELLOW can be approved; wastage maths; direct UPDATE on `verification_logs` is blocked by the trigger; invalid transition blocked by the trigger; negative, decimal and empty inputs rejected.
- Test names describe behaviour (`"blocks approval when any component is RED"`). No snapshot tests for logic.

---

## 12. Skill: Vercel and Supabase compatibility

- DB client: `postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })` (required for the transaction pooler on serverless).
- Never call `supabase-js`, never use the Supabase anon or service-role key. The DB is reached **only** from server code.
- Env vars: `DATABASE_URL`, `DIRECT_URL` (local migrations only), `AUTH_SECRET`. **Never** use the `NEXT_PUBLIC_` prefix for secrets.
- Only serverless-safe, pure-JS dependencies (`bcryptjs`, `jose`). No native modules, no filesystem writes, no long-running processes, no in-memory state (rate-limit state belongs in the DB).
- Route handlers that touch the DB: `export const runtime = "nodejs"`.
- Don't run migrations during the Vercel build. Run `npm run db:migrate` and `db:seed` manually from the developer machine.
- Security headers in `next.config`: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.
- Keep Next.js on a current patched version. Commit the lockfile.

---

## 13. Skill: Git workflow

- **Atomic commits**, one logical change each, conventional format: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:` with an optional scope, e.g. `feat(api): add server-enforced approve hard stop`.
- Never commit `.env*`, secrets, `node_modules` or build output.
- Aim for 40+ small commits over the 4 days (the evaluator reads the history).
- Never rewrite or squash history before submission.

---

## 14. Skill: AI self-review checklist (run before finishing every task)

AI tools commonly make these mistakes in this kind of project. **Check each one and fix it before presenting code:**

- [ ] RBAC implemented only in UI or middleware, not inside the handler
- [ ] Trusting `verifier_id`, timestamp, status, `expected_qty` or counts from the request body
- [ ] Approve logic reading counts from the request instead of re-reading the DB
- [ ] Missing transaction or row lock (`FOR UPDATE`) causing double-approve races
- [ ] Missing `422` on RED or NULL, or returning `200` with `{ success: false }`
- [ ] Sewing query accepting a `status` param or using `status != ...`
- [ ] Loose numeric coercion (`Number("")` is 0, `parseInt("5abc")` is 5, `Number("1e3")` is 1000)
- [ ] Float arithmetic on money-like or yard values without rounding
- [ ] White text on white input, unstyled `<select>` options, or invisible placeholders
- [ ] `useEffect` loops or state not syncing after a mutation (use `router.refresh()` or refetch)
- [ ] Leaking `password_hash`, stack traces or "email not found" messages
- [ ] Native modules (`bcrypt`) or `supabase-js` slipped into the project
- [ ] Hard-coded secrets or `NEXT_PUBLIC_` on a secret
- [ ] Tests that mock away the very rule they claim to test

If you find an issue the user did not ask about, **fix it and add a one-line note** the user can paste into `docs/ai-log.md`.

---

## 15. Definition of done (per task)

1. Code compiles (`npm run build`) and lints clean.
2. The relevant skill rules above are satisfied.
3. Security-relevant behaviour verified with a direct request (cURL/Postman), not just the UI.
4. Tests added or updated, and `npm test` passes.
5. Small, descriptive commit made.
6. Any AI mistake caught is recorded in `docs/ai-log.md`.

---

## 16. Demo credentials (seed these exactly)

| Role | Email | Password |
|---|---|---|
| cutting_supervisor | `supervisor@apparelflow.demo` | `Supervisor@123` |
| cutting_verifier | `verifier@apparelflow.demo` | `Verifier@123` |
| sewing_supervisor | `sewing@apparelflow.demo` | `Sewing@123` |

These are demo-only accounts with no real data. They are intentionally shown on the login page for the evaluator.
