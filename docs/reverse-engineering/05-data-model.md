# 05 — Inferred data model

The demo exposes no schema. This model is reconstructed from URLs, table columns, form field names, select options and cross-module behaviour. It is sufficient to design the EstateVista schema; it is **not** a claim about the demo's actual tables.

Labels: **Observed** = field/relationship seen; **Inferred** = required by observed behaviour; **ASSUMPTION** = design choice.

---

## 1. Modelling conventions

- Multi-tenant: every business row carries `company_id`; all queries are scoped to the signed-in user's company.
- Primary keys: UUIDs for business records (demo uses UUIDv7); small integer IDs are acceptable internally.
- Human references: separate immutable `number` columns generated from `number_sequences` (prefix, padding, reset period).
- Money: `numeric(18,2)`; store currency per company (and per project where a project currency is set).
- Soft delete: `deleted_at` on entities referenced by history; never hard-delete financial records.
- Audit: `created_by`, `updated_by`, timestamps; append-only `audit_logs` with before/after snapshots.
- Enums: stored as strings with application-level validation (portable across Postgres/MySQL).
- Files: `documents` table with owner polymorphic link, path, MIME, size, category.

---

## 2. Platform, identity and configuration

```mermaid
erDiagram
  COMPANIES ||--o{ BRANCHES : has
  COMPANIES ||--o{ USERS : employs
  COMPANIES ||--o{ ROLES : defines
  ROLES }o--o{ PERMISSIONS : grants
  USERS }o--o{ ROLES : assigned
  BRANCHES ||--o{ USERS : scopes
  COMPANIES ||--o{ LANGUAGES : enables
  COMPANIES ||--|| SETTINGS : configures
  COMPANIES ||--o{ NUMBER_SEQUENCES : numbers
  USERS ||--o{ AUDIT_LOGS : acts
  USERS ||--o{ NOTIFICATIONS : receives
  COMPANIES ||--o{ NOTIFICATION_SETTINGS : configures
  COMPANIES ||--o{ NOTIFICATION_TEMPLATES : templates
  COMPANIES ||--o{ NOTIFICATION_LOGS : delivers

  COMPANIES {
    uuid id PK
    string name
    string legal_name
    string registration_number
    string tax_number
    string email
    string phone
    string address
    string city
    string state
    string postal_code
    string country
    string logo_path
    string favicon_path
    string currency
    string timezone
    string date_format
    int number_decimals
    boolean is_demo
  }
  BRANCHES {
    uuid id PK
    uuid company_id FK
    string name
    string code
    string phone
    string email
    text address
    uuid manager_id FK
    boolean is_active
  }
  USERS {
    uuid id PK
    uuid company_id FK
    uuid branch_id FK
    string name
    string email
    string password_hash
    string phone
    string avatar_path
    boolean full_access
    boolean is_active
    timestamp last_login_at
    timestamp email_verified_at
  }
  ROLES {
    uuid id PK
    uuid company_id FK
    string name
    string description
    boolean is_default
  }
  PERMISSIONS {
    int id PK
    string group
    string module
    string action
    string key
  }
  ROLE_PERMISSIONS {
    uuid role_id FK
    int permission_id FK
  }
  USER_ROLES {
    uuid user_id FK
    uuid role_id FK
  }
  LANGUAGES {
    uuid id PK
    uuid company_id FK
    string code
    string name
    string flag
    string locale
    boolean is_rtl
    boolean is_active
    boolean is_default
  }
  SETTINGS {
    uuid company_id PK
    int reservation_days
    decimal discount_approval_percent
    int sales_due_day
    int sales_grace_days
    string sales_late_fee_type
    decimal sales_late_fee_value
    int rental_due_day
    int rental_grace_days
    string rental_late_fee_type
    decimal rental_late_fee_value
    int notice_period_days
    int schedule_months
    int reminder_days
    int link_expiry_days
    boolean receipt_email
    json payment_gateways
    json smtp
  }
  NUMBER_SEQUENCES {
    uuid id PK
    uuid company_id FK
    string document_type
    string prefix
    int padding
    string reset_period
    int next_value
    int last_year
    int last_month
  }
  AUDIT_LOGS {
    bigint id PK
    uuid company_id FK
    uuid user_id FK
    string module
    uuid record_id
    string event
    json before
    json after
    string ip_address
    timestamp created_at
  }
  NOTIFICATIONS {
    uuid id PK
    uuid company_id FK
    uuid user_id FK
    string event_key
    string title
    text body
    string url
    boolean is_read
    timestamp read_at
    timestamp created_at
  }
  NOTIFICATION_SETTINGS {
    uuid company_id FK
    string event_key
    boolean in_app
    boolean email
    boolean sms
    boolean whatsapp
  }
  NOTIFICATION_TEMPLATES {
    uuid id PK
    uuid company_id FK
    string event_key
    string channel
    string locale
    string subject
    text body
    boolean is_active
  }
  NOTIFICATION_LOGS {
    bigint id PK
    uuid company_id FK
    uuid user_id FK
    string event_key
    string channel
    string recipient
    string subject
    string status
    text error
    timestamp sent_at
  }
```

Notes:

- `USERS.full_access` corresponds to the “Full access” radio; otherwise permissions are the union of `USER_ROLES → ROLE_PERMISSIONS`.
- The demo shows 144 permissions; the matrix is module × action.
- Company settings are split into typed columns plus JSON for gateway/SMTP secrets (encrypted at rest).
- Notification preferences per user are a separate table (`user × event × channel`) layered under the company matrix; copy states users can turn channels off but not on.

---

## 3. Properties, sales and rental

```mermaid
erDiagram
  PROJECTS ||--o{ BUILDINGS : contains
  BUILDINGS ||--o{ FLOORS : contains
  FLOORS ||--o{ UNITS : contains
  PROJECTS ||--o{ PROJECT_PHASES : phases
  PROJECTS ||--o{ PROJECT_BUDGETS : budgets
  UNIT_TYPES ||--o{ UNITS : types
  PROJECTS ||--o{ UNITS : sells
  UNIT_STATUS_HISTORY }o--|| UNITS : tracks

  LEADS }o--o| PROJECTS : interest
  LEADS }o--o| UNITS : interest
  LEADS ||--o{ LEAD_FOLLOWUPS : activities
  LEADS ||--o{ VISITS : books
  LEADS ||--o| CUSTOMERS : converts
  CUSTOMERS ||--o{ QUOTATIONS : receives
  LEADS ||--o{ QUOTATIONS : receives
  QUOTATIONS }o--|| UNITS : quotes
  CUSTOMERS ||--o{ RESERVATIONS : makes
  RESERVATIONS }o--|| UNITS : holds
  CUSTOMERS ||--o{ SALES : buys
  SALES }o--|| UNITS : sells
  SALES ||--|| INSTALLMENT_PLANS : plan
  INSTALLMENT_PLANS ||--o{ INSTALLMENTS : schedules
  INSTALLMENTS ||--o{ RECEIPT_ALLOCATIONS : settled_by
  RECEIPTS ||--o{ RECEIPT_ALLOCATIONS : allocates
  SALES ||--o{ SALES_COMMISSIONS : earns
  COMMISSION_RULES ||--o{ SALES_COMMISSIONS : computes

  TENANTS ||--o{ LEASES : signs
  LEASES }o--|| UNITS : rents
  LEASES ||--o{ RENT_SCHEDULES : bills
  RENT_SCHEDULES ||--o{ RENT_ADJUSTMENTS : adjusted
  RENT_SCHEDULES ||--o{ RECEIPT_ALLOCATIONS : settled_by
  LEASES ||--|| SECURITY_DEPOSITS : holds
  UNITS ||--o{ MAINTENANCE_REQUESTS : issues

  PROJECTS {
    uuid id PK
    uuid company_id FK
    uuid branch_id FK
    uuid project_manager_id FK
    string number
    string name
    string code
    string slug
    string type
    string status
    text description
    string location
    string city
    text address
    decimal land_area
    string land_area_unit
    decimal latitude
    decimal longitude
    decimal booking_amount
    decimal budget
    string currency
    date start_date
    date expected_completion_date
    date actual_completion_date
    boolean is_published
    boolean is_featured
    text amenities
    text specifications
    text nearby_places
    string video_url
    text payment_note
  }
  BUILDINGS {
    uuid id PK
    uuid project_id FK
    string code
    string name
    int floors_count
  }
  FLOORS {
    uuid id PK
    uuid building_id FK
    int number
    string name
  }
  UNITS {
    uuid id PK
    uuid project_id FK
    uuid building_id FK
    uuid floor_id FK
    uuid unit_type_id FK
    string unit_number
    decimal area
    string area_unit
    int bedrooms
    int bathrooms
    decimal sale_price
    decimal rent_price
    string status
    text description
  }
  LEADS {
    uuid id PK
    uuid company_id FK
    uuid source_id FK
    uuid assigned_to FK
    uuid project_id FK
    uuid unit_id FK
    string name
    string phone
    string email
    string status
    string lost_reason
    decimal budget_min
    decimal budget_max
    text notes
  }
  CUSTOMERS {
    uuid id PK
    uuid company_id FK
    uuid lead_id FK
    uuid source_id FK
    string name
    string type
    string phone
    string alternate_phone
    string email
    string national_id
    date date_of_birth
    string occupation
    text address
    string city
    string country
    boolean is_active
  }
  QUOTATIONS {
    uuid id PK
    uuid company_id FK
    uuid customer_id FK
    uuid lead_id FK
    uuid unit_id FK
    uuid salesperson_id FK
    string number
    date quotation_date
    date valid_until
    decimal unit_price
    decimal discount_amount
    decimal tax_amount
    text terms
    string status
  }
  RESERVATIONS {
    uuid id PK
    uuid company_id FK
    uuid customer_id FK
    uuid unit_id FK
    string number
    decimal booking_amount
    date expires_at
    string status
    text notes
  }
  SALES {
    uuid id PK
    uuid company_id FK
    uuid customer_id FK
    uuid unit_id FK
    uuid salesperson_id FK
    string number
    date agreement_date
    decimal sale_price
    decimal discount_amount
    decimal tax_amount
    decimal net_price
    decimal collected_amount
    string payment_type
    string status
  }
  INSTALLMENT_PLANS {
    uuid id PK
    uuid sale_id FK
    decimal down_payment
    int number_of_installments
    string frequency
    date start_date
    int due_day
    int grace_days
    string late_fee_type
    decimal late_fee_value
  }
  INSTALLMENTS {
    uuid id PK
    uuid plan_id FK
    uuid sale_id FK
    int sequence
    date due_date
    decimal amount
    decimal late_fee
    decimal paid_amount
    decimal balance
    string status
  }
  RECEIPTS {
    uuid id PK
    uuid company_id FK
    uuid customer_id FK
    uuid tenant_id FK
    uuid account_id FK
    string number
    date received_on
    decimal amount
    string status
    string reference
    text notes
  }
  RECEIPT_ALLOCATIONS {
    uuid id PK
    uuid receipt_id FK
    uuid installment_id FK
    uuid rent_schedule_id FK
    decimal amount
  }
  TENANTS {
    uuid id PK
    uuid company_id FK
    string name
    string type
    string phone
    string alternate_phone
    string email
    string national_id_type
    string national_id_number
    date date_of_birth
    string occupation
    text address
    boolean is_active
  }
  LEASES {
    uuid id PK
    uuid company_id FK
    uuid unit_id FK
    uuid tenant_id FK
    string number
    date start_date
    date end_date
    string frequency
    decimal rent_amount
    int due_day
    int grace_days
    string late_fee_type
    decimal late_fee_value
    int notice_period_days
    decimal security_deposit_amount
    json utilities_included
    text terms
    string status
  }
  RENT_SCHEDULES {
    uuid id PK
    uuid lease_id FK
    string period_label
    date period_start
    date period_end
    date due_date
    decimal rent_amount
    decimal adjustments
    decimal late_fee
    decimal paid_amount
    decimal balance
    string status
  }
  SECURITY_DEPOSITS {
    uuid id PK
    uuid lease_id FK
    decimal required_amount
    decimal received_amount
    decimal deducted_amount
    decimal refunded_amount
    decimal held_amount
    string status
  }
  MAINTENANCE_REQUESTS {
    uuid id PK
    uuid company_id FK
    uuid unit_id FK
    uuid tenant_id FK
    uuid category_id FK
    uuid assigned_to FK
    string number
    string title
    text description
    string priority
    date reported_on
    date scheduled_for
    decimal cost
    string status
  }
```

Business rules encoded in this model:

- A unit has exactly one **current** state but a history of states (`unit_status_history`).
- A sale has one installment plan; full-payment sales can be modelled as a plan with one installment or no plan.
- `receipt_allocations` is polymorphic between sale installments and rent schedules so one receipt engine can serve both.
- Quotations optionally reference a lead **or** a customer; converting a lead yields a customer.
- Deposits are one-to-one with a lease; deductions/refunds are transactions against it (detail table omitted for brevity — add `deposit_transactions` with type/amount/reason).
- Unit status transitions: Available → Reserved (reservation) → Sold (sale) / Rented (lease); cancellation reverses.

---

## 4. Construction, purchasing and inventory

```mermaid
erDiagram
  MATERIAL_CATEGORIES ||--o{ MATERIALS : groups
  MATERIALS ||--o{ STOCK_BALANCES : stocked
  WAREHOUSES ||--o{ STOCK_BALANCES : holds
  STOCK_BALANCES ||--o{ STOCK_MOVEMENTS : moves
  MATERIAL_ISSUES ||--o{ MATERIAL_ISSUE_ITEMS : lines
  MATERIAL_ISSUE_ITEMS }o--|| MATERIALS : issues
  MATERIAL_ISSUES }o--|| WAREHOUSES : from
  MATERIAL_ISSUES }o--|| PROJECTS : to

  SUPPLIERS ||--o{ PURCHASE_ORDERS : supplies
  PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : lines
  PURCHASE_ORDER_ITEMS }o--|| MATERIALS : orders
  SUPPLIERS ||--o{ PURCHASES : bills
  PURCHASES ||--o{ PURCHASE_ITEMS : lines
  PURCHASE_ITEMS }o--|| MATERIALS : receives
  PURCHASES }o--|| WAREHOUSES : into

  CONTRACTORS ||--o{ CONTRACTOR_CONTRACTS : signs
  CONTRACTOR_CONTRACTS ||--o{ CONTRACTOR_BILLS : bills
  CONTRACTOR_BILLS ||--o{ PAYOUT_ALLOCATIONS : paid_by

  LABORERS ||--o{ LABOR_ATTENDANCE : attends
  LABOR_ATTENDANCE }o--|| PROJECTS : on

  MATERIALS {
    uuid id PK
    uuid company_id FK
    uuid material_category_id FK
    string sku
    string name
    string unit
    decimal reorder_level
    decimal average_cost
    decimal standard_cost
    boolean is_active
  }
  WAREHOUSES {
    uuid id PK
    uuid company_id FK
    uuid project_id FK
    string name
    string code
    string type
    text address
    boolean is_active
  }
  STOCK_BALANCES {
    uuid id PK
    uuid warehouse_id FK
    uuid material_id FK
    decimal quantity
    decimal average_cost
  }
  STOCK_MOVEMENTS {
    uuid id PK
    uuid warehouse_id FK
    uuid material_id FK
    string type
    decimal quantity
    decimal unit_cost
    string reference_type
    uuid reference_id
    date moved_on
    uuid created_by FK
  }
  MATERIAL_ISSUES {
    uuid id PK
    uuid company_id FK
    uuid project_id FK
    uuid construction_phase_id FK
    uuid building_id FK
    uuid floor_id FK
    uuid warehouse_id FK
    string number
    date issue_date
    text notes
    decimal total_cost
    string status
  }
  PURCHASE_ORDERS {
    uuid id PK
    uuid company_id FK
    uuid supplier_id FK
    uuid project_id FK
    uuid warehouse_id FK
    string number
    date order_date
    date expected_date
    decimal discount_amount
    decimal tax_amount
    decimal total
    text notes
    string status
  }
  PURCHASES {
    uuid id PK
    uuid company_id FK
    uuid supplier_id FK
    uuid project_id FK
    uuid warehouse_id FK
    string number
    string supplier_invoice_number
    date purchase_date
    date due_date
    decimal discount_amount
    decimal tax_amount
    decimal total
    decimal paid_amount
    string status
    string payment_status
  }
  SUPPLIERS {
    uuid id PK
    uuid company_id FK
    string name
    string code
    string type
    string contact_person
    string phone
    string email
    text address
    string tax_number
    text notes
    boolean is_active
  }
  CONTRACTORS {
    uuid id PK
    uuid company_id FK
    uuid trade_id FK
    string name
    string code
    string contact_person
    string phone
    string email
    text address
    string tax_number
    boolean is_active
  }
  CONTRACTOR_CONTRACTS {
    uuid id PK
    uuid company_id FK
    uuid contractor_id FK
    uuid project_id FK
    string number
    string title
    date start_date
    date end_date
    decimal contract_value
    decimal retention_percent
    string status
  }
  LABORERS {
    uuid id PK
    uuid company_id FK
    uuid labor_category_id FK
    uuid project_id FK
    string number
    string name
    string phone
    string worker_type
    decimal rate
    boolean is_active
  }
  LABOR_ATTENDANCE {
    uuid id PK
    uuid laborer_id FK
    uuid project_id FK
    date attendance_date
    string status
    decimal hours
    decimal ot_hours
    uuid construction_phase_id FK
    decimal amount
  }
```

Inventory rule: stock is the sum of movements per warehouse × material; purchases and issues write movements, and `stock_balances` is a materialised cache that must reconcile with the ledger.

---

## 5. Finance, accounting and HR

```mermaid
erDiagram
  ACCOUNTS ||--o{ JOURNAL_LINES : posts
  JOURNAL_ENTRIES ||--o{ JOURNAL_LINES : contains
  ACCOUNTS ||--o{ EXPENSES : paid_from
  EXPENSE_CATEGORIES ||--o{ EXPENSES : classifies
  ACCOUNTS ||--o{ INCOMES : received_into
  ACCOUNTS ||--o{ PAYOUTS : paid_from
  ACCOUNTS ||--o{ TRANSFERS : moves
  LOANS }o--|| ACCOUNTS : disburses_to
  LOANS ||--o{ LOAN_SCHEDULES : repays

  DEPARTMENTS ||--o{ EMPLOYEES : groups
  DESIGNATIONS ||--o{ EMPLOYEES : titles
  EMPLOYEES ||--o{ HR_ATTENDANCE : attends
  LEAVE_TYPES ||--o{ LEAVE_REQUESTS : typed
  EMPLOYEES ||--o{ LEAVE_REQUESTS : requests
  PAYROLL_RUNS ||--o{ PAYSLIPS : generates
  EMPLOYEES ||--o{ PAYSLIPS : receives
  EMPLOYEES ||--o{ SALARY_ADVANCES : takes

  ACCOUNTS {
    uuid id PK
    uuid company_id FK
    uuid parent_id FK
    string code
    string name
    string type
    string sub_type
    string bank_name
    string bank_account_number
    decimal opening_balance
    date opening_date
    text description
    boolean is_active
  }
  JOURNAL_ENTRIES {
    uuid id PK
    uuid company_id FK
    string number
    date entry_date
    string description
    string source
    uuid source_id
    string status
    uuid created_by FK
    uuid reversed_by FK
  }
  JOURNAL_LINES {
    uuid id PK
    uuid journal_entry_id FK
    uuid account_id FK
    uuid project_id FK
    string description
    decimal debit
    decimal credit
  }
  EXPENSES {
    uuid id PK
    uuid company_id FK
    uuid expense_category_id FK
    uuid project_id FK
    uuid construction_phase_id FK
    uuid building_id FK
    uuid paid_from_account_id FK
    uuid supplier_id FK
    string number
    date expense_date
    decimal amount
    decimal tax_amount
    string payment_method
    string reference
    text notes
    string status
  }
  INCOMES {
    uuid id PK
    uuid company_id FK
    uuid account_id FK
    uuid project_id FK
    uuid deposit_account_id FK
    string number
    date income_date
    string payer_name
    decimal amount
    string payment_method
    string reference
    text notes
    string status
  }
  PAYOUTS {
    uuid id PK
    uuid company_id FK
    uuid account_id FK
    string number
    string payee_type
    uuid payee_id
    date paid_on
    decimal amount
    string payment_method
    string reference
    text notes
    string status
  }
  TRANSFERS {
    uuid id PK
    uuid company_id FK
    uuid from_account_id FK
    uuid to_account_id FK
    string number
    date transfer_date
    decimal amount
    string reference
    text notes
    string status
  }
  LOANS {
    uuid id PK
    uuid company_id FK
    uuid disbursement_account_id FK
    uuid liability_account_id FK
    string number
    string lender_name
    string lender_type
    decimal principal
    decimal interest_rate
    string interest_method
    string payment_frequency
    int installments_count
    date start_date
    decimal repaid_amount
    string status
    text notes
  }
  EXPENSE_CATEGORIES {
    uuid id PK
    uuid company_id FK
    string name
    string code
    string cost_category
    uuid account_id FK
    boolean is_active
  }
  DEPARTMENTS {
    uuid id PK
    uuid company_id FK
    string name
    string code
    boolean is_active
  }
  DESIGNATIONS {
    uuid id PK
    uuid company_id FK
    uuid department_id FK
    string name
    boolean is_active
  }
  EMPLOYEES {
    uuid id PK
    uuid company_id FK
    uuid user_id FK
    uuid branch_id FK
    uuid department_id FK
    uuid designation_id FK
    uuid manager_id FK
    string number
    string name
    string phone
    string email
    string gender
    date date_of_birth
    string national_id
    text address
    string employment_type
    date joining_date
    string status
    date exit_date
    decimal basic_salary
    string bank_name
    string bank_account_number
  }
  HR_ATTENDANCE {
    uuid id PK
    uuid employee_id FK
    date attendance_date
    string status
    time check_in
    time check_out
    decimal late_hours
    decimal overtime_hours
    text notes
  }
  LEAVE_TYPES {
    uuid id PK
    uuid company_id FK
    string name
    string code
    int days_per_year
    boolean is_paid
    boolean is_active
  }
  LEAVE_REQUESTS {
    uuid id PK
    uuid employee_id FK
    uuid leave_type_id FK
    date start_date
    date end_date
    text reason
    string status
    uuid decided_by FK
    text decision_note
  }
  PAYROLL_RUNS {
    uuid id PK
    uuid company_id FK
    string number
    string period
    int employees_count
    decimal gross
    decimal deductions
    decimal net_pay
    decimal paid_amount
    string status
    text notes
  }
  PAYSLIPS {
    uuid id PK
    uuid payroll_run_id FK
    uuid employee_id FK
    decimal gross
    decimal deductions
    decimal net_pay
    decimal paid_amount
    string status
  }
  SALARY_ADVANCES {
    uuid id PK
    uuid company_id FK
    uuid employee_id FK
    string number
    date advance_date
    decimal amount
    decimal monthly_deduction
    decimal recovered_amount
    text reason
    string status
  }
```

Accounting rules:

- Every financial module writes a balanced `journal_entries` + `journal_lines` pair.
- `journal_entries.source`/`source_id` link back to the originating sale, installment, expense, payout, transfer or loan.
- Reversal creates a new entry and links `reversed_by`; originals are immutable.
- Trial balance, P&L, balance sheet, cash flow and aging reports are queries over journal lines + open documents, not stored totals.
- Payroll and advances post to `2600 Salaries Payable` and `1600 Employee Advances` respectively.

---

## 6. Website and payments

```mermaid
erDiagram
  WEBSITE_INQUIRIES }o--o| PROJECTS : interest
  WEBSITE_INQUIRIES }o--o| UNITS : interest
  WEBSITE_INQUIRIES }o--o| LEADS : creates
  WEBSITE_POSTS }o--|| USERS : author
  WEBSITE_GALLERY }o--o| PROJECTS : related
  WEBSITE_ITEMS }o--o| PROJECTS : related
  WEBSITE_MEDIA }o--o| PROJECTS : project
  WEBSITE_MEDIA }o--o| UNITS : unit
  WEBSITE_TEXTS }o--|| LANGUAGES : locale

  PAYMENT_LINKS }o--o| CUSTOMERS : for
  PAYMENT_LINKS ||--o{ ONLINE_PAYMENTS : paid_by
  ONLINE_PAYMENTS ||--o| RECEIPTS : creates
  REFUNDS }o--|| RECEIPTS : reverses

  WEBSITE_INQUIRIES {
    uuid id PK
    uuid company_id FK
    string type
    string name
    string phone
    string email
    uuid project_id FK
    uuid unit_id FK
    text message
    uuid lead_id FK
    string status
  }
  WEBSITE_POSTS {
    uuid id PK
    uuid company_id FK
    uuid author_id FK
    string title
    string slug
    string category
    text excerpt
    text body
    string cover_path
    timestamp published_at
    string status
    string seo_title
    string seo_description
    boolean is_featured
  }
  WEBSITE_GALLERY {
    uuid id PK
    uuid company_id FK
    string image_path
    string caption
    string category
    uuid project_id FK
    int sort_order
    boolean is_published
  }
  WEBSITE_ITEMS {
    uuid id PK
    uuid company_id FK
    string type
    string locale
    string title
    string subtitle
    text body
    string image_path
    int rating
    boolean consent
    int year
    string category
    int sort_order
    boolean is_published
  }
  WEBSITE_MEDIA {
    uuid id PK
    uuid company_id FK
    uuid project_id FK
    uuid unit_id FK
    string file_path
    string title
    int sort_order
  }
  WEBSITE_TEXTS {
    uuid id PK
    uuid company_id FK
    string page
    string locale
    string key
    text value
  }
  PAYMENT_LINKS {
    uuid id PK
    uuid company_id FK
    uuid customer_id FK
    string payable_type
    uuid payable_id
    string description
    decimal amount
    date expires_at
    string status
    string token
  }
  ONLINE_PAYMENTS {
    uuid id PK
    uuid company_id FK
    uuid payment_link_id FK
    uuid customer_id FK
    string reference
    string gateway
    string gateway_transaction_id
    decimal amount
    string status
    json payload
  }
  REFUNDS {
    uuid id PK
    uuid company_id FK
    uuid receipt_id FK
    uuid customer_id FK
    string number
    text reason
    decimal amount
    string status
  }
```

Website content is key/value per page and locale; clearing a value deletes the override and the UI falls back to the built-in default.

---

## 7. Cross-cutting tables

| Table | Purpose |
|---|---|
| `documents` | polymorphic uploads (`owner_type`, `owner_id`), category, path, MIME, size, uploaded_by |
| `unit_status_history` | unit, from_status, to_status, reason, changed_by, changed_at |
| `approvals` | type (sale_discount, purchase_order, expense, salary_advance), requester, reference, amount/reason, status, decided_by, note, timestamps |
| `tasks` | title, description, project, assignee, priority, status, due_date, progress, created_by |
| `task_comments` / `task_watchers` | collaboration |
| `recurring_tasks` | template + frequency/interval/day + next_run_at |
| `visits` | lead/customer, project/unit, scheduled_at, salesperson, status, notes |
| `lead_followups` | lead, type, scheduled_at, completed_at, outcome, notes |
| `sales_commissions` | salesperson, sale, base amount, rate, commission, status |
| `commission_rules` | applicability, rate/amount, payable trigger, active |
| `contracts` | contractor contract (also covered above) |
| `contractor_bills` | contract, number, period, amount, retention, status |
| `payout_allocations` | payout → payable document (purchase, bill, commission, advance, deposit) |

---

## 8. Enum catalogue (observed)

| Domain | Values |
|---|---|
| Project type | `residential`, `commercial`, `mixed_use`, `land`, `other` |
| Project status | `planning`, `active`, `on_hold`, `completed`, `archived` |
| Unit status | `draft`, `available`, `reserved`, `sold`, `rented`, `blocked`, `under_maintenance` |
| Lead stage | `new`, `contacted`, `qualified`, `visit_scheduled`, `negotiation`, `won`, `lost` |
| Visit status | `scheduled`, `completed`, `cancelled`, `no_show` |
| Customer/tenant type | `individual`, `company` |
| Quotation status | `draft`, `sent`, `accepted`, `rejected`, `expired`, `converted` |
| Reservation status | `active`, `converted`, `cancelled`, `expired` |
| Sale status | `pending_approval`, `active`, `fully_paid`, `cancelled` |
| Schedule status | `upcoming`, `due`, `partly_paid`, `paid`, `overdue`, `waived`, `cancelled` |
| Receipt status | `completed`, `refunded`, `voided` |
| Lease status | `draft`, `active`, `expired`, `terminated`, `renewed` |
| Deposit status | `awaiting_settlement`, `to_collect`, `held`, `settled` |
| Maintenance status | `open`, `assigned`, `in_progress`, `completed`, `closed`, `cancelled` |
| Priority | `low`, `medium`, `high`, `urgent` |
| Material issue status | `pending_approval`, `approved`, `issued`, `rejected`, `cancelled` |
| PO status | `draft`, `approved`, `partly_received`, `received`, `cancelled` |
| Purchase status | `draft`, `received`, `cancelled` + payment `unpaid`, `partly_paid`, `paid` |
| Contract status | `draft`, `active`, `completed`, `terminated` |
| Expense status | `draft`, `approved`, `cancelled` |
| Income/payout/transfer status | `posted`, `voided` |
| Loan status | `active`, `closed` |
| Journal status | `posted`, `reversed` |
| Task status | `todo`, `in_progress`, `in_review`, `done`, `cancelled` |
| Leave status | `pending`, `approved`, `rejected`, `cancelled` |
| Advance status | `pending_approval`, `approved`, `recovering`, `recovered`, `rejected` |
| Payroll status | `draft`, `approved`, `paid` |
| Notification delivery | `queued`, `sent`, `failed`, `skipped` |
| Payment link status | `active`, `paid`, `expired`, `cancelled` |
| Online payment status | `pending`, `completed`, `failed`, `refunded`, `voided` |
| Refund status | `processing`, `completed`, `failed` |
| Article status | `draft`, `scheduled`, `published` |
| Gateway | `sslcommerz`, `stripe` |

---

## 9. Integrity rules to enforce

1. Every child row's `company_id` must equal its parent's; enforce with composite FKs or service-layer checks.
2. Reference numbers are unique per company per document type.
3. A unit cannot have two active reservations, sales or leases simultaneously.
4. A sale's unit must be `available` or `reserved` at creation; it becomes `sold` on activation.
5. Installment amounts must sum to `net_price − down_payment` (within rounding tolerance).
6. Rent schedule amounts must sum to the lease value over the term.
7. Receipt allocations must not exceed the receipt amount or the open balance of the target document.
8. Journal debits = credits per entry; lines cannot have both debit and credit.
9. Stock cannot go negative without an explicit override + audit entry.
10. Payroll/advances cannot be paid twice; idempotency by run/payslip.
11. Financial rows are never hard-deleted; use void/reversal.
12. Every mutation writes an audit row.
13. Deleting a parent with children is blocked; deactivate instead.
14. Locale-scoped CMS rows are unique per `(company, type, locale, sort_order)` where applicable.

---

## 10. Data not observable

- Actual table/column names and types.
- Indexes, constraints, triggers and cascade rules.
- Whether the demo uses soft deletes, and which tables.
- Multi-currency storage per transaction (only a company/project currency was observed).
- Whether balances are materialised or computed.
- Sequence-locking strategy under concurrency.
- Retention policy for audit and notification logs.

These are design decisions for the reimplementation, not demo facts.
