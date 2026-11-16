# Reverse-engineering progress

Target: https://estateflow.devintime.com (company panel, demo account only)
Started: 2026-11-16
Updated: 2026-11-17

## Phase 0 — My project (complete)

- Stack: React 19 + Vite 8 SPA, React Router 7, plain CSS design tokens, lucide-react icons.
- Backend: Express 5 in `server/`, also exported through `api/index.js` as a Vercel function.
- Data: Supabase PostgreSQL through `@supabase/supabase-js` (service-role key server-side); schema in `supabase/schema.sql`.
- Current entities: `properties` and `enquiries` only.
- State: React Context (`PropertyProvider`, `ToastProvider`) + service layer (`propertyApiService`).
- Validation: centralised in `src/services/validation.js` + `propertyForm.js`.
- Routes: public marketing/property pages + unguarded `/admin/properties` CRUD.
- Auth: none. No users, sessions, roles, guards, login page, or cookies.
- API shape: `/api/properties`, `/api/enquiries`, `/api/upload`, `/api/health`; errors are `{ error: string }`.
- Seed data: `src/data/properties.js`, applied by `server/seed.js`.
- Tests: Vitest + Testing Library (jsdom), ESLint.

## Phase 1 — Demo reverse engineering (complete)

- [x] Login page observed (`/login`): Laravel Blade, CSRF token, email/password/remember.
- [x] Logged in with the provided demo company account; landed on `/company/dashboard`.
- [x] Dashboard observed: KPI cards, income/expense chart, unit inventory, installment list, recent sales, project progress, lead pipeline, tasks, approvals, getting-started modal.
- [x] Full sidebar inventory captured: 74 authenticated routes across 14 groups.
- [x] Per-page structure catalogue written for all 14 modules.
- [x] Create forms captured for projects, quotations, sales, leases, material issues, purchase orders, purchases, journal entries and roles.
- [x] Modal forms captured for leads, customers, tenants, suppliers, expenses, income, payouts, loans, accounts, transfers, employees, leave, advances, payroll, HR setup, website items/gallery/media and templates.
- [x] Settings captured: 7 tabs only (`profile`, `localization`, `numbering`, `sales`, `rental`, `payments`, `smtp`); 30 numbering sequences.
- [x] Reports captured: all 11 routes, filters, output columns and sample totals.
- [x] Auth/session contract captured: 302 login redirect, rate-limit headers, guest guard, logout, forgot password, profile.
- [x] Live lead CRUD cycle: create/update/validation, demo delete 403.
- [x] Website CMS captured: inquiries, page content, articles modal, gallery, four item types, media, legal, settings.
- [x] Operation team captured: team, roles matrix (144 permissions), branches.
- [x] Setup captured: languages, master data, material categories, warehouses, expense categories, HR setup, notification settings/templates, delivery log, audit log.
- [x] `04-api-contract.md`, `05-data-model.md` (3 Mermaid ER diagrams), `06-gap-analysis.md`.
- [x] Phase 2 proposal: `07-implementation-plan.md`.

### Phase 1 deliverables

| File | Contents |
|---|---|
| `01-overview.md` | Product, architecture, shell, module map, full route inventory, conventions, glossary |
| `02-auth.md` | Login, session, guard, logout, forgot password, profile, authorization surface |
| `03-pages/01-dashboard.md` | KPIs, chart mechanism, inventory, lists, pipeline, tasks |
| `03-pages/02-properties.md` | Projects, buildings, floors, units, project detail |
| `03-pages/03-sales.md` | Leads, visits, customers, quotations, reservations, sales, installments, collections, commissions |
| `03-pages/04-rental.md` | Occupancy, tenants, leases, rent roll, collections, deposits, maintenance |
| `03-pages/05-payments.md` | Payment links, online payments, refunds, gateways |
| `03-pages/06-construction.md` | Materials, stock, issues, laborers, attendance, contracts |
| `03-pages/07-workspace.md` | Tasks, recurring tasks, approvals, notifications, settings, delivery log |
| `03-pages/08-purchasing.md` | Purchase orders, purchases, suppliers, contractors |
| `03-pages/09-finance.md` | Expenses, income, payouts, bank/cash, loans |
| `03-pages/10-accounting.md` | Chart of accounts, journals, 11 reports |
| `03-pages/11-hr.md` | Employees, attendance, leave, payroll, advances, setup |
| `03-pages/12-website.md` | Inquiries, page content, articles, gallery, items, media, legal, settings |
| `03-pages/13-operation-team.md` | Team, roles/permissions, branches |
| `03-pages/14-setup-settings.md` | Settings tabs, languages, master data, categories, warehouses, notifications, audit |
| `04-api-contract.md` | Request/response conventions, auth, endpoint catalogue, uploads, error semantics |
| `05-data-model.md` | Inferred entities, 3 Mermaid ER diagrams, enums, integrity rules |
| `06-gap-analysis.md` | Current state, demo gap, architecture gaps, scope options, risks |
| `07-implementation-plan.md` | Proposed Release 1 plan and approval questions |

### Demo limitations / unobserved

- Deletes are globally blocked (403), so the temporary lead `ZZ RE Test Lead — Edited Then Deleted` remains; UUID `01a1e50a-ca97-73c8-8aa9-c791a1320f76`.
- Remember-me cookie name/flags/lifetime, session timeout and lockout policy are not observable (redacted/HttpOnly).
- Invalid-login error text was not detectable; reimplementation uses a generic message.
- Payment gateway callbacks, email/SMS/WhatsApp delivery, PDF/print output and file upload processing were not triggered.
- Row-level action URLs generated by `data-action` were not captured; marked **ASSUMPTION** in `04-api-contract.md`.
- Public site full content/key catalogue was not enumerated.
- Full 144-permission catalogue and role edit screen were not enumerated.
- Multi-branch data scoping was not exercised (demo users have no branch).

## Phase 2 — Plan (approved 2026-11-16)

- Plan written in `07-implementation-plan.md`.
- Approved scope: Release 1 — Core Operations MVP (auth/tenancy/permissions, settings, inventory, CRM, sales, rental, dashboard v1, public lead bridge).
- Deferred: accounting/finance, purchasing/construction, HR, gateways, full website CMS, notifications beyond in-app.
- Decisions locked: DB sessions with scrypt; admin workspace at `/admin`; legacy public properties retained; small fictional dev company seeded from env; versioned SQL migrations.

## Phase 3 — Implement (in progress)

Branch: `feat/r1-core-ops`. Work is tracked in `.superpowers/sdd/07-implementation-plan/progress.md`.

- [x] WP0 — Foundation schema, ordered migration runner, API error contract, server test harness, helpers.
- [x] WP1 — Auth, tenancy, roles, CSRF, login/guard, admin shell, protected legacy mutations.
  - Server: scrypt hashes, hashed session tokens, throttling, `/api/auth/*`, `requireAuth` / `requirePermission` / `requireCsrf`, company scoping.
  - Client: `/login`, `AuthProvider`, `ProtectedRoute`, guarded `/admin/*`, user/company/role menu, permission-filtered nav.
  - Seed: 68 permissions, 10 default roles, fictional dev company/admin from env (credentials not committed).
  - Verification: lint clean; client 68 tests / 10 files; server 26 tests / 6 files; HTTP smoke and role-denial checks; browser login/logout/guard check.
- [x] WP2 — Settings, branches, team, roles, audit.
  - Server: `/api/settings`, `/api/branches`, `/api/team`, `/api/roles`, `/api/audit-logs`, `/api/lookups`; audit snapshots for every change; 30-sequence catalog and 70-key permission catalog.
  - Client: profile/localization/numbering tabs, branch CRUD, team invite/edit/status with self-protection, grouped role matrix with select-all and live count, audit filters and before/after diff modal; grouped sidebar with mobile drawer.
  - Verification: lint clean; client 68 tests / 10 files; server 45 tests / 7 files. Browser cycles covered settings persistence, branch CRUD + Head Office delete `409`, team invite/edit/deactivate + cleanup, role create/edit/delete and delete blocks, audit filters/diff, permission denial (`403` UI/API), mobile drawer and 1440 px desktop layout.
- [x] WP3 — Inventory.
  - Server: project/building/floor/unit CRUD, status transitions and history, bulk numbering, private documents, unit-type lookups; company-scoped and permission-guarded. Project and unit deletes are soft; project delete blocked with units, unit delete blocked by active contracts.
  - Migration `008_inventory_defaults.sql` seeds seven unit types and the private `documents` bucket.
  - Client: project card list with type/status filters, project create/edit/detail tabs, buildings and floors, generated and single units, status modal, unit history, document upload/list/delete.
  - Verification: lint clean; client 74 tests / 12 files; server 62 tests / 9 files. Browser cycle covered project and building creation, generation of `A-101`…`A-202`, unit create/edit/status/history, building/floor delete guards, document upload/delete, unit delete, project delete `409`, and final cleanup deletes.
  - Fixed during verification: unit create/update wrote nonexistent actor columns; stale “correct the highlighted fields” alert after file selection; soft-deleted units blocking building/floor deletion via foreign key.
- [x] WP4 — CRM.
  - Server: `/api/leads` (list/search/stage/source/assignee/project filters, create, detail with follow-ups/visits/linked customer, edit, stage change, follow-ups, convert, delete), `/api/customers` (filters, CRUD, soft delete), `/api/visits` (upcoming/past, status/project/salesperson filters, lifecycle transitions, delete); permission-guarded and company-scoped. Lost stage requires a reason and clears it on reopen. Conversion creates one customer, links `lead_id`, marks the lead won and returns `409` on duplicates. Deleting a converted customer clears `lead_id` so the lead can be converted again.
  - Migration `010_audit_events.sql` extends audit events with `status_changed`, `followup_added`, `followup_completed` and `converted`.
  - Client: lead list filters and table, lead detail with stage stepper, activity timeline, follow-up/visit/stage/convert/delete modals; customer list and form; visits board with date/status/project/salesperson filters and lifecycle actions; audit log labels for CRM events.
  - Verification: lint clean; client 79 tests / 13 files; server 76 tests / 10 files. Browser cycle covered project setup, lead creation and filters, lost-reason validation and reopen, follow-up create/complete, conversion, duplicate conversion `409`, customer create/edit/search/delete, visit scheduling from a lead, completed → reopen → cancelled → reopen → no-show, past-date filter, visit delete, “Open in customers” deep link, delete-customer then re-convert, and audit entries for CRM events.
  - Fixed during verification: ambiguous `users` embeds in lead/visit/follow-up selects (explicit FK hints); missing `SupabaseAdminRepository.getLookup`; missing CRM audit event constraint values; converted-customer deletion leaving a stale `lead_id`.
  - Quotation link from lead detail was deferred to WP5 and delivered there.
- [x] WP5 — Sales engine.
  - Server: `/api/quotations` (list/search/status/project, create, edit, status transitions, convert), `/api/reservations` (list, create, convert, cancel), `/api/sales` (list/search/status/project/salesperson, create, detail, update, cancel, handover, installment reschedule/waive/pay), `/api/installments` (aging filters and summary), `/api/receipts` (list, create with allocation, detail, void), `/api/commissions` (rule CRUD/toggle, ledger list and status transitions); all company-scoped and permission-guarded.
  - Schedule math keeps rounding on the final installment; down payment is collected at sale creation; full payment creates one installment on the agreement date. Reservation expiry/cancel releases the unit; cancellation releases the unit and cancels installments and commissions. Receipt allocations must equal the receipt amount and never exceed an installment balance. Handover requires zero open schedule balance.
  - Migration `011_sales_defaults.sql` adds sales/commission defaults; applied via Supabase MCP and verified (`late_fee_type='none'`, receipt post/void functions).
  - Client: quotation, reservation, sale, receipt, installment and commission-rule modals; project/lead-prefilled forms; quotations, reservations, sales, sale detail, installments, collections and commissions pages; routes and permission-filtered Operations nav. Lead detail now links to a lead-prefilled quotation.
  - Verification: lint clean; client 85 tests / 14 files; server 91 tests / 12 files. Browser cycle covered quotation creation from a lead (QT-2026-00001, net $158,500) → accepted → sale; partial receipt with auto-allocation, client over-allocation block, full receipt, handover, receipt void reopening balances; installment reschedule and waive; reservation cancel and reservation → sale conversion; sale cancel releasing the unit and cancelling installments/commissions; commission rule create/deactivate/reactivate/delete and ledger pending → approved → paid → cancelled; permission denial with a role-based Sales Agent (nav hidden, route guard, API `403`).
  - Fixed during verification: missing `formatDateTime` client imports; React `set-state-in-effect` lint errors; sale `balance_due` still counted waived installments (now derived from open schedule balances, with a server regression test).
  - Known limitations: an accepted quotation created from a lead does not prefill the sale customer because the quotation embed exposes only the lead id/name; the `?lead=` query parameter keeps the quotation modal open across reloads; voiding a receipt after handover reopens balances but leaves the historical handover record in place.
- [x] WP6 — Rental.
  - Server: `/api/tenants` (list/search/status, CRUD), `/api/leases` (list/search/status/project/unit, create, detail, edit, activate, renew, revise rent, terminate, schedule adjustments), `/api/rent-roll` (period filters, lease/tenant/project/date scoping, summary), `/api/rent-collections` (list, create with allocation, detail, void), `/api/deposits` (list, receive, deduct, refund, history); company-scoped and permission-guarded. Activation generates the rent schedule and marks the unit rented; renewal creates a follow-on lease and marks the old lease renewed; termination cancels future unpaid periods and releases the unit when no active lease remains; revise rent updates future unpaid periods.
  - Schedule math: lease numbering `LSE-YYYY-00001`, receipts share the `RCP-` sequence with sales collections, deposit lifecycle `to_collect → held → awaiting_settlement → settled`, and rent receipts allocate oldest open periods first.
  - Migration `012_rental_defaults.sql` adds the rental lookups/defaults; applied via Supabase MCP.
  - Client: tenant form modal; lease create modal with activate; unified lease action modal (activate, renew, revise, terminate, adjust); rent receipt modal with editable auto-allocations; deposit action modal (receive, deduct, refund); tenants, leases, lease detail, rent roll, rent collections and security deposits pages; rental nav group; client-selector tests.
  - Verification: lint clean; client 95 tests / 15 files; server 130 tests / 14 files. Browser cycle covered tenant creation, lease creation for A-102 (12 periods, $21,600), rent receipt and void reopening the period, rent-roll status filter, deposit receipt/deduction/early-refund transitions, revise rent effective 2027-01-01 (balance $22,600), renewal to LSE-2026-00003 with the old lease marked Renewed, termination cancelling 10 future periods and releasing the unit, deposit awaiting settlement → refund → settled, and Sales Agent `403` on every rental read/write endpoint with CRM still permitted.
  - Fixed during verification: lease detail `500` caused by a self-referential `previous_lease` embed; one-day extra rent period when a lease ends exactly on a period boundary (regression test added); renewal left the old lease deposit in its previous status (now transitions to settled/awaiting settlement).
- [x] WP7 — Dashboard v1 and notifications.
  - Server: `GET /api/dashboard` gated by `dashboard.view` with per-module KPI/list visibility, month-scoped collection figures, overdue normalisation, inventory/project/pipeline aggregates and cancelled-sale exclusion; `/api/notifications` own-only feed with unread count and mark-one/all read under CSRF.
  - Notification events: `lead.assigned`, `lead.stage_changed`, `sale.created`, `collection.received`; assignee/salesperson recipients, actor excluded, cross-user reads `404`.
  - Client: dashboard page with four KPI cards, installments due, recent sales, inventory breakdown, project progress and pipeline deep links; `/admin` redirects to `/admin/dashboard`; topbar bell with unread badge, mark-all, outside-click/Escape and link-to-read.
  - Verification: lint clean; client 102 tests / 16 files; server 141 tests / 16 files. Browser cycle covered KPI reconciliation to completed receipts (voided excluded), dashboard deep links, all four notification events in the recipient bell, actor exclusion, mark-one/mark-all read, a Sales Agent dashboard without the rent KPI, and Escape close.
  - Known limitations: bell refreshes on mount/open only; down payments are stored on the sale and excluded from the receipt-based collection KPI; dashboard is company-wide, not branch-scoped.
- [ ] WP8 — Public bridge.

## Phase 4 — Verify (pending)
