# 04 — API and request contract

The demo is a **server-rendered Laravel application**, not a JSON API. “API” here means the HTTP contract a browser uses: document routes, form POSTs, AJAX calls, redirects and error shapes. The reimplementation can expose a JSON API, but it must preserve the same operations and validation semantics.

All observations are from normal use of the demo company account. Nothing was fuzzed.

---

## 1. Global conventions

| Concern | Observed behaviour |
|---|---|
| Base URL | `https://estateflow.devintime.com` |
| Protected prefix | `/company/*` (guest requests redirect to `/login`) |
| Auth | Session cookie + CSRF token |
| CSRF field | hidden `_token` on every form; `<meta name="csrf-token">` for AJAX |
| AJAX header | `X-CSRF-TOKEN: <meta token>` |
| AJAX accept | `Accept: application/json` |
| Method spoofing | hidden `_method=PUT|PATCH|DELETE` inside POST forms |
| Form encoding | `application/x-www-form-urlencoded` or `multipart/form-data` when files exist |
| Success (AJAX) | `200` `{ "message": "…", "redirect": "…" }` |
| Validation (AJAX) | `422` `{ "message": "…", "errors": { "field": ["…"] } }` |
| Demo delete | `403` `{ "message": "This action is disabled in the demo version." }` |
| Non-AJAX success | `302` redirect (usually back to the list or the new record) |
| Non-AJAX validation | `302` back with flashed errors and old input |
| Unauthenticated | `302` → `/login` |
| Missing route | `404` HTML (`Page not found · Acme Realty`) |
| Rate limit (login) | `x-ratelimit-limit: 10`, `x-ratelimit-remaining: n` |
| IDs | UUIDv7 in URLs; human reference numbers in UI |
| Dates (wire) | ISO `yyyy-mm-dd`; display `dd/mm/yyyy` (configurable) |
| Money (wire) | decimal numbers; display with currency symbol and configured decimals |
| Pagination | `?page=n`; 20 rows default, 25 for schedules/journals, 8–18 for small catalogues |

### 1.1 Typical AJAX create

```http
POST /company/leads HTTP/1.1
Content-Type: multipart/form-data; boundary=…
X-CSRF-TOKEN: …
Accept: application/json

_token=…&name=…&phone=…&status=new&…
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"message":"Lead created successfully.","redirect":"https://…/company/leads"}
```

### 1.2 Typical AJAX validation failure

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/json

{
  "message": "The name field is required. (and 1 more error)",
  "errors": {
    "name": ["The name field is required."],
    "phone": ["The phone field is required when email is not present."]
  }
}
```

### 1.3 Typical update

```http
POST /company/leads/{uuid}
_method=PUT
…
```

### 1.4 Typical delete

```http
POST /company/leads/{uuid}
_method=DELETE
```

Demo response: `403` (see above). A production implementation should use a real `DELETE` or a soft-delete action with authorization.

---

## 2. Auth endpoints

| Method | Path | Purpose | Observed response |
|---|---|---|---|
| GET | `/login` | Login page | `200` HTML, sets session + XSRF cookie, form `_token` |
| POST | `/login` | Authenticate | `302 /company/dashboard`; rate-limited |
| GET | `/forgot-password` | Request reset link | `200` HTML |
| POST | `/forgot-password` | Send reset link | not exercised |
| POST | `/logout` | End session | `302 /login` |
| GET | `/register` | — | `404` |
| GET | `/language/{ar\|en\|fr}` | Switch UI language | redirect back |
| GET | `/company/profile` | Profile page | `200` |
| POST | `/company/profile` | Update profile | multipart |
| POST | `/company/profile/password` | Change password | `current_password`, `password`, `password_confirmation` |
| GET | `/company/notifications/feed` | Bell feed | JSON (shape inferred) |
| POST | `/company/notifications/{id}/read` | Mark one read | JSON |
| POST | `/company/notifications/read-all` | Mark all read | JSON |

Login fields: `_token`, `email`, `password`, optional `remember=1`.

---

## 3. Route → operation catalogue

Every module follows the same five-operation shape unless noted:

| Operation | Method + path | Notes |
|---|---|---|
| List | `GET /company/{resource}` | GET filters + pagination |
| Create form | `GET /company/{resource}/create` | full-page form (only where observed) |
| Create | `POST /company/{resource}` | form or AJAX |
| Detail | `GET /company/{resource}/{uuid}` | where a detail page exists |
| Edit form | `GET /company/{resource}/{uuid}/edit` | full-page edit |
| Update | `POST /company/{resource}/{uuid}` + `_method=PUT` | |
| Delete | `POST /company/{resource}/{uuid}` + `_method=DELETE` | demo-blocked |
| Modal create/update | `POST` to `data-action` | many small entities |

### 3.1 Confirmed create pages

`GET .../create` returned `200` and a form for:

`/company/projects`, `/company/quotations`, `/company/sales`, `/company/leases`, `/company/material-issues`, `/company/purchase-orders`, `/company/purchases`, `/company/journals`, `/company/roles`.

`/company/units/create` and `/company/website/posts/create` returned **404**; those entities are created from their parent context or a modal.

### 3.2 Module endpoint map

| Resource | List | Detail | Create | Update | Notes |
|---|---|---|---|---|---|
| Projects | `/company/projects` | `/company/projects/{uuid}` | `/company/projects/create` | `/company/projects/{uuid}` | cards; buildings/floors/units sub-actions |
| Units | `/company/units` | `/company/units/{uuid}` (inferred) | project context | same | no global create |
| Leads | `/company/leads` | `/company/leads/{uuid}` | modal | `_method=PUT` | create/update/delete observed |
| Site visits | `/company/visits` | — | modal | — | schedule/complete/cancel |
| Customers | `/company/customers` | `/company/customers/{uuid}` (inferred) | modal | — | |
| Quotations | `/company/quotations` | `/company/quotations/{uuid}` (inferred) | `/company/quotations/create` | — | `?lead={uuid}` prefill |
| Reservations | `/company/reservations` | — | modal | — | convert/cancel |
| Sales | `/company/sales` | `/company/sales/{uuid}` | `/company/sales/create` | — | receive payment, handover, cancel |
| Installments | `/company/installments` | — | generated | reschedule/waive | 25/page |
| Collections | `/company/collections` | receipt (inferred) | modal | void/refund | auto-allocate |
| Commissions | `/company/commissions` | — | rule modal | — | rules + ledger |
| Tenants | `/company/tenants` | — | modal | — | |
| Leases | `/company/leases` | `/company/leases/{uuid}` | `/company/leases/create` | — | renew/revise/terminate |
| Rent roll | `/company/rent-roll` | — | generated | — | |
| Rent collections | `/company/rent-collections` | — | modal | void | |
| Deposits | `/company/deposits` | — | from lease | deduct/refund | |
| Maintenance | `/company/maintenance` | — | modal | assign/complete/cancel | |
| Payment links | `/company/payment-links` | public link | modal | cancel | |
| Online payments | `/company/online-payments` | — | gateway callback | refund/void | webhooks |
| Refunds | `/company/refunds` | — | from receipt/payment | — | |
| Materials | `/company/materials` | — | modal | edit | |
| Stock | `/company/inventory` | — | movement/transfer/adjust | — | |
| Material issues | `/company/material-issues` | — | `/company/material-issues/create` | approve/issue/reject | |
| Laborers | `/company/laborers` | — | modal | — | |
| Labor attendance | `/company/attendance` | — | save register | — | project + date |
| Contracts | `/company/contracts` | — | `New contract` | — | |
| Tasks | `/company/tasks` | — | modal | status/progress | |
| Recurring tasks | `/company/recurring-tasks` | — | modal | — | generator |
| Approvals | `/company/approvals` | — | from modules | approve/reject | note required |
| Notifications | `/company/notifications` | — | system | read | feed/read-all |
| Notification settings | `/company/notification-settings` | — | template modal | save matrix | |
| Delivery log | `/company/notification-logs` | — | system | — | |
| Purchase orders | `/company/purchase-orders` | — | `/company/purchase-orders/create` | approve | receive |
| Purchases | `/company/purchases` | — | `/company/purchases/create` | — | creates stock + payable |
| Suppliers | `/company/suppliers` | — | modal | — | |
| Contractors | `/company/contractors` | — | modal | — | |
| Expenses | `/company/expenses` | — | modal | void | |
| Other income | `/company/incomes` | — | modal | void | |
| Payouts | `/company/payouts` | — | modal | void | six payee types |
| Bank & cash | `/company/transfers` | account statement (inferred) | transfer modal | void | |
| Loans | `/company/loans` | — | modal | — | schedule |
| Chart of accounts | `/company/accounts` | — | modal | — | |
| Journal entries | `/company/journals` | `/company/journals/{uuid}` | `/company/journals/create` | — | reverse-only |
| Reports | `/company/reports/{report}` | — | — | — | GET filters, `?print=1` |
| Employees | `/company/hr/employees` | — | modal | — | |
| HR attendance | `/company/hr/attendance` | — | save register | — | |
| Leave | `/company/hr/leaves` | — | modal | decide | |
| Payroll | `/company/hr/payroll` | — | run modal | approve/pay | |
| Advances | `/company/hr/advances` | — | modal | approve | |
| HR setup | `/company/hr/setup` | — | modals | — | |
| Website inquiries | `/company/website/inquiries` | — | public form | open lead | |
| Page content | `/company/website/content/{page}` | — | — | `POST` per page/locale | |
| Articles | `/company/website/posts` | — | modal | — | no create page |
| Gallery | `/company/website/gallery` | — | modal | — | |
| Website items | `/company/website/items/{type}` | — | modal | — | 4 types |
| Listing photos | `/company/website/media` | — | modal | alt modal | |
| Legal | `/company/website/legal` | — | — | `POST` | per locale |
| Website settings | `/company/website/settings` | — | — | `POST` | |
| Team | `/company/team` | — | modal | — | deactivate |
| Roles | `/company/roles` | — | `/company/roles/create` | `/company/roles/{uuid}/edit` | matrix |
| Branches | `/company/branches` | — | modal | — | |
| Settings | `/company/settings?tab=…` | — | — | `POST /company/settings/{tab}` | seven tabs |
| Languages | `/company/languages` | — | modal | — | `Set as default` |
| Master data | `/company/lookups` | — | modal | — | 7 lists |
| Material categories | `/company/material-categories` | — | modal | — | |
| Warehouses | `/company/warehouses` | — | modal | — | |
| Expense categories | `/company/expense-categories` | — | modal | — | |
| Audit log | `/company/audit-logs` | — | — | — | read-only |

Paths in this table were observed in navigation, page links or forms. Where a detail/create path was never linked, it is marked inferred.

---

## 4. Module-specific action endpoints (observed or strongly implied)

### Sales

| Action | Endpoint shape |
|---|---|
| Generate schedule | side effect of `POST /company/sales` |
| Receive payment | modal → `POST /company/collections` |
| Reschedule installment | `POST /company/installments/{id}/reschedule` (inferred) |
| Waive installment | `POST /company/installments/{id}/waive` (inferred) |
| Send payment link | `POST /company/installments/{id}/payment-link` (inferred) |
| Handover | `POST /company/sales/{uuid}/handover` (inferred) |
| Cancel sale | `POST /company/sales/{uuid}/cancel` (inferred) |

### Rental

| Action | Endpoint shape |
|---|---|
| Generate rent schedule | side effect of lease activation |
| Receive rent | `POST /company/rent-collections` |
| Extra charge / discount / waiver | `POST /company/rent-schedules/{id}/adjustment` (inferred) |
| Renew / revise / terminate | `POST /company/leases/{uuid}/{action}` (inferred) |
| Deposit deduct/refund | `POST /company/deposits/{id}/{action}` (inferred) |

### Finance

| Action | Endpoint shape |
|---|---|
| Void expense/income/payout/transfer | `POST /company/{resource}/{uuid}/void` with `reason` (inferred) |
| Reverse journal | `POST /company/journals/{uuid}/reverse` with `reason` (inferred) |
| Record supplier payment | `POST /company/payouts` with payee type supplier (inferred) |

### Website

| Action | Endpoint shape |
|---|---|
| Save page content | `POST /company/website/content/{page}?locale={locale}` (observed action without query, locale likely in form) |
| Save legal | `POST /company/website/legal` (per locale) |
| Save settings | `POST /company/website/settings` |
| Convert inquiry | `POST /company/website/inquiries/{id}/lead` (inferred) |

Exact action paths for row-level operations were not captured because the demo blocks or the UI uses `data-action` populated by JS.

---

## 5. Upload contract

- Forms with files use `multipart/form-data`.
- Observed file fields: `logo`, `favicon`, `avatar`, project/unit photos, website `images[key]`, article `cover`, gallery `image`, website item `image`, media `file`, project documents.
- Image copy limits: profile avatar max 1 MB; website page images max 5 MB; website logos max 2 MB; accepted JPG/PNG/WebP (SVG allowed for logos).
- **ASSUMPTION:** files are validated server-side by MIME and size, stored outside the web root with generated names, and served through a controlled URL.

---

## 6. Error and status semantics

| Status | Meaning in this product |
|---|---|
| 200 | HTML page, or JSON success for AJAX |
| 302 | Post/Redirect/Get success or auth redirect |
| 403 | Demo guard on delete; also expected for missing permission |
| 404 | Unknown route/record |
| 419 | CSRF/session expired (Laravel convention; not observed) |
| 422 | Validation errors with field map |
| 429 | Login throttle (headers observed; body not) |
| 500 | Server error page (not induced) |

Field errors are Laravel-style sentences and always arrays, even for one message.

---

## 7. Data-format rules

- Decimal money; no thousands separators on the wire.
- Percent values are numbers (e.g. `discount_approval_percent`), not strings with `%`.
- Dates `yyyy-mm-dd`; datetimes for publish fields include time (UI `dd/mm/yyyy HH:mm`).
- Booleans: checkbox `1`/absent; JSON `true/false`.
- Enums: snake_case values (`mixed_use`, `visit_scheduled`, `partly_paid` where applicable).
- Multi-select: `name[]` arrays (`role_ids[]`, `utilities_included[]`).
- Repeaters: `items[0][material_id]`, `lines[0][debit]`, with contiguous indexes.
- Polymorphic payee: `payee_type` + `payee_id`.
- Locale: query `?locale=en` on content screens; language switch uses `/language/{code}`.

---

## 8. Reimplementation contract proposal

For EstateVista, keep the same **resource semantics** but use a JSON API under `/api`:

```http
GET    /api/{resource}?filters&page
POST   /api/{resource}
GET    /api/{resource}/:id
PATCH  /api/{resource}/:id
DELETE /api/{resource}/:id
POST   /api/{resource}/:id/{action}
```

Response envelope:

```json
{ "data": {}, "message": "…" }
```

Validation: `422 { "error": "Validation failed", "fields": { "name": "Required" } }` or keep the Laravel-compatible `{message, errors}` shape if the React client is written to it. Pick one and use it consistently; the current EstateVista API uses `{ error: string }`, which is too weak for form field mapping.

Auth: secure, HttpOnly session cookie or JWT; CSRF protection for cookie auth. Never expose gateway/SMTP secrets.

The existing EstateVista conventions (service layer + Express routers + Supabase) can implement this without copying the demo's server-rendered architecture.

---

## 9. Not observed

- JSON payloads for most modules (the demo returns HTML).
- Exact row-action URLs generated by `data-action`.
- Webhook payloads from SSLCommerz/Stripe.
- Rate limits other than login.
- File download/streaming contract.
- Pagination metadata shape.
- Sort parameters (headers looked sortable; links not captured).
- Bulk action endpoints.
- Export endpoints.

Any client built against this document should treat the route/field names as authoritative and the action endpoint names as **ASSUMPTION** until implemented and tested.
