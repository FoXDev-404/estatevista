# 03-pages / Properties: Projects & Units

Routes:

- `/company/projects` — project cards
- `/company/projects/create` — new project
- `/company/projects/{uuid}` — project detail with tabs
- `/company/projects/{uuid}/edit` — edit project
- `/company/units` — unit inventory
- `/company/units/{uuid}` — unit detail (action-dependent; not fully captured)

---

## 1. Projects list (`/company/projects`)

Observed as a responsive **card grid**, not a table.

Filters (GET form):

| Field | Options |
|---|---|
| `search` | Search by name, code or city… |
| `type` | All types, Residential, Commercial, Mixed use, Land, Other |
| `status` | All statuses, Planning, Active, On hold, Completed, Archived |

Primary action: `New project`.

Each project card shows:

- code + type (`PRJ-0005 · Land`), name, city;
- counts: Buildings, Units, Available, Sold;
- status badge (Active/Planning/…);
- `Edit` and `Delete` actions.

`Delete` calls the generic delete endpoint and is refused by the demo with 403. Project cards are the only list view — there is no table view.

---

## 2. Create project (`/company/projects/create`)

Form action: `POST /company/projects`. Page title `New project · Acme Realty`.

### 2.1 Fields (observed, in order)

| Label | Name | Type | Options / notes |
|---|---|---|---|
| Project name * | `name` | text | placeholder “e.g. Green Valley Residence” |
| Code | `code` | text | placeholder “Auto-generated” |
| Type * | `type` | select | `residential`, `commercial`, `mixed_use`, `land`, `other` |
| Status * | `status` | select | `planning`, `active`, `on_hold`, `completed`, `archived` |
| Description | `description` | textarea | public/long description |
| Area / locality | `location` | text | e.g. “Bashundhara R/A” |
| City | `city` | text | |
| Address | `address` | textarea | |
| Land area | `land_area` | number | |
| — | `land_area_unit` | select | `katha`, `decimal`, `bigha`, `acre`, `sqft`, `sqm` |
| Latitude | `latitude` | number | |
| Longitude | `longitude` | number | |
| Publish on website | `is_published` | checkbox | `1` |
| Featured project | `is_featured` | checkbox | `1` |
| Web address | `slug` | text | public URL slug |
| Website summary | `summary` | textarea | |
| Amenities | `amenities_text` | textarea | free text (newline/comma convention not captured) |
| Specifications | `specifications_text` | textarea | |
| Nearby places | `nearby_places_text` | textarea | |
| Booking amount | `booking_amount` | number | |
| Video link | `video_url` | url | |
| Payment plan | `payment_note` | textarea | |
| Project manager | `project_manager_id` | select | company users |
| Branch | `branch_id` | select | No branch / branches |
| Start date | `start_date` | date text | Flatpickr |
| Expected completion | `expected_completion_date` | date text | Flatpickr |
| Currency | `currency` | select | full ISO-4217 list (e.g. BDT, USD, AED…) |
| Budget | `budget` | number | project budget |

The form is long and grouped into sections; the exact section headings were not all captured. Required markers are label text, not the HTML `required` attribute.

### 2.2 Project detail (`/company/projects/{uuid}`)

Tabs observed:

1. **Overview**
2. **Units board**
3. **Construction**
4. **Budget & costs**
5. **Documents** (badge with count, e.g. 10)

Header actions observed:

`View on website`, `Edit`, `Add building`, `Generate units`, `Request materials`, `New purchase order`, `Take attendance`, `Contracts`, `Add phase`, `Edit budget`, `Upload`, `Photos & documents`.

Overview content (Lakeview Heights sample):

- identity line: `PRJ-0002 · Residential · Lakeview Heights · Gulshan 2, Dhaka · Company User · Due 24/07/2027 · Active`;
- inventory KPIs: Total units 81, Available 26, Reserved/sold 43, Rented 0;
- status distribution: Draft 8 (10%), Available 26 (32%), Reserved 12 (15%), Sold 31 (38%), Rented 0, Blocked 4 (5%), Under maintenance 0;
- inventory value: total list value `$ 2,310,816,000`, available to sell `$ 723,186,000`;
- budget `$ 420,000,000`, actual cost to date `$ 23,004,542`;
- project details: Type, Project manager, Branch, Start date, Expected completion, Actual completion, Land area (32 Katha), Buildings (2), Address, Description;
- action strip for adding buildings / generating units / requesting materials / POs / attendance / contracts.

Budget & costs tab table:

| Cost category | Estimated | Actual | Utilisation | Variance | Variance % |
|---|---|---|---|---|---|

Cost transaction table:

| Date | Cost category | Reference | Amount |
|---|---|---|---|

### 2.3 Buildings, floors and units

- A project contains **buildings**; buildings contain **floors**; floors contain **units**.
- Units can be generated in bulk (`Generate units`) or added individually from the project context.
- `/company/units/create` is **404** — there is no global unit-create page.
- Building selector labels observed: `A · Tower A`, `B · Tower B`, `K · Plaza Block`, `P · Palm Block`, `R · Riverside Block`, `S · Retail Podium`, `T · Office Tower`.
- Floor selector labels: `Floor 1` … `Floor 8` (per building).
- Unit types: Flat, Plot, Apartment, Office, Shop, Parking, Storage.
- Unit statuses: Draft, Available, Reserved, Sold, Rented, Blocked, Under maintenance.

---

## 3. Units list (`/company/units`)

Table columns:

| Unit | Project | Location | Unit type | Area | Sale price | Status | Actions |
|---|---|---|---|---|---|---|---|

Filters:

| Field | Options |
|---|---|
| `search` | Search by unit number… |
| `project_id` | All projects / six demo projects |
| `building_id` | All buildings / project-specific buildings |
| `unit_type_id` | All types, Flat, Plot, Apartment, Office, Shop, Parking, Storage |
| `status` | All statuses, Draft, Available, Reserved, Sold, Rented, Blocked, Under maintenance |

Rows: 25 per page.

Actions observed in other unit contexts: view/open, edit, photos & documents, delete (demo-blocked). Unit detail layout and edit form were **not fully captured**; treat unit field requirements as **ASSUMPTION** derived from the list columns and project generation flow:

- unit number, project, building, floor, unit type, area (with unit), bedrooms, bathrooms, sale price, rent price, status, description, photos/documents.

---

## 4. Status and validation rules (observed or safely inferred)

- Project `name`, `type`, `status` are required; the UI marks them with `*`.
- Project code is optional and auto-generated when blank (placeholder “Auto-generated”); uniqueness is **inferred**.
- Unit must belong to a project and have a unique number within its building/floor (inferred from generation flow; uniqueness not exercised).
- A unit that is Reserved/Sold/Rented should not be deletable or re-reserved without closing the active contract. The demo blocks all deletes, so this rule was **not observed**.
- Project deletion is demo-blocked; production should probably soft-delete/archive instead of hard delete when contracts exist.

---

## 5. Cross-module links from Projects

| Action | Target module |
|---|---|
| Request materials | Material issues |
| New purchase order | Purchase orders |
| Take attendance | Labor attendance |
| Contracts | Contracts |
| Budget & costs | Finance/accounting transactions |
| Documents | Uploads (project documents) |
| View on website | Public site project page (slug) |

---

## 6. Acceptance criteria for a reimplementation

1. Project card grid with the same filters and counts, and a `New project` action.
2. Full project form with the fields above, date pickers, currency selection, publish/feature toggles and branch/manager assignment.
3. Project detail with Overview, Units board, Construction, Budget & costs and Documents tabs.
4. Unit inventory with all seven statuses and filters by project/building/type/status.
5. Units created from project context (bulk generation and single add), with building/floor hierarchy.
6. No global `/units/create` route.
7. Demo-delete behaviour must **not** be copied; implement real authorization, soft-delete/archival and referential-integrity checks.
