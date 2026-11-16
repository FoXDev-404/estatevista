# 06 — Gap analysis: EstateVista vs EstateFlow

This compares the current EstateVista repository with the demo product documented in this folder. It is deliberately blunt: the demo is a full real-estate ERP; EstateVista is a public marketing site with a small property admin.

---

## 1. Current EstateVista (verified)

| Area | Current state |
|---|---|
| Stack | React 19 + Vite 8 SPA, React Router 7, plain CSS tokens, `lucide-react` |
| Backend | Express 5 (`server/index.js`) + Vercel function (`api/index.js`) |
| Database | Supabase PostgreSQL via `@supabase/supabase-js`; service-role key server-side |
| Tables | `properties`, `enquiries` only (`supabase/schema.sql`) |
| Auth | **None** — no users, sessions, login, cookies, guards |
| Authorization | **None** — `/admin/*` is publicly reachable |
| Admin UI | Property list, create, edit only |
| Public UI | Home, Properties, Property details, About, Services, Contact |
| API | `/api/properties`, `/api/enquiries`, `/api/upload`, `/api/health`; errors `{ error: string }` |
| State | Context providers (`ToastProvider`, `PropertyProvider`) + service layer |
| Validation | `src/services/validation.js`, property-specific rules |
| Money | Single `currency` column per property; default `INR` |
| Files | `/api/upload` (property images) |
| Tests | Vitest + Testing Library + ESLint |
| Audit/notifications | None |
| Reporting | None |
| Seed | `src/data/properties.js` via `server/seed.js` |

Consequences:

- Anyone can open `/admin/properties` and mutate data.
- There is no company/tenant concept; a single implicit workspace owns all data.
- There is no way to model leads, customers, units inside projects, sales, rent, accounting or HR.
- Public enquiries are stored but never worked as a pipeline.

---

## 2. Demo coverage summary

| Domain | Demo modules | EstateVista | Gap |
|---|---|---|---|
| Auth & session | login, logout, forgot password, profile, password change, throttle | none | **Full** |
| Tenancy & access | company, branches, team, roles, 144 permissions | none | **Full** |
| Properties | projects, buildings, floors, units, phases, budgets, documents | flat `properties` only | **Large** |
| CRM & sales | leads, visits, customers, quotations, reservations, sales, installments, collections, commissions | none | **Full** |
| Rental | occupancy, tenants, leases, rent roll, collections, deposits, maintenance | none | **Full** |
| Payments | links, gateways (SSLCommerz/Stripe), online payments, refunds | none | **Full** |
| Construction | materials, stock, issues, laborers, attendance, contracts | none | **Full** |
| Purchasing | POs, purchases, suppliers, contractors | none | **Full** |
| Finance | expenses, income, payouts, bank/cash, transfers, loans | none | **Full** |
| Accounting | chart of accounts, journals, 11 reports | none | **Full** |
| HR | employees, attendance, leave, payroll, advances, setup | none | **Full** |
| Workspace | tasks, recurring tasks, approvals, notifications, delivery log | none | **Full** |
| Website CMS | inquiries, page content, articles, gallery, items, media, legal, settings | static React pages + property data | **Large** |
| Setup | company settings, languages, master data, categories, warehouses, audit | none | **Full** |
| Public site | projects, insights, legal, inquiry forms, locales | marketing pages | **Partial** |

Rough size: the demo has **74 authenticated routes** across 14 modules and dozens of entities; EstateVista has **10 routes** and 2 entities.

---

## 3. Architectural gaps

| Concern | Demo | EstateVista | Impact |
|---|---|---|---|
| Rendering | server-rendered Blade | SPA | SPA is fine; needs route guards, data loading and form error mapping |
| Auth | session + CSRF | none | Must be built before any admin work |
| Multi-tenancy | `company_id` everywhere | none | Schema-wide change; retrofitting later is expensive |
| IDs | UUID + human sequence | `VARCHAR` `PROP-###` | Need UUID/sequence strategy |
| Money | numeric, company currency, multi-account | numeric + per-row currency | Need currency/format settings |
| Accounting | double-entry, source-linked journals | none | Largest single engineering item |
| Files | controlled uploads per entity | single upload endpoint | Need document model + validation |
| Permissions | server-enforced matrix | none | Must enforce on API, not just menu |
| Audit | field-level before/after | none | Cross-cutting write hook |
| Notifications | matrix + templates + delivery log | none | Needs queue/worker |
| Scheduling | recurring tasks, reminders, rent/installment due jobs | none | Needs cron/queue |
| Search/filter | GET filters + pagination | basic filters | Needs a consistent list pattern |
| Errors | `{message, errors}` 422 | `{error}` | Need field-level validation contract |
| Testing | not observable | existing tests only for current UI | Each new module needs tests |

---

## 4. What can be reused

Worth keeping and extending:

- Vite/React shell, design tokens, responsive layout.
- `ToastProvider` pattern for feedback.
- Service-layer convention (`src/services/*ApiService.js`).
- Express router mounting and `api/index.js` Vercel export.
- Supabase client and service-role server pattern.
- Existing public pages as the basis of the future public site (projects/insights/contact).
- Existing property form/table patterns as the visual/UX baseline for new CRUD screens.
- Vitest/Testing Library and ESLint setup.

Worth replacing or generalising:

- `properties` flat table → `projects` + `buildings` + `floors` + `units` (keep a compatibility view for the public site during migration).
- `enquiries` → `website_inquiries` linked to `leads`.
- `{ error }` API shape → field-level errors + consistent success envelope.
- Unguarded `/admin` → authenticated `/app` (or keep `/admin` but guard it).
- `PropertyProvider` as the only domain context → per-module hooks/services; avoid one global provider.

---

## 5. Scope options

Because full parity is a multi-month product build, the implementation should be explicitly scoped. Options:

### Option A — Full parity programme (all 14 modules)

- Every documented route and flow, including accounting, payroll, gateways and CMS.
- Realistic effort: very large; needs multiple delivery phases and probably a team.
- Risk: long time before anything is usable; high chance of drift from the demo.

### Option B — Operational MVP (recommended)

A coherent slice that a real-estate company can run day to day:

1. **Foundation**: auth, company, branches, team, roles/permissions, settings (localization + numbering), audit log, file uploads.
2. **Inventory**: projects, buildings, floors, units, unit types, project detail tabs (overview/units/construction/budget/documents).
3. **CRM & sales**: leads, visits, customers, quotations, reservations, sales, installment schedule, collections, commissions (basic rules).
4. **Rental basics**: tenants, leases, rent schedule, rent collections, deposits.
5. **Dashboard**: KPIs and lists backed by the above.
6. **Public bridge**: property/project pages + inquiry/visit forms → leads.

Excludes in MVP: full double-entry accounting/reports, purchasing/stock, construction labour, HR/payroll, payment gateways, website CMS beyond project content, notifications beyond in-app.

### Option C — Commercial + finance-first

Option B plus expenses, income, bank/cash, chart of accounts, journals and the core reports (P&L, balance sheet, trial balance, receivables/payables). Excludes construction, purchasing, HR, payroll.

### Option D — Demo showcase only

Rebuild the navigation, dashboard and representative CRUD screens with sample data, no real workflows. Fast, but does not satisfy “equivalent functionality”.

---

## 6. Recommended scope and rationale

**Recommendation: Option B, delivered in vertical slices, with Option C as a follow-on.**

Why:

- Auth and tenancy are prerequisites for every other module; without them nothing else is safe.
- Projects/units + sales pipeline is the product's commercial core and produces the dashboard numbers.
- Rental is a smaller, self-contained addition that reuses the receipt/collection engine.
- Accounting, purchasing and HR are large enough to be separate programmes; attempting them in the first pass would delay a usable product and increase regression risk.
- The documented API/data model are complete enough to add those modules later without rework if `company_id`, journal posting hooks and the audit hook are designed in from day one.

If the user wants full parity, we should still build Option B first and treat C→full parity as sequential phases.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope explosion | Fixed phase scope + acceptance criteria per module; no “while we're here” additions. |
| Retrofitting tenancy | Add `company_id` and RLS/scope checks in the first migration. |
| Accounting bolted on late | Post journal entries from day one for sales/rent/expenses, even before reports exist. |
| Permission bypass | Central authorization middleware + tests for every route. |
| Data loss during property migration | Keep `properties` until the new project/unit model is live; migrate with a script and a compatibility view. |
| Demo drift | Treat docs as the spec; mark assumptions and validate them in tests, not by re-scraping. |
| UI becoming a look-alike | Use the demo's structure/information architecture only; keep EstateVista tokens, typography and assets. |
| Payment/gateway secrets | Store server-side encrypted; never send to the client; use sandbox in dev. |
| Notification spam | Company matrix + per-user opt-out + delivery log + idempotency. |

---

## 8. Gaps that must be closed before coding any feature

1. **Auth + session** (login, logout, guard, password change, throttle).
2. **Company/tenant context** on every table and query.
3. **Role/permission middleware** and seeded roles.
4. **Consistent API contract** with field-level errors.
5. **Number-sequence service** used by every new record.
6. **Audit hook** on create/update/delete.
7. **File/document model** with validation.
8. **Migration strategy** for existing `properties` and `enquiries` data.
9. **Test harness** for API + UI of each new module.
10. **Settings** for currency, timezone, date/number format (used everywhere).

Anything built before these will need rework.

---

## 9. Explicit non-goals for the first implementation phase (unless approved)

- Copying the demo's visual design, branding, copy or assets.
- Demo-only behaviour: demo credential buttons, global delete blocking, seeded fake data.
- SSLCommerz/Stripe live integration (sandbox only if Option C+ is approved).
- SMS/WhatsApp providers (email + in-app first).
- Multi-currency transactions (single company currency first).
- Payroll tax engines and statutory compliance.
- Bank feeds/reconciliation.
- Native mobile apps.

---

## 10. Definition of done for the gap closure

A flow is “closed” only when:

1. the route exists and is permission-guarded;
2. the API validates input with field-level errors;
3. create/update/delete (or void/deactivate) is audited;
4. list filters/pagination match the documented semantics;
5. money/date formatting follows company settings;
6. an end-to-end test covers the happy path and the main validation failure;
7. the Phase 4 checklist maps the documented flow to the implemented test.
