# 03-pages / Dashboard

Route: `/company/dashboard`
Page title: `Dashboard · Acme Realty`

---

## 1. Purpose

Operational cockpit for the company: cash collection, overdue exposure, rental performance, profitability, unit inventory, upcoming receivables, recent sales, project progress, sales pipeline, and personal work items.

---

## 2. Layout (observed)

```
breadcrumb: Dashboard
├─ KPI row (4 clickable cards)
├─ Income vs expense bar chart (last 12 months)
├─ Unit inventory (status distribution, 269 units)
├─ Installments due (list)
├─ Recent sales (list)
├─ Project progress (list)
├─ Lead pipeline (stage counts)
└─ Tasks / approvals (personal work)
```

A “Getting started” modal can auto-open for new companies; its “hide” checkbox is persisted through an AJAX `PATCH` to the URL stored on the modal (`data-url`), body `{ hidden: 0|1 }`. The exact endpoint was not captured.

---

## 3. KPI cards (observed labels and values)

| Card | Value in demo | Hint | Colour | Links to |
|---|---|---|---|---|
| Sales collected this month | `$ 4,211,983` | `3 payments` | green | `/company/collections` (inferred from card link) |
| Overdue installments | `$ 22,821,204` | `18 installments` | red | `/company/installments` filtered to overdue (inferred) |
| Rent collected this month | `$ 0` | `0% collected` | purple | `/company/rent-collections` (inferred) |
| Net profit · year to date | `$ 1,091,319,520` | `Cash & bank: $ 1,525,887,446` | brand | `/company/reports/profit-loss` (inferred) |

Each KPI is an `<a>` with an icon, label, value and hint. Values come from the server; no client-side calculation was observed.

---

## 4. Income vs expense chart

- CSS bar chart, one paired bar per month.
- Each bar is a `div` with `data-height="<0–100>"`; JS sets `height: n%`.
- Bars carry native tooltips: `Income: $ 136,987,230`, `Expense: $ 640,633`.
- Observed monthly pairs (sample): income 136,987,230 / expense 640,633; 135,291,820 / 765,149; 87,961,230 / 650,594; 111,371,320 / 641,966; 125,965,230 / 681,264; 169,012,320 / … .
- No chart library or `<canvas>` was present; there is no interactive legend or date-range control on the dashboard.

Implementation note: the bar heights are precomputed on the server. In a reimplementation, compute them from the monthly series with a single shared scale and keep the same accessible tooltip text.

---

## 5. Unit inventory

- Headline total: **269 units** across projects.
- Breakdown by status: Draft, Available, Reserved, Sold, Rented, Blocked, Under maintenance (same vocabulary as the Units module).
- Shown as a distribution with counts and percentages.
- Clicking a status is **inferred** to open `/company/units?status=…`; the exact links were not all captured.

---

## 6. Installments due

- Lists the nearest/overdue sale installments with customer, unit/sale, due date, amount, balance and status badge.
- Row action opens the sale or the receive-payment flow.
- “Overdue” badges are prominent (red).

---

## 7. Recent sales

- Latest sale contracts with customer, unit, net price / collected and status.
- Links to the sale detail.

---

## 8. Project progress

- One row/card per project with status badge (e.g. Active), progress indicator, and inventory counts.
- Links to project detail.

---

## 9. Lead pipeline

- Stage counts for New, Contacted, Qualified, Visit scheduled, Negotiation, Won, Lost.
- Links to `/company/leads?status=…` (inferred; filter names match the leads page).

---

## 10. Tasks and approvals

- “My tasks” style list (due date, priority, status) and pending approvals.
- Links to `/company/tasks` and `/company/approvals`.

---

## 11. Not observed

- Exact dashboard query parameters or JSON endpoint (server-rendered only).
- Customizable widgets, date-range picker, export.
- Real-time refresh/websockets.

---

## 12. Acceptance criteria for a reimplementation

1. Four KPI cards with the same labels/semantics, correct links and currency formatting.
2. 12-month income/expense chart rendered without a heavy chart dependency, with accessible tooltips.
3. Unit inventory totals reconcile exactly with the Units module.
4. Installments-due and recent-sales lists deep-link to the correct records.
5. Project progress and lead-pipeline counts deep-link to filtered lists.
6. Personal tasks/approvals visible only for the signed-in user.
7. Getting-started modal can be dismissed and the choice persists per user/company.
