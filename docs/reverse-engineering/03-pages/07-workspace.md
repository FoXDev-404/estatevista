# 03-pages / Workspace

Routes: `/company/tasks`, `/company/recurring-tasks`, `/company/approvals`, `/company/notifications`, `/company/notifications/preferences`, `/company/notification-settings`, `/company/notification-logs`.

---

## 1. Tasks (`/company/tasks`)

### 1.1 List

Columns: `Task`, `Assignee`, `Due`, `Priority`, `Progress`, `Status`, `Actions`.

Filters:

| Field | Options |
|---|---|
| `search` | tasks |
| `status` | All statuses, **Open tasks**, To do, In progress, In review, Done, Cancelled |
| `priority` | All priorities, Low, Medium, High, Urgent |
| `assigned_to` | Anyone + users |
| `project_id` | All projects |
| `due` | Any due date, Overdue, Due today, Due in 7 days |

25 rows. Header actions: `Recurring` (→ recurring tasks), `New task`.

### 1.2 Task form (modal)

The modal exists but its fields were not fully captured. The table columns and filters imply at least:

**ASSUMPTION fields:** title*, description, project, assignee, priority, status, due date, progress (0–100), watchers, checklist/subtasks, comments.

Observed status vocabulary: To do → In progress → In review → Done, plus Cancelled. `Open tasks` is a filter aggregate, not a stored status. Progress is a percentage; task comments trigger notifications.

---

## 2. Recurring tasks (`/company/recurring-tasks`)

Card layout. Each template card shows:

- title (e.g. `Employee attendance review`, `Monthly collection review`, `Weekly site safety walk — Skyline`);
- schedule summary (`Every month · on day 1`, `Every month · on day 3`);
- `Assignee`, `Project` (or `—`), `Priority`;
- `Next run` date;
- `Tasks created 1 · last 01/09/2026`;
- a horizontal preview of upcoming occurrences (e.g. `01 Oct`, `01 Nov`, `01 Dec`, `01 Jan`);
- `View tasks` action (filtered by template).

Page copy: “Each template creates a task on its schedule. Tasks are generated daily, one occurrence at a time, so nothing is created far in advance.”

Primary action: `New recurring task`.

**ASSUMPTION fields:** title, description, frequency (daily/weekly/monthly/yearly), interval, day-of-week/day-of-month, start date, assignee, project, priority, status, end date.

Generation is a daily scheduler job (inferred from the copy). Occurrences are created one at a time, not pre-generated.

---

## 3. Approvals (`/company/approvals`)

Tabs: `Waiting for me`, `Decided`, `My requests`.

Summary counters: `Waiting for your decision 0`, `Approved · 30 days 2`, `Rejected · 30 days 0`.

Filter: `type` — All types, **Sale discount**, **Purchase order**, **Expense**, **Salary advance**.

Empty state: “All caught up — Nothing is waiting for your decision.”

Approval action opens a modal with `Note` (“The requester sees this note.”), `Cancel`, `Save`; approve/reject variants. Approval requests originate from the four modules above when a configured threshold is exceeded (e.g. discount approval threshold in Settings → Sales, PO/expense approvals, salary advance).

**ASSUMPTION:** approval records capture requester, type, record reference, requested amount/reason, decision, decider, note and timestamps; decisions are immutable and audited.

---

## 4. Notifications page (`/company/notifications`)

- Tabs/filters: `All`, `Unread`.
- Each item: title (e.g. “New visit request from Jhonatan Luna”), body, relative time (`2 days ago`), icon/colour, read state, optional link.
- Header action: `Notification preferences` → `/company/notifications/preferences`.
- Mark one read / mark all read via `POST /company/notifications/{id}/read` and `POST /company/notifications/read-all`.
- Topbar bell uses `GET /company/notifications/feed` and renders `{ count, notifications: [{ id, title, body, time, read, url, icon, color }] }` (shape inferred from the client script).

Observed notification examples: website visit request, website inquiry, expense approval request, salary advance request.

---

## 5. Notification preferences

Channel matrix for the signed-in user (per event × channel). Channels: **In-app, Email, SMS, WhatsApp**. The same event catalogue appears in company-level Notification settings.

Events observed (grouped as on the page):

| Group | Events |
|---|---|
| Tasks | Task assigned, Task due soon, Task overdue, Task completed, Task comment |
| HR | Leave requested, Leave decided, Payslip issued |
| Approvals | Approval requested, Approval decided |
| Sales | Installment due, Installment overdue, Reservation expiring, Installment reminder (to customers/tenants), Installment overdue notice (to customers/tenants), Website inquiry, Website visit request |
| Rental | Rent due, Rent overdue, Lease expiring, Maintenance request, Rent reminder (to customers/tenants), Rent overdue notice (to customers/tenants) |
| Payments | Online payment received |
| Finance | Loan repayment due |
| Documents | Document expiring |

Note: “Website inquiry” and “Website visit request” are grouped under Sales on the settings page even though they are website-originated.

The 34 table rows include group heading rows; there are 22–24 actual events.

---

## 6. Notification settings (`/company/notification-settings`)

Company-level configuration:

- Matrix table with columns `Event`, `In-app`, `Email`, `SMS`, `WhatsApp`; 34 rows including group headings.
- `Save changes`.
- `New template` action opens a template modal:
  - `Event *` (`event_key`): Task assigned, Task due soon, Task overdue, Task completed, Task comment, Leave requested, Leave decided, Payslip issued, Approval requested, Approval decided, Installment due, Installment overdue, Reservation expiring, Installment reminder, Installment overdue notice, Website inquiry, Website visit request, Rent due, Rent overdue, Lease expiring, Maintenance request, Rent reminder, Rent overdue notice, Online payment received, Loan repayment due, Document expiring (observed in the select; order approximate).
  - `Save`, `Cancel`.
- Link: `Delivery log`.

Template body is presumably per-channel subject/body with placeholders; exact fields beyond `event_key` were not captured.

---

## 7. Delivery log (`/company/notification-logs`)

Columns: `Sent`, `Event`, `Recipient`, `Channel`, `Subject`, `Status`.

Filters: `search` (recipient/subject), `event_key`, `channel` (In-app, Email, SMS, WhatsApp), `status` (Queued, Sent, Failed, Skipped). 25 rows.

This is an outbound delivery audit: every notification attempt with channel and result.

---

## 8. Cross-module effects

| Event | Effect |
|---|---|
| Task assigned | In-app + email notification to assignee. |
| Task due/overdue | Scheduled reminders. |
| Approval requested/decided | Notification to approver/requester. |
| Website inquiry/visit request | Notification to sales team. |
| Installment/rent due or overdue | Notification to internal user and optionally customer/tenant. |
| Online payment received | Notification to finance/sales. |
| Document expiring | Reminder before expiry. |

---

## 9. Not observed

- Task create/edit modal fields, comments, checklists.
- Recurring task create/edit form.
- Approval record detail and threshold rules.
- Template editor beyond `event_key`.
- Notification preference defaults and override precedence (user vs company).
- Scheduler implementation and retry policy.

---

## 10. Acceptance criteria for a reimplementation

1. Tasks with assignee, project, priority, due date, progress and the five statuses.
2. Recurring task templates with schedule preview and one-occurrence-at-a-time generation.
3. Approvals inbox with type filter, approve/reject and mandatory decision note.
4. In-app notification list + unread count + mark-one/mark-all.
5. Per-user channel preferences and per-company event/channel settings.
6. Notification templates keyed by event and channel.
7. Delivery log with queued/sent/failed/skipped states.
8. Scheduled reminders are idempotent and do not duplicate on retry.
