# 07 — Implementation plan (Phase 2 proposal)

Status: **awaiting user approval** — no application code will be written until this plan is confirmed.

Source of truth: `01-overview.md` … `06-gap-analysis.md`.

---

## 1. Decision required

Full parity with the demo is a multi-release product build (74 routes, 14 modules, double-entry accounting, payroll, gateways, CMS). The recommended first release is a coherent operational core, not a shallow copy of every screen.

**Recommendation: Release 1 — Core Operations MVP (Option B in `06-gap-analysis.md`).**

Release 1 scope:

1. Auth, company, branches, team, roles/permissions, localization/numbering settings, audit log.
2. Projects → buildings → floors → units, unit types, project detail (overview/units/documents).
3. CRM: leads, follow-ups, visits, customers, lead conversion.
4. Sales: quotations, reservations, sales, installment schedules, collections, commissions.
5. Rental: tenants, leases, rent schedules, rent collections, security deposits.
6. Dashboard with the operational KPIs and lists backed by 1–5.
7. Public bridge: project/listing pages and inquiry/visit forms create leads.

Explicitly deferred to later releases: accounting/reports, expenses/income/bank/loans, purchasing/stock/construction labour, HR/payroll, payment gateways, full website CMS, tasks/approvals/notifications, SMS/WhatsApp.

If full parity is required, it should still start with Release 1 and then proceed through Releases 2–4.

---

## 2. Target architecture

Keep the current stack; do not rewrite the app.

| Layer | Decision |
|---|---|
| Frontend | React 19 + Vite, React Router 7; keep public pages, replace `/admin` with a guarded workspace |
| Backend | Express 5; add `/api/auth`, `/api/settings`, `/api/projects`, …; keep `/api/properties` and `/api/enquiries` working |
| Database | Supabase PostgreSQL; versioned SQL migrations in `supabase/migrations/` |
| Auth | Server-side session stored in DB; password hashing with Node `crypto.scrypt`; HttpOnly `ev_session` cookie; CSRF double-submit cookie + `X-CSRF-Token` header |
| Authorization | Seeded permission matrix (`module.action`), `requireAuth` + `requirePermission` middleware on every protected route |
| Validation | Shared server-side schemas; `422` with `{ error, fields: { field: message } }`; update the existing API/client to the same shape |
| Money | `numeric(18,2)` in Postgres; decimal-safe arithmetic on the server; company currency/format settings |
| IDs | UUID primary keys; separate company-scoped sequence numbers (`PRJ-0001`, `SAL-2026-00001`, …) |
| Files | `documents` table + validated multipart upload; keep existing upload endpoint for property images |
| Audit | Central `writeAudit()` called by every create/update/delete/void, with before/after snapshots |
| Tests | Vitest for units/API; Testing Library for key screens; a repeatable end-to-end script for each flow |

### Why DB sessions instead of Supabase Auth

- The app already uses the Supabase service-role key server-side; adding Supabase Auth would introduce a second identity system and client-side session handling.
- DB sessions let us enforce company scoping, roles, throttling, idle/absolute expiry and audit in one place.
- No demo or third-party credentials are involved.

If you prefer Supabase Auth, say so before implementation; the rest of the plan is unchanged except WP1.

---

## 3. Release roadmap

| Release | Contents | Why this order |
|---|---|---|
| **R1 (this plan)** | Foundation, inventory, CRM, sales, rental, dashboard v1, public lead bridge | Prerequisites + commercial core; produces usable day-to-day value |
| R2 | Accounts, expenses, other income, payouts, transfers, loans, journal entries, P&L/balance sheet/trial balance/general ledger/receivables/payables, dashboard net profit/cash KPI | Needs R1 transactions to post against |
| R3 | Materials, stock, warehouses, material issues, purchase orders, purchases, suppliers, contractors, contracts, labour/attendance | Depends on projects + accounting hooks from R1/R2 |
| R4 | HR (employees, attendance, leave, payroll, advances), payment links/gateways/refunds, full website CMS, tasks/approvals/notifications, remaining reports | Independent modules; can be reordered by business priority |

Each release ends with its own verification pass and user review before the next one starts.

---

## 4. Release 1 work packages

Work is ordered by dependency. Each package ends with: lint + tests + run app + end-to-end check + fix + commit.

### WP0 — Safety, schema and contracts

**Deliverables**

- `supabase/migrations/001_foundation.sql` (companies, branches, users, sessions, roles, permissions, role_permissions, user_roles, settings, number_sequences, audit_logs, documents).
- `.env.example` additions: `SESSION_SECRET`, `SEED_COMPANY_NAME`, `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (no demo values).
- Migration runner that applies ordered SQL files idempotently; keep `schema.sql` for the existing tables or convert it into `000_base.sql`.
- API error contract: `{ error, fields? }`; update existing endpoints and the property client to consume it.
- Shared pagination/filter helper and `writeAudit()`.
- Test setup for API routes (Supertest or fetch against an ephemeral app instance).

**Exit criteria**

- Fresh database migrates from zero with one command.
- Existing `/api/properties`, `/api/enquiries`, `/api/upload`, `/api/health` still work.
- No demo URL, credentials or branding anywhere in the repo.

### WP1 — Auth, tenancy, roles and guard

**Schema**: `companies`, `users`, `sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, `branches`.

**API**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | email + password; rate-limited (10 / 15 min / IP+email) |
| POST | `/api/auth/logout` | destroy session |
| GET | `/api/auth/me` | current user, company, roles, permissions |
| POST | `/api/auth/password` | current + new password |

**Behaviour**

- Passwords hashed with `scrypt` + per-user salt; timing-safe compare.
- Session token random 32 bytes, stored hashed; cookie `HttpOnly`, `Secure` in production, `SameSite=Lax`, 30-day absolute / 8-hour idle.
- Rotate session on login; invalidate all sessions on password change.
- CSRF required on all mutating requests except login.
- Login throttle returns `429` with a generic message.
- Every business query is scoped by `company_id`; a request cannot read another company's rows.
- Seed permissions and default roles; seed company + admin from env only.

**Frontend**

- `/login` page (EstateVista styling, no demo-credentials panel).
- `AuthProvider` + `ProtectedRoute`; `/admin/*` redirects to `/login?next=…`.
- Admin shell shows user, company, role, logout; nav filtered by permission.
- Forgot-password screen may be a placeholder in R1 (email delivery depends on SMTP, deferred); do not fake sending.

**Tests**

- Login success/failure, throttle, logout, guard redirect, expired session, CSRF rejection.
- Role-based route/API denial.
- Cross-company access attempt returns 404/403, never data.

### WP2 — Company settings, branches, team, roles, audit

**API**: `/api/settings` (profile, localization, numbering), `/api/branches`, `/api/team`, `/api/roles`, `/api/audit-logs`, `/api/lookups`.

**UI**: Settings tabs (profile/localization/numbering), branch CRUD, team invite/deactivate, role matrix editor (module × view/create/edit/delete, select-all), audit list with before/after modal.

**Rules**

- Number sequences used by every later module; changing prefix/padding/reset affects new records only.
- Deactivate instead of delete for users/branches with history.
- Role edits apply immediately; server enforcement is authoritative.
- Audit every settings/team/role/branch change.

### WP3 — Inventory (projects, buildings, floors, units)

**Schema**: `projects`, `buildings`, `floors`, `units`, `unit_types`, `project_phases`, `documents`, `unit_status_history`.

**API**: CRUD + list filters (`search`, type, status, project, building, unit type), project detail, bulk unit generation, unit status transitions, document upload.

**UI**

- Project card grid + filters + create/edit form (fields from `03-pages/02-properties.md`).
- Project detail tabs: Overview, Units board, Documents. Construction and Budget tabs are shown only when their modules land (no fake data).
- Units table with the seven statuses and filters.
- No global `/units/create`; units are created from a project.
- Building/floor management and “Generate units” (building, floor range, unit type, numbering pattern, area, price).
- Keep the existing public `properties` listing untouched for now; new projects/units are the operational inventory. A later release can unify public listings with projects.

**Tests**

- Project CRUD; required fields; code auto-generation.
- Unit generation count/numbering; duplicate unit number rejected.
- Status transition rules; unit with active sale/reservation/lease cannot be re-reserved.
- Project totals reconcile with unit rows.

### WP4 — CRM (leads, visits, customers)

**Schema**: `leads`, `lead_followups`, `visits`, `customers`, `lookups` (sources), `tasks` only if needed for follow-ups (otherwise defer).

**API**: lead CRUD, stage change with `lost_reason` validation, phone-or-email rule, follow-up create/complete, visit schedule/complete/cancel/no-show, customer CRUD, convert lead → customer.

**UI**

- Leads table (columns/filters from `03-pages/03-sales.md`), modal create/edit, detail with stage stepper and activity timeline.
- Convert to customer, quotation link (`?lead=`), schedule visit, mark lost.
- Visits list (upcoming/past) and schedule modal.
- Customers table + create/edit modal.

**Tests**

- The exact 422 shape for missing name and missing phone/email.
- Lost requires a reason.
- Convert creates one customer and links the lead; duplicate conversion blocked.
- Visit status lifecycle.

### WP5 — Sales engine

**Schema**: `quotations`, `reservations`, `sales`, `installment_plans`, `installments`, `receipts`, `receipt_allocations`, `commission_rules`, `sales_commissions`.

**API**

- Quotation CRUD/status; prefill from lead.
- Reservation create/convert/cancel/expire; unit → reserved.
- Sale create (full payment or installments); schedule generation; unit → sold.
- Installment list/filter; reschedule/waive.
- Receipt create with auto-allocation and manual allocation; over-allocation rejected; receipt void.
- Commission rules + ledger (basic rate/trigger).

**Business rules**

- Sale `net_price = sale_price − discount + tax`.
- Installment sum = `net_price − down_payment`; rounding difference applied to the last installment.
- Frequencies: monthly, quarterly, half-yearly, yearly; due day, grace, late fee.
- Collection allocation cannot exceed the receipt or the installment balance; transactionally update paid/balance/status.
- Sale status derives from collection; handover allowed only when balance is zero.
- All postings go through one service so R2 can add journal entries without rewriting sales.

**UI**

- Quotations list/create; reservations list/modal; sales list/create; sale detail with summary, schedule table, receive payment, handover, cancel.
- Installments table with aging statuses and date filters.
- Collections list + receive/void.

**Tests**

- Schedule generation for each frequency and rounding.
- Full payment vs installments.
- Partial payment → partly paid; full → paid; overpay rejected.
- Void re-opens balances; unit status changes.
- Money totals reconcile with dashboard KPIs.

### WP6 — Rental

**Schema**: `tenants`, `leases`, `rent_schedules`, `rent_adjustments`, `security_deposits` (+ `deposit_transactions`), reuse `receipts`/`receipt_allocations`.

**API/UI**

- Tenant CRUD, leases list/create/detail, activate/renew/revise/terminate.
- Rent schedule generation from lease term/frequency/due day/grace/late fee.
- Rent collections (auto-allocate), rent roll, deposit receipt/deduction/refund.
- Unit → rented on activation; released on termination/expiry.

**Tests**

- Schedule period math and amount totals.
- Deposit held balance = received − deducted − refunded.
- Rent collection allocation and void.
- Terminate handles future schedules and deposit settlement.

### WP7 — Dashboard v1 and in-app notifications

**Dashboard**

- Sales collected this month (sum of completed receipts), overdue installments, rent collected this month, unit inventory, installments due, recent sales, project progress, lead pipeline.
- Finance-dependent cards (net profit YTD, cash & bank) are added in R2; R1 must not display invented numbers.

**Notifications**

- In-app only: assignment/stage/collection events; bell feed, unread count, mark one/all read.
- No email/SMS/WhatsApp templates in R1 (SMTP/gateways deferred).

**Tests**

- KPI totals equal the underlying module queries on seeded data.
- Notification read state per user; no cross-user leakage.

### WP8 — Public bridge

- Keep the existing public site and property pages.
- Add project/inquiry/visit capture: contact and project forms create a `website_inquiry`, and optionally a `lead` (source Website) with the same validation.
- Public project pages can later read from `projects`; in R1 keep `properties` public and add a project listing page behind a flag only if the data exists.
- Do not expose internal fields or other tenants' data.

**Tests**

- Public form creates one inquiry and one lead; duplicate submission protection.
- No authentication required for the public form; authenticated inbox required to read it.

---

## 5. Verification protocol per work package

1. `npm run lint`
2. `npm test`
3. `npm run dev:all` (server + client)
4. Manual end-to-end run of the package's primary flow with a seeded dev company:
   - create → list → filter → detail → edit → validation failure → authorized delete/deactivate.
5. Verify audit row and number sequence for the created record.
6. Fix all failures.
7. `git status` review; commit only the package's files with a clear message:
   - `feat(auth): session login, guard and role permissions`
   - `feat(inventory): projects, units and generation`
   - `feat(sales): schedules, collections and receipts`
8. Update `docs/reverse-engineering/PROGRESS.md` with what was built/tested.

No success claim without the command output and the manual check.

---

## 6. Data migration and compatibility

- Existing `properties`/`enquiries` data is preserved; no destructive rename.
- New tables are additive; `properties` remains the public listing source until the website/project unification release.
- Optional one-off script maps legacy `properties` into projects only if the user wants the public site to move to the new inventory; not part of R1 by default.
- All migrations are idempotent and reviewed before running against the hosted Supabase project.
- Dev seed data is separate from production; no demo credentials in code.

---

## 7. Dependencies to add (subject to approval)

| Package | Reason |
|---|---|
| `zod` | Server-side request schemas with field-level errors |
| `decimal.js` | Exact money/schedule arithmetic |
| `express-rate-limit` | Login/API throttling (or a small in-house limiter) |
| `cookie-parser` | Cookie parsing (or native parsing) |
| `supertest` (dev) | API integration tests |

No UI component library; keep EstateVista's CSS tokens and components.

---

## 8. Explicit non-goals for Release 1

- Double-entry accounting, financial reports, expenses/income/bank/loans.
- Purchasing, stock, material issues, contractors, labour.
- HR, attendance, leave, payroll, advances.
- Payment gateways, payment links, refunds.
- Full website CMS (articles/gallery/testimonials/FAQ/legal/settings).
- Email/SMS/WhatsApp delivery.
- Approvals workflow, recurring tasks, task comments.
- Multi-currency transactions, bank reconciliation, payroll tax.
- Copying demo branding, copy, assets or demo-only behaviours.

These are mapped to R2–R4 and remain documented for later.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Auth/tenancy retrofit | WP0/WP1 land first; every table gets `company_id`; cross-company tests. |
| Money rounding | `decimal.js`; schedule totals asserted in tests. |
| Scope creep | Fixed R1 scope; new ideas go to the backlog, not the current package. |
| Permission bypass | Middleware on every route; tests for each module's denied case. |
| Legacy property data | Keep tables; no destructive migration; public site untouched. |
| Supabase service role bypasses RLS | App-level scoping mandatory; add RLS policies as defense in depth where feasible. |
| Long feedback loop | Vertical slices; each WP independently testable and committable. |

---

## 10. What I need from you

1. **Scope**: approve Release 1 (recommended), or choose a different option:
   - B — Core Operations MVP (this plan)
   - C — B + finance/accounting
   - A — full parity programme (R1 → R4)
   - D — visual demo only
2. **Auth**: DB sessions (recommended) or Supabase Auth.
3. **Admin URL**: keep `/admin` (recommended, existing links) or move to `/app`.
4. **Legacy listings**: keep `properties` public during R1 (recommended) or migrate them into projects immediately.
5. **Dev data**: seed a small fictional company for local testing (recommended), or start empty.

Nothing will be implemented until you confirm 1–5.
