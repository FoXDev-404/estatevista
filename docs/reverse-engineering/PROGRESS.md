# Reverse-engineering progress

Target: https://estateflow.devintime.com (company panel, demo account only)
Started: 2026-11-16
Updated: 2026-11-16

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
- [ ] WP3 — Inventory.
- [ ] WP4 — CRM.
- [ ] WP5 — Sales engine.
- [ ] WP6 — Rental.
- [ ] WP7 — Dashboard v1 and notifications.
- [ ] WP8 — Public bridge.

## Phase 4 — Verify (pending)
