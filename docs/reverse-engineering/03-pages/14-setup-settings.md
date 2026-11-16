# 03-pages / Setup & settings

Routes: `/company/settings`, `/company/languages`, `/company/lookups`, `/company/material-categories`, `/company/warehouses`, `/company/expense-categories`, `/company/hr/setup`, `/company/notification-settings`, `/company/notification-logs`, `/company/audit-logs`, `/company/profile`.

This module holds company-wide configuration and the master data that every other module consumes.

---

## 1. Company settings (`/company/settings`)

Seven real tabs (observed): `profile`, `localization`, `numbering`, `sales`, `rental`, `payments`, `smtp`. `?tab=documents` and `?tab=identity` fall back to profile. Each tab is its own form and POST endpoint.

### 1.1 Profile (`?tab=profile`, `POST /company/settings/profile`)

Company identity, multipart form.

| Label | Name | Type |
|---|---|---|
| Company logo | `logo` | file |
| Favicon | `favicon` | file |
| Company name | `name` | text |
| Legal name | `legal_name` | text |
| Registration number | `registration_number` | text |
| Tax / VAT number | `tax_number` | text |
| Email | `email` | email |
| Phone | `phone` | text |
| Address | `address` | text |
| City | `city` | text |
| State / Region | `state` | text |
| Postal code | `postal_code` | text |
| Country | `country` | text |

**ASSUMPTION:** logo/favicon have size and MIME limits similar to website assets (PNG/SVG/JPG/WebP).

### 1.2 Localization (`?tab=localization`, `POST /company/settings/localization`)

| Label | Name | Type | Options |
|---|---|---|---|
| Currency | `currency` | select | 137 ISO-4217 currencies (`AED — UAE Dirham (د.إ)`, …) |
| Timezone | `timezone` | select | 419 IANA timezones |
| Date format | `date_format` | select | 12 formats, e.g. `Y-m-d`, `d-m-Y`, `m/d/Y`, `d/m/Y`, `Y/m/d`, `d.m.Y`, `m-d-Y`, `M j, Y` |
| Number format | `number_decimals` | select | 0 (`1,235`), 2 (`1,234.57`), 3 (`1,234.568`) |

Currency affects display and report formatting; timezone affects “today”, due-date and scheduler behaviour.

### 1.3 Numbering (`?tab=numbering`, `POST /company/settings/numbering`)

30 document sequences. Each row: document label, `sequences[n][prefix]`, `sequences[n][padding]`, `sequences[n][reset_period]` (`never`, `yearly`, `monthly`), plus a live preview.

Observed sequences:

| Document | Prefix | Digits | Reset |
|---|---|---|---|
| Contractor | `CTR-` | 4 | Never |
| Contractor bill | `BILL-` | 5 | Yearly |
| Contractor contract | `CON-` | 4 | Never |
| Customer | `CUS-` | 5 | Never |
| Employee | `EMP-` | 4 | Never |
| Employee advance | `ADV-` | 4 | Yearly |
| Expense | `EXP-` | 5 | Yearly |
| Income | `INC-` | 5 | Yearly |
| Journal entry | `JE-` | 6 | Yearly |
| Laborer | `LAB-` | 4 | Never |
| Lease | `LSE-` | 5 | Yearly |
| Loan | `LN-` | 4 | Never |
| Loan payment | `LNP-` | 5 | Yearly |
| Maintenance request | `MNT-` | 5 | Yearly |
| Material (SKU) | `MAT-` | 4 | Never |
| Material issue | `MI-` | 5 | Yearly |
| Payment receipt | `RCP-` | 6 | Yearly |
| Payout | `PAY-` | 5 | Yearly |
| Payroll run | `PR-` | 3 | Yearly |
| Project | `PRJ-` | 4 | Never |
| Purchase | `PUR-` | 5 | Yearly |
| Purchase order | `PO-` | 5 | Yearly |
| Purchase return | `PRN-` | 5 | Yearly |
| Quotation | `QT-` | 5 | Yearly |
| Refund | `RFD-` | 5 | Yearly |
| Reservation | `RSV-` | 5 | Yearly |
| Sale | `SAL-` | 5 | Yearly |
| Supplier | `SUP-` | 4 | Never |
| Tenant | `TEN-` | 5 | Never |
| Transfer | `TRF-` | 5 | Yearly |

Preview examples follow `<prefix><year?-><padded sequence>`: `SAL-2026-00070`, `PRJ-0007`, `JE-2026-000934`.

Yearly-reset sequences embed the year after the prefix; never-reset sequences do not.

### 1.4 Sales (`?tab=sales`, `POST /company/settings/sales`)

| Label | Name | Type | Notes |
|---|---|---|---|
| Reservation validity | `reservation_days` | number | days before an active reservation expires |
| Discount approval threshold | `discount_approval_percent` | number | discount above this triggers an approval request |
| Default due day | `due_day` | number | default installment due day |
| Grace period | `grace_days` | number | days before overdue |
| Late fee | `late_fee_type` | select | fixed amount / percentage of installment |
| Late fee value | `late_fee_value` | number | |

These defaults pre-fill the sale/lease forms and drive overdue/late-fee calculation.

### 1.5 Rental (`?tab=rental`, `POST /company/settings/rental`)

| Label | Name | Type |
|---|---|---|
| Default due day | `due_day` | number |
| Grace period | `grace_days` | number |
| Late fee | `late_fee_type` | select (fixed/percentage) |
| Late fee value | `late_fee_value` | number |
| Notice period | `notice_period_days` | number |
| Schedule horizon | `schedule_months` | number |
| Expiry reminder | `reminder_days` | number |

### 1.6 Payment gateways (`?tab=payments`, `POST /company/settings/payments`)

| Label | Name | Type | Notes |
|---|---|---|---|
| Default link validity | `link_expiry_days` | number | days |
| Email a receipt after every payment | `receipt_email` | checkbox | |
| SSLCommerz enabled | `gateways[sslcommerz][enabled]` | checkbox | |
| Store ID | `gateways[sslcommerz][store_id]` | text | |
| Store password | `gateways[sslcommerz][store_password]` | password | |
| Deposit account | `gateways[sslcommerz][account_id]` | select | cash/bank accounts |
| Sandbox mode | `gateways[sslcommerz][sandbox]` | checkbox | test payments only |
| Stripe enabled | `gateways[stripe][enabled]` | checkbox | |
| Secret key | `gateways[stripe][secret_key]` | password | |
| Webhook signing secret | `gateways[stripe][webhook_secret]` | password | |
| Deposit account | `gateways[stripe][account_id]` | select | |

Secrets are write-only in the UI (password inputs); they must never be returned to the browser in plaintext.

### 1.7 SMTP (`?tab=smtp`, `POST /company/settings/smtp`)

| Label | Name | Type |
|---|---|---|
| SMTP host | `smtp_host` | text |
| Port | `smtp_port` | number |
| Encryption | `smtp_encryption` | select (`tls`, `ssl`) |
| Username | `smtp_username` | text |
| Password | `smtp_password` | password |
| From email | `smtp_from_email` | email |
| From name | `smtp_from_name` | text |
| Test recipient | `test_email` | email |

A “send test email” action is implied by the test recipient field; delivery result was not observed. The delivery log shows real SMTP failures (550 response) for visit notifications.

---

## 2. Languages (`/company/languages`)

Table columns: `Language`, `Code`, `Locale`, `Direction`, `Status`, `Default`, actions.

Observed languages: English `en` / `en_US` / LTR / Active / Default; Arabic `ar` / `ar_SA` / RTL / Active; French `fr` / `fr_FR` / LTR / Active.

Add language modal:

| Label | Name | Type | Notes |
|---|---|---|---|
| Language * | `code` | select | ~100 world languages with flag emoji |
| Name | `name` | text | |
| Flag | `flag` | text | emoji or code |
| Locale | `locale` | text | e.g. `en_US` |
| Right-to-left (RTL) | `is_rtl` | checkbox | flips document direction |
| Active | `is_active` | checkbox | |

Actions: `Add language`, `Set as default` (per non-default row), edit, delete (not tested).

**ASSUMPTION:** exactly one default language; deactivating a language hides it from the switch but keeps existing content.

---

## 3. Master data (`/company/lookups`)

Catalogue cards, each with a count and an `Add item` action:

| List | Count in demo | Used by |
|---|---|---|
| Unit types | 7 | Units (Flat, Plot, Apartment, Office, Shop, Parking, Storage) |
| Lead sources | 6 | Leads (Website, Walk-in, Referral, Facebook, Phone call, Agent) |
| Labor categories | 6 | Laborers (Mason, Carpenter, Electrician, Plumber, Painter, Helper) |
| Contractor trades | 5 | Contractors, contracts (Civil, Electrical, Plumbing, Finishing, Steel) |
| Document categories | 8 | Documents/uploads |
| Maintenance categories | 6 | Maintenance (Plumbing, Electrical, Painting, Appliance, Cleaning, Other) |
| Support categories | 4 | Support (not otherwise exposed in the sidebar) |

Add/edit item modal (`#lookupModal`):

| Label | Name | Type |
|---|---|---|
| Name * | `name` | text |
| Colour | `color` | radio (7 swatches) |
| Sort order | `sort_order` | number |
| Active | `is_active` | checkbox |

Some lists mark a `Default item`. Items are per company and referenced by ID across modules.

---

## 4. Material categories (`/company/material-categories`)

Table: `Category`, `Parent category`, `Materials`, actions. 6 root categories: Bricks & blocks (`MC3`), Cement & aggregates (`MC1`), Electrical (`MC4`), Finishing (`MC6`), Plumbing & sanitary (`MC5`), Steel (`MC2`).

Add category modal:

| Label | Name | Type | Options |
|---|---|---|---|
| Name * | `name` | text | |
| Code | `code` | text | |
| Parent category | `parent_id` | select | None + categories (supports nesting) |

**ASSUMPTION:** category code is unique; a category with materials cannot be deleted.

---

## 5. Warehouses (`/company/warehouses`)

Card page. Summary: 3 warehouses, total stock value `$ 7,188,779`, 2 site stores, 97 stock movements.

Cards: name, code, status, type (Central store / Site store), project address, stock value, movement count, `View stock`.

Observed: `Lakeview site store` (`LVH-SITE`, site store, Lakeview Heights, $962,200, 26 movements), `Main Store` (`MAIN`, central store, $5,576,780, 45), `Skyline site store` (`STC-SITE`, site store, Skyline Trade Center, $649,799, 26).

Add warehouse modal:

| Label | Name | Type | Options |
|---|---|---|---|
| Name * | `name` | text | |
| Code * | `code` | text | |
| Project | `project_id` | select | **Central store** or a project (selecting a project makes it a site store) |
| Address | `address` | textarea | |
| Active | `is_active` | checkbox | |

---

## 6. Expense categories (`/company/expense-categories`)

Table: `Category`, `Budget category`, `Ledger account`, `Expenses`, `Total spent`, `Status`, actions. 8 categories.

Add category modal:

| Label | Name | Type | Options |
|---|---|---|---|
| Name * | `name` | text | |
| Code | `code` | text | |
| Budget category | `cost_category` | select | land, materials, labor, contractor, equipment, permits, utilities, marketing, administration, other |
| Ledger account | `account_id` | select | chart of accounts |
| Active | `is_active` | checkbox | |

Helper copy: “Each category posts to a ledger account and counts towards a line of the project budget.”

Observed mapping examples: Equipment rental → Equipment → `5100 Construction`; Land & registration → Land → `5100`; Marketing → Marketing → `5500 Administration`; Permits → Permits → `5500`.

---

## 7. HR setup (`/company/hr/setup`)

Also documented in `03-pages/11-hr.md` §6. Summary:

- Departments (`name`, `code`, active), designations (`name`, `department_id`, active), leave types (`name`, `code`, `days_per_year`, `is_paid`, active), allowances (fields not captured).
- Leave-type table: Leave type, Pay, Days per year, Requests, Status, actions (Annual, Casual, Sick, Unpaid).
- Actions: `Designation`, `Department`, `Add leave type`, `Add allowance`, `Save changes`.

---

## 8. Notification settings (`/company/notification-settings`)

Sections:

1. **Events & channels** — matrix `Event × In-app / Email / SMS / WhatsApp`, 34 rows including 8 group headings (Tasks, HR, Approvals, Sales, Rental, Payments, Finance, Documents). `Save changes`.
   Copy: “Choose which events send notifications and on which channels. People can turn off channels for themselves, but cannot turn on a channel you switch off here.”
2. **Message templates** — `New template` opens a modal:

| Label | Name | Type | Notes |
|---|---|---|---|
| Event | `event_key` | select | 26 observed event keys |
| Channel | `channel` | select | in-app, email, SMS, WhatsApp |
| Language | `locale` | select | per active language |
| Email subject | `subject` | text | |
| Message | `body` | textarea | placeholders inferred |
| Active | `is_active` | checkbox | |

3. **Reminders & SMS** — when reminders go out and the SMS provider (copy only; fields not captured).
4. Link to **Delivery log**.

Event catalogue (from the settings page and template select): task assigned / due soon / overdue / completed / comment; leave requested / decided; payslip issued; approval requested / decided; installment due / overdue / reminder / overdue notice; reservation expiring; website inquiry; website visit request; rent due / overdue / reminder / overdue notice; lease expiring; maintenance request; online payment received; loan repayment due; document expiring.

---

## 9. Delivery log (`/company/notification-logs`)

Columns: `Sent`, `Event`, `Recipient`, `Channel`, `Subject`, `Status`.

Filters: `search` (recipient/subject), `event_key`, `channel` (In-app, Email, SMS, WhatsApp), `status` (Queued, Sent, Failed, Skipped). 25 rows.

Observed channels render as e.g. `Email smtp`, `In-app database`. Recipients show name + address. Failed rows include the provider error text (e.g. SMTP 550).

**ASSUMPTION:** retries are not automatic for `Failed`; `Skipped` means the user/company disabled that channel.

---

## 10. Audit log (`/company/audit-logs`)

Filters:

- `user_id` (All users + every user/contact seen in the company);
- `module` (record type, class-style: Account, Branch, Company, ContractorBill, ContractorContract, Document, EmployeeAdvance, Expense, ExpenseCategory, Floor, GalleryItem, Installment, InstallmentPlan, Lead, LeadFollowup, LeaveType, Loan, Lookup, MaintenanceRequest, MaterialIssue, NumberSequence, Payment, PaymentLink, PaymentMethod, Payout, Post, PropertyVisit, PurchaseOrder, Quotation, RentAdjustment, RentSchedule, Reservation, Role, SalesCommission, SecurityDeposit, User, Warehouse, WebsiteItem, WebsiteText, building, customer, lease, project, sale, task, tenant, unit…);
- `event` (Created, Updated, Deleted);
- `date_from`, `date_to`.

Each entry: actor, action, record type + id, timestamp, IP, `View changes`. The change modal shows a `Field | Before | After` table.

Observed entry example: `Acme Realty updated Lead #58`, `16/11/2026 15:48 · 122.161.74.217`, fields name/budget_min/budget_max/status.

The audit log proved the temporary test lead create/update cycle.

**ASSUMPTION:** audit rows are append-only and retained indefinitely; values are stored as text snapshots.

---

## 11. Profile (`/company/profile`)

Documented in `02-auth.md` §7. Personal name/email/phone/avatar and password change.

---

## 12. Cross-module effects

| Setting | Affects |
|---|---|
| Currency / date / decimals / timezone | every list, form, report, PDF and scheduler |
| Numbering | reference numbers at creation time |
| Sales/rental defaults | sale, lease and schedule generation |
| Payment gateways | payment links, online payments, receipts |
| SMTP | all email notifications and receipts |
| Languages | UI locale, public site locale, CMS content |
| Master data | dropdowns across leads, units, maintenance, documents, contracts |
| Warehouses | stock, purchases, material issues |
| Expense categories | expenses, budgets, project profitability |
| Notification matrix/templates | delivery of every event |
| Audit log | every create/update/delete |

---

## 13. Not observed

- Save/test actions for SMTP.
- Gateway connection test or webhook registration.
- Deleting languages, master data, categories or warehouses.
- Number-sequence collision behaviour when the prefix/period changes.
- Audit retention/export.
- Notification template placeholders and per-channel body differences.
- Reminder scheduler timing.

---

## 14. Acceptance criteria for a reimplementation

1. Seven settings tabs with the documented fields and endpoints, including currency/timezone/date/number format.
2. 30 configurable numbering sequences with prefix, padding, reset period and live preview.
3. Sales and rental defaults that actually pre-fill and drive schedules.
4. Payment gateway credentials stored write-only server-side; SMTP settings with a test send.
5. Language CRUD with code, locale, RTL, active and single default.
6. Master-data lists for unit types, lead sources, labor categories, contractor trades, document categories, maintenance categories and support categories.
7. Material categories with optional parent, expense categories with ledger mapping, warehouses with central/site distinction.
8. Notification matrix + templates per event/channel/language and a delivery log with queued/sent/failed/skipped.
9. Append-only audit log with field-level before/after and filters.
10. Every setting change is permission-checked and audited.
