# Release 1 verification checklist

Date: 2026-11-17
Branch: `feat/r1-core-ops`
Scope: approved Release 1 — Core Operations MVP
Last implementation commit: `b13d18e` (`feat: bridge public inquiries into CRM leads (WP8)`)

This checklist maps every flow documented during Phase 1 to its Release 1 status. It is a
verification map, not a claim that every demo feature was rebuilt: the approved scope in
`07-implementation-plan.md` deliberately defers the modules listed in section J.

## Status legend

| Status | Meaning |
|---|---|
| **Implemented** | Shipped in R1 and covered by automated tests plus the named work-package manual run. |
| **Implemented (automated)** | Shipped and covered by automated tests; no separate manual run was recorded. |
| **Partial** | A useful subset shipped; the remaining documented behaviour is stated in the row. |
| **Deferred** | Documented demo behaviour outside approved R1, mapped to a later release. |
| **Not copied** | Demo-only artefact or unobservable behaviour intentionally not reproduced. |

## Evidence baseline

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | pass, 0 errors |
| Client tests | `npm test -- --run` | pass, 17 files, 107 tests |
| Server tests | `npm run test:server` | pass, 17 files, 150 tests |
| Manual cycles | `PROGRESS.md` and the SDD ledger | WP1–WP8 browser/API checks recorded |

Server suites: `auth`, `admin`, `inventory`, `crm`, `sales`, `rental`, `dashboard`,
`notifications`, `websiteInquiries`. Client suites include auth guard, login, property pages,
property form, upload modal and the module selectors.

---

## A. Platform, authentication and access

Document sources: `01-overview.md`, `02-auth.md`, `04-api-contract.md`, `05-data-model.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Login page and email/password request | Implemented | `/login`, `authApiService`; `auth.test.js`; WP1 browser login |
| Invalid-credential response | Implemented (automated) | Generic `Invalid email or password.` asserted in `auth.test.js` |
| Login throttling (`429`) | Implemented (automated) | Throttle test in `auth.test.js` |
| Session validation and guest guard | Implemented | `AuthProvider`/`ProtectedRoute`; `auth.test.js`; WP1, WP8 redirect checks |
| Logout and session destruction | Implemented | Account menu, `POST /api/auth/logout`; `auth.test.js`; WP1/WP8 browser |
| Change password | Partial | `POST /api/auth/password` and test exist; no personal-profile UI in R1 |
| Forgot password | Deferred | R1 plan allowed only a placeholder; email delivery is deferred and no fake send was built |
| Personal profile (name/email/avatar/password screen) | Deferred | Company profile settings exist; no per-user profile page |
| Roles, permissions and server enforcement | Implemented | 70 permissions, 10 default roles; per-module `403` tests; WP1/WP2/WP5/WP6/WP8 manual denials |
| Localization and direction | Partial | Company currency, timezone and date format are editable; no per-user language switch or public RTL toggle |
| Scrypt passwords, hashed session tokens, HttpOnly cookie, CSRF | Implemented | Auth tests; session contract 30-day absolute / 8-hour idle |
| Admin shell, grouped sidebar and mobile drawer | Implemented | `AdminLayout`; WP1/WP2 browser checks; nav filtered by permission |
| Global API error contract (`{ error, fields? }`) and status semantics | Implemented | Shared error middleware; asserted across server suites |
| Public site and property pages remain public | Implemented | Legacy `/properties` pages; WP8 contact/property form run |
| Legacy property admin CRUD and image upload | Partial | Existing `/api/properties`, `/api/upload`, `AdminProperty*` remain; R1 added no server regression suite for them and did not rerun the full CRUD manually |
| Complete demo module API catalogue | Partial | R1 modules are implemented; non-R1 modules are listed in section J |

## B. Settings, team, roles, branches and audit

Document sources: `03-pages/13-operation-team.md`, `03-pages/14-setup-settings.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Company profile settings | Implemented | `/admin/settings?tab=profile`; `admin.test.js`; WP2 manual persistence |
| Localization settings | Implemented | Currency/timezone/date format tab; `admin.test.js`; WP2 manual |
| 30 configurable number sequences | Implemented | Numbering tab; prefix/padding/reset/preview; `admin.test.js`; WP2 manual |
| Sales settings tab | Deferred | Not exposed in R1 settings UI/API |
| Rental settings tab | Deferred | Not exposed in R1 settings UI/API |
| Sales and rental defaults that pre-fill forms and schedules | Deferred | Forms use built-in defaults; no settings-backed default configuration |
| Payment gateway settings | Deferred | Gateways are an R1 non-goal |
| SMTP settings and test send | Deferred | Email delivery is an R1 non-goal |
| Languages CRUD | Deferred | No language-management screen |
| Master-data/lookup management | Partial | `/api/lookups` is read-only; catalogues are seeded and consumed by forms, with no admin CRUD |
| Material categories, expense categories, warehouses | Deferred | Depend on construction/finance modules |
| Notification settings, templates and delivery log | Deferred | Only in-app notifications shipped |
| Audit log with before/after diff and filters | Implemented | `/admin/audit-logs`; `admin.test.js`; WP2 manual filters/diff |
| Team list with access mode, roles, branch and last login | Implemented | `/admin/team`; `admin.test.js`; WP2 manual |
| Invite/edit member with full access or roles and password confirmation | Implemented | Team modal; `admin.test.js`; WP2 manual |
| Deactivate/reactivate instead of delete; self-protection | Implemented | Team status actions; `admin.test.js`; WP2 manual |
| Role CRUD with grouped matrix, select-all and live count | Implemented | `/admin/roles`; 70-key matrix; `admin.test.js`; WP2 manual |
| Seed equivalent default roles | Implemented | 10 roles shipped with R1 names/coverage; seeded by WP1 |
| Branches with code, contact, manager, active state and team count | Implemented | `/admin/branches`; `admin.test.js`; WP2 manual |
| Head Office delete guard and branch deactivation | Implemented | API `409`/self-protection checks; WP2 manual |
| Audit entries for team, role, branch and setting changes | Implemented | Audit writes in each route; WP2 manual entries |
| Every setting change permission-checked and audited | Partial | Profile, localization and numbering are checked and audited; the deferred tabs do not exist |

## C. Inventory: projects, buildings, floors and units

Document source: `03-pages/02-properties.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Project card list with search/type/status filters and counts | Implemented | `/admin/projects`; `inventory.test.js`; WP3 manual |
| Project create/edit core fields | Implemented | Name, code, type, status, city/locality/address, coordinates, budget, booking, land area, currency, dates, branch, manager, description, amenities, specifications, nearby places, payment note, publish/featured |
| Project website slug/summary fields | Deferred | Public project pages and website CMS are outside R1 |
| Project detail Overview with inventory KPIs and status distribution | Implemented | `/admin/projects/:id`; `inventory.test.js`; WP3 manual |
| Project detail Units tab | Implemented | Units board with filters and actions; WP3 manual |
| Project detail Buildings tab and floor hierarchy | Implemented | Building/floor CRUD; `inventory.test.js`; WP3 manual |
| Project detail Documents tab | Implemented | Private bucket upload/list/delete; `inventory.test.js`; WP3 manual |
| Project detail Construction tab | Deferred | Construction module is an R1 non-goal |
| Project detail Budget & costs tab | Deferred | Budget is stored/shown; cost transactions belong to finance |
| Bulk unit generation from floor/number tokens | Implemented | `GenerateUnitsModal`, `{floor}`/`{number}`; `inventory.test.js`; WP3 manual `A-101`…`A-202` |
| Single unit create/edit | Implemented | Unit modal; `inventory.test.js`; WP3 manual |
| Seven unit statuses and allowed transitions | Implemented | Draft, Available, Reserved, Sold, Rented, Blocked, Under maintenance; selector tests; WP3 manual |
| Unit status history with actor and reason | Implemented | History drawer; `inventory.test.js`; WP3 manual |
| Unit inventory list with project/building/type/status/search filters | Implemented | `/admin/units`; `inventory.test.js`; WP3/WP7 manual |
| Project and unit deletes: soft delete and referential guards | Implemented | Project `409` with units; unit blocked by active contracts; WP3 manual |
| Unit photo manager | Partial | Generic private documents work; no dedicated photo/alt-text manager |
| No global unit-create route | Implemented | Units are created from project context |

## D. CRM: leads, visits and customers

Document source: `03-pages/03-sales.md`, sections 1–3.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Lead list with search, stage, source, assignee and project filters | Implemented | `/admin/leads`; `crm.test.js`; WP4 manual |
| Lead create/edit/delete with phone-or-email validation | Implemented | Lead modal; `crm.test.js`; WP4 manual |
| Lost stage requires a reason and clears on reopen | Implemented | Stage rules; `crm.test.js`; WP4 manual |
| Lead detail with seven-stage stepper and activity timeline | Implemented | `/admin/leads/:id`; `crm.test.js`; WP4 manual |
| Follow-up create/complete | Implemented | Activity panel; `crm.test.js`; WP4 manual |
| Convert lead to customer, one customer per lead, duplicate `409` | Implemented | Conversion action; `crm.test.js`; WP4 manual |
| Delete converted customer clears `lead_id` and allows re-conversion | Implemented | `crm.test.js`; WP4 manual |
| Site visits with upcoming/past views and filters | Implemented | `/admin/visits`; `crm.test.js`; WP4 manual |
| Visit scheduling, lifecycle statuses and delete | Implemented | Scheduled/completed/cancelled/no-show; WP4 manual |
| Customers list/search/type/source | Implemented | `/admin/customers`; `crm.test.js`; WP4 manual |
| Customer create/edit/delete and validation | Implemented | Customer modal; `crm.test.js`; WP4 manual |
| Customer `units_bought` and `balance_due` rollups | Partial | Columns remain `0`; sale-level balances exist, customer totals are deferred |
| Lead-to-quotation shortcut | Implemented | `/admin/quotations?lead=`; WP5 manual; query parameter persists on reload |
| CRM notifications for assignment and stage change | Implemented | `lead.assigned`, `lead.stage_changed`; WP7 manual |

## E. Sales engine

Document source: `03-pages/03-sales.md`, sections 4–10.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Quotation list, search, status and project filters | Implemented | `/admin/quotations`; `sales.test.js`; WP5 manual |
| Quotation create from customer or lead, with unit/price/discount/tax/dates | Implemented | Quotation modal; `sales.test.js`; WP5 manual |
| Quotation lifecycle `draft → sent → accepted/rejected/expired` | Implemented | Status actions; `sales.test.js`; WP5 manual |
| Accepted quotation conversion to sale | Implemented | Convert action; WP5 manual |
| Reservation list/create/cancel | Implemented | `/admin/reservations`; `sales.test.js`; WP5 manual |
| Reservation expiry/cancel releases the unit | Implemented | `sales.test.js`; WP5 manual |
| Reservation-to-sale conversion | Implemented | Convert action; WP5 manual |
| Sale list, search, status/project/salesperson filters | Implemented | `/admin/sales`; `sales.test.js`; WP5 manual |
| Sale create with full or installment plan, discount, tax, down payment, grace and late fee | Implemented | Sale form and schedule; `sales.test.js`; WP5 manual |
| Schedule rounding on the final installment | Implemented | `server/lib/sales.js`; `sales.test.js` |
| Full-payment sale creates one installment on the agreement date | Implemented | `sales.test.js` |
| Sale detail, update, cancel and unit release | Implemented | `/admin/sales/:id`; `sales.test.js`; WP5 manual |
| Handover requires a zero open balance | Implemented | `422` guard; `sales.test.js`; WP5 manual |
| Installment list with aging, status and date filters | Implemented | `/admin/installments`; `sales.test.js`; WP5 manual |
| Installment reschedule, waive and pay | Implemented | Row actions; `sales.test.js`; WP5 manual |
| Collections list and receipt creation with auto-allocation | Implemented | `/admin/collections`; `sales.test.js`; WP5 manual |
| Over-allocation rejected with matching balance error | Implemented | `422` guard; `sales.test.js`; WP5 manual |
| Receipt detail and void reopening balances | Implemented | Void action; `sales.test.js`; WP5 manual |
| Commission rules CRUD and activation toggle | Implemented | `/admin/commissions`; `sales.test.js`; WP5 manual |
| Commission ledger status transitions | Implemented | Pending/approved/paid/cancelled (demo labels payable/paid/reversed mapped to R1 states) |
| Sale and collection notifications | Implemented | `sale.created`, `collection.received`; WP7 manual |
| Payment links, online payments and gateway refunds | Deferred | `03-pages/05-payments.md`; R1 non-goal |
| Quotation, receipt and agreement print/PDF layouts | Deferred | Exact layouts were not observed and are not in R1 |
| Accepted lead quotation prefills the sale customer | Partial | The quotation exposes only lead id/name; limitation recorded in WP5 |
| Void after handover removes the handover record | Partial | Balances reopen, but the historical handover date stays |

## F. Rental

Document source: `03-pages/04-rental.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Occupancy board and percentages | Deferred | Not observed in the demo and not in R1 |
| Tenant list with search/status filters | Implemented | `/admin/tenants`; `rental.test.js`; WP6 manual |
| Tenant create/edit with individual/company type and ID document fields | Implemented | Tenant modal; `rental.test.js`; WP6 manual |
| Tenant soft delete | Implemented | `rental.test.js` |
| Tenant detail page | Deferred | The demo page was not observed; the list/edit modal carries the data |
| Lease list, search, status/project/unit filters | Implemented | `/admin/leases`; `rental.test.js`; WP6 manual |
| Lease create with tenant/unit, term, frequency, rent, due day, grace, late fee, deposit and activate | Implemented | Lease modal; `rental.test.js`; WP6 manual |
| Lease numbering `LSE-YYYY-00001` | Implemented | Sequence helper; `rental.test.js` |
| Activation generates the rent schedule and marks the unit rented | Implemented | `rental.test.js`; WP6 manual |
| Rent schedule adjustments: extra charge, discount, waiver | Implemented | Schedule adjustment action; `rental.test.js` |
| Lease renewal with follow-on lease and old lease `renewed` | Implemented | WP6 manual `LSE-2026-00003` |
| Revise rent for future unpaid periods | Implemented | WP6 manual effective 2027-01-01 |
| Terminate lease, cancel future unpaid periods and release the unit | Implemented | WP6 manual |
| Lease expiry after `end_date` cancels future periods, moves the deposit to settlement and releases the unit | Implemented | Lease/rent-roll/dashboard reads run the expiry sweep; `rental.test.js`; arrears stay collectible |
| Rent roll with period/status/project filters and summary | Implemented | `/admin/rent-roll`; `rental.test.js`; WP6 manual |
| Rent collections with auto-allocation, receipt and void | Implemented | `/admin/rent-collections`; `rental.test.js`; WP6 manual |
| Shared `RCP-` receipt numbering with sales collections | Implemented | `rental.test.js`; WP6 manual |
| Security deposit receive/deduct/refund/history | Implemented | `/admin/deposits`; `rental.test.js`; WP6 manual |
| Deposit lifecycle `to_collect → held → awaiting_settlement → settled` | Implemented | `rental.test.js`; WP6 manual |
| Deposit rows across renewal | Partial | A renewal settles the old deposit and starts a fresh one; deposits are per lease |
| Unit status driven by lease lifecycle | Implemented | Activation/termination/expiry; `rental.test.js`; WP6 manual |
| Maintenance requests and assignments | Deferred | R1 non-goal |
| Recurring rent generation job | Deferred | Schedules are generated on activation; no scheduler |

## G. Dashboard v1

Document source: `03-pages/01-dashboard.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Four KPI cards with links and currency formatting | Implemented | Sales collected, overdue installments, rent collected, available units; `dashboard.test.js`; WP7 manual |
| Net-profit KPI | Deferred | Finance is an R1 non-goal; the fourth card is available units by approved WP7 design |
| 12-month income vs expense chart | Deferred | Requires finance data; not built |
| Unit inventory distribution and status deep links | Implemented | `dashboard.test.js`; WP7 manual |
| Installments-due list and sale/installment links | Implemented | `dashboard.test.js`; WP7 manual |
| Recent sales list and sale links | Implemented | Cancelled sales excluded; `dashboard.test.js`; WP7 manual |
| Project progress list and project links | Implemented | `dashboard.test.js`; WP7 manual |
| Lead pipeline counts and filtered lead links | Implemented | `dashboard.test.js`; WP7 manual |
| Personal tasks and approvals | Deferred | Workspace module is an R1 non-goal |
| Getting-started modal and persisted hide choice | Not copied | Not in the approved R1 plan |
| Per-module KPI/list visibility by permission | Implemented | `sections` + permission gating; `dashboard.test.js`; WP7 Sales Agent check |

## H. Notifications and workspace

Document source: `03-pages/07-workspace.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| In-app notification feed with unread count | Implemented | Bell in `AdminLayout`; `notifications.test.js`; WP7 manual |
| Mark one and mark all read | Implemented | Bell actions; `notifications.test.js`; WP7 manual |
| Assignment, stage, sale and collection notifications | Implemented | Four event keys; actor excluded; WP7 manual |
| Tasks with assignee/project/priority/due/progress/status | Deferred | R1 non-goal |
| Recurring task templates | Deferred | R1 non-goal |
| Approvals inbox with approve/reject and decision note | Deferred | R1 non-goal |
| Per-user channel preferences | Deferred | R1 non-goal |
| Notification templates by event/channel/language | Deferred | R1 non-goal |
| Delivery log with queued/sent/failed/skipped | Deferred | No outbound delivery in R1 |

## I. Website and public bridge

Document source: `03-pages/12-website.md`.

| Documented flow | Status | Evidence / notes |
|---|---|---|
| Website inquiry inbox with type filter and message detail | Implemented | `/admin/inquiries`; `websiteInquiries.test.js`; WP8 manual |
| Search and status filters, pagination, lead links | Implemented | WP8 manual type/search checks |
| Inquiry-to-lead conversion | Implemented | Replaced by automatic lead creation with `Website` source; retry heals a failed lead |
| Public contact form creates inquiry + lead | Implemented | `/contact`; WP8 manual Nadia Farouk |
| Public property enquiry creates inquiry + lead | Implemented | Property page; WP8 manual Omar Haddad |
| Public project inquiry page | Partial | API accepts `type=project`; no public project pages exist in R1 |
| Public visit request | Partial | API accepts `type=visit` and creates a lead; no `visits` row or scheduling UI |
| Duplicate-submission protection | Implemented | Per-form `submission_key`; WP8 replay `200 duplicate` |
| Page content editor and per-locale slots | Deferred | Full website CMS is an R1 non-goal |
| Insights articles | Deferred | Full website CMS is an R1 non-goal |
| Gallery | Deferred | Full website CMS is an R1 non-goal |
| Testimonials, FAQ, leadership and milestones | Deferred | Full website CMS is an R1 non-goal |
| Project/unit listing-photo manager | Deferred | Legacy property images exist; no project/unit media manager |
| Legal pages | Deferred | Full website CMS is an R1 non-goal |
| Website settings (tagline, social, logos, sharing image) | Deferred | Full website CMS is an R1 non-goal |
| Public site consumes the same content | Partial | Property pages use legacy data; CMS content is not wired |

## J. Deferred modules

These are documented in full but were explicitly excluded from Release 1 by the approved scope.
They remain mapped for later releases.

| Module | Documented flows | Status |
|---|---|---|
| Payments | Payment links, online payments, refunds | Deferred (R2+) |
| Construction | Materials, stock, material issues, laborers, attendance, contracts | Deferred (R2+) |
| Purchasing | Purchase orders, goods receipts, suppliers, contractors | Deferred (R2+) |
| Finance | Expenses, other income, payouts, bank/cash, loans | Deferred (R2+) |
| Accounting | Chart of accounts, journal entries, reports hub | Deferred (R2+) |
| HR | Employees, attendance, leave, payroll, advances, HR setup | Deferred (R2+) |
| Website CMS | Content, articles, gallery, testimonials, FAQ, leadership, milestones, media, legal, settings | Deferred (R2+) |
| Workspace | Tasks, recurring tasks, approvals, preferences, templates, delivery log | Deferred (R2+) |
| Rental extras | Occupancy board, maintenance requests, recurring rent generation | Deferred (R2+) |
| Finance-driven dashboard | Income/expense chart, net-profit KPI | Deferred (R2+) |

## K. Contract and data-model coverage

Document sources: `04-api-contract.md`, `05-data-model.md`.

| Area | Status | Evidence / notes |
|---|---|---|
| Identity/config tables: companies, users, sessions, roles, permissions, branches | Implemented | `001_foundation.sql`; auth/admin tests |
| Inventory tables: projects, buildings, floors, units, unit types, documents, status history | Implemented | `002_inventory.sql`, `008_inventory_defaults.sql`; `inventory.test.js` |
| CRM tables: leads, follow-ups, visits, customers, lookups | Implemented | `003_crm.sql`, `009_crm_defaults.sql`, `010_audit_events.sql`; `crm.test.js` |
| Sales tables: quotations, reservations, sales, installments, receipts, allocations, commissions | Implemented | `004_sales.sql`, `011_sales_defaults.sql`; `sales.test.js` |
| Rental tables: tenants, leases, rent schedule, rent receipts, deposits | Implemented | `005_rental.sql`, `012_rental_defaults.sql`; `rental.test.js` |
| Website inquiry table and bridge | Implemented | `006_public.sql`; `websiteInquiries.test.js` |
| Construction/purchasing/finance/accounting/HR tables | Deferred | Outside R1 |
| R1 enum catalogue and integrity rules | Implemented | Company scoping, unique keys, schedule/receipt guards asserted in suites |
| Error/status/data-format conventions | Implemented | Shared middleware and formatters; tests |
| Upload contract | Partial | Legacy property images and private documents work; a generic file manager was not built |

## L. Known limitations carried into sign-off

1. Customer `units_bought` and `balance_due` remain `0`; sale-level balances are authoritative.
2. An accepted lead quotation does not prefill the sale customer; `?lead=` persists on reload.
3. Voiding a receipt after handover reopens balances but leaves the handover date.
4. No occupancy board or bulk rent invoicing; deposits are per lease across renewals.
5. The notification bell refreshes on mount/open only; there is no live push.
6. Sales down payments are stored on the sale, not as receipts, so the receipt-based collection KPI excludes them.
7. Dashboard figures are company-wide, not branch-scoped.
8. Visit requests create an inquiry and lead but no `visits` row.
9. A public lead-creation failure is swallowed for the visitor and healed only on a key replay.
10. Public company resolution is environment-based and single-tenant; unknown slugs return `503`.
11. The website inquiry inbox is read-only.
12. Demo-only behaviour (blocked deletes, getting-started modal, net-profit KPI, chart) was not copied.
13. Company timezone and date format are stored but not applied to calculations or display; date-only strings parse as UTC. Treat them as display-only in R1.
14. The public inquiry throttle is an in-process fixed window (10 new submissions per IP per 10 minutes). It resets on restart and is not shared across instances. Client IPs come from Express `req.ip` using the `trust proxy` setting: one trusted hop on Vercel, none by default elsewhere, configurable through `TRUST_PROXY`. Only enable proxy trust behind an edge that overwrites or appends `X-Forwarded-For`.
15. Money-critical SQL (receipt post/void, rent post/void, deposit actions) is exercised through the in-memory repository in CI; a disposable-Postgres integration tier is still required before production.

## M. Review outcomes and sign-off checklist

Independent review of `0b5f06b..167b55b` returned "Ready to merge? With fixes" (2 Critical, 7 Important, 7 Minor). Dispositions:

| Finding | Outcome |
|---|---|
| C1 lease activation vs active sale/reservation | Fixed with regression test |
| C2 voiding a sale receipt after cancellation | Fixed in memory mirror and migration `013_review_fixes.sql` |
| I1 lease expiry sweep | Fixed on lease, rent-roll and dashboard reads; test covers future-period closure, arrears, deposit and unit release |
| I2 deposit atomicity | Fixed by `apply_deposit_transaction` in migration `014_deposit_atomicity.sql`; concurrency itself is not exercised without the Postgres tier |
| I3 shared-email login across companies | Fixed with two-company test |
| I4 public inquiry throttling | Fixed with in-process limiter and 429/replay tests |
| I5 unit status via PATCH | Fixed; status changes require `/status` |
| I6 unfiltered documents list | Fixed; owner context and module permission required |
| I7 Postgres integration tier | Deferred; no reachable disposable database |
| M1 deposit amount on lease edit | Fixed |
| M2 renewal start date | Fixed |
| M3 quotation edit guard and client payload | Fixed |
| M4 team role replacement | Improved (insert before delete); not fully transactional |
| M5 concurrent inquiry lead race | Fixed with conditional claim and orphan cleanup |
| M6 timezone/date format | Deferred and listed as limitation 13 |
| M7 sale quotation/reservation integrity | Fixed |
| Collections cross-module receipt access | Fixed; rent receipts are 404 on sales collections endpoints |

Post-fix verification: `npm run lint` clean; `npm test -- --run` 108 tests / 18 files; `npm run test:server` 164 tests / 17 files.

A second independent review of the final merged state `0b5f06b..2a6c0a0` returned "With fixes" with no Critical findings. Its two Important findings were fixed:

| Finding | Outcome |
|---|---|
| N1 client IP trust and unbounded limiter map | Fixed: `clientIp()` now uses only Express `req.ip`; `trust proxy` defaults to one hop on Vercel and none elsewhere, configurable via `TRUST_PROXY`; limiter buckets are capped and swept at most once per window; forged `X-Forwarded-For` regression test added |
| N2 M5 concurrency test did not reach the claim-failure path | Fixed: `attachLead` is exported and a deterministic false-claim test asserts the losing lead is deleted; the concurrent test now counts visible (non-deleted) leads |

Minor findings N3 (expiry route coverage, ambiguous shared-email branch) and N4 (silent lead-attachment failures) were also addressed: rent-roll and dashboard expiry tests, an ambiguous shared-email login test, and inquiry-id logging on capture failure were added.

Review-fix verification on `fix/review-2-hardening`: `npm run lint` clean; `npm test -- --run` 108 tests / 18 files; `npm run test:server` 175 tests / 18 files.



- [x] Phase 1 flows inventoried and mapped to a section above.
- [x] Every R1 work package has automated tests and a recorded manual cycle.
- [x] Deferred modules are named and tied to the approved R1 non-goals.
- [x] Known limitations are recorded rather than hidden.
- [x] Final sequential commands pass: lint, client tests, server tests.
- [x] Branch-level code review completed (independent reviewer; findings triaged above).
- [x] Second independent review of the merged state completed; no Critical findings, both Important findings fixed and covered by regression tests.
- [x] Merge/keep-branch decision recorded by the human partner: merge locally into `main` (merge commit `1559b29`), then delete `feat/r1-core-ops`. Post-merge verification: lint clean, client 108 tests / 18 files, server 164 tests / 17 files. Post-review-round-2 verification on the fix branch: lint clean, client 108 tests / 18 files, server 175 tests / 18 files.

## N. Document coverage index

| Phase 1 document | Covered in |
|---|---|
| `01-overview.md` | A (shell, navigation, access, public site) |
| `02-auth.md` | A |
| `03-pages/01-dashboard.md` | G |
| `03-pages/02-properties.md` | C |
| `03-pages/03-sales.md` | D and E |
| `03-pages/04-rental.md` | F |
| `03-pages/05-payments.md` | J |
| `03-pages/06-construction.md` | J |
| `03-pages/07-workspace.md` | H |
| `03-pages/08-purchasing.md` | J |
| `03-pages/09-finance.md` | J |
| `03-pages/10-accounting.md` | J |
| `03-pages/11-hr.md` | J |
| `03-pages/12-website.md` | I |
| `03-pages/13-operation-team.md` | B |
| `03-pages/14-setup-settings.md` | B |
| `04-api-contract.md` | A and K |
| `05-data-model.md` | K |
| `06-gap-analysis.md` | Scope in section J and limitations in L |
| `07-implementation-plan.md` | Evidence baseline and sections A–I |
