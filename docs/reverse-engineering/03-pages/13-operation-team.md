# 03-pages / Operation Team

Routes: `/company/team`, `/company/roles`, `/company/roles/create`, `/company/roles/{uuid}/edit`, `/company/branches`.

This module controls **who can access the company panel** and **which branch** they belong to.

---

## 1. Team (`/company/team`)

### 1.1 List

Columns: `Member`, `Access`, `Roles`, `Branch`, `Last login`, `Status`, `Actions`.

Filters: `search` (name or email), `branch_id` (Chattogram Office, Head Office, Sylhet Office), `status` (Active, Inactive). 6 rows in demo.

Observed rows:

| Member | Access | Roles | Branch | Last login |
|---|---|---|---|---|
| Acme Realty (you) `company@example.com` | Full access | — | — | 10 minutes ago |
| Company Admin `company@gmail.com` | Full access | — | — | 5 days ago |
| Company User `staff@gmail.com` | Role based | — | — | Never |
| Company User `staff@example.com` | Role based | Sales Manager | — | 5 days ago |
| Sadia Islam `sales2@example.com` | Role based | Salesperson | — | Never |
| Tanvir Hasan `sales1@example.com` | Role based | Salesperson | — | Never |

Row actions: `Edit`, `Deactivate` (or `Activate`). Deletion of team members was not observed; deactivation is the intended offboarding path.

### 1.2 Add team member modal (`#memberModal`)

| Label | Name | Type | Options / notes |
|---|---|---|---|
| Full name * | `name` | text | |
| Email * | `email` | email | login identifier |
| Phone | `phone` | text | |
| Branch | `branch_id` | select | No branch + branches |
| Access | `role` | radio | **Role based** (“Can only do what their assigned roles allow.”) / **Full access** (“Can manage everything”) |
| Roles | `role_ids[]` | multi-select | Accountant, Admin, Construction Manager, Employee, HR Manager, Maintenance Manager, Project Manager, Property Manager, Sales Manager, Salesperson |
| Password | `password` | password | |
| Confirm password | `password_confirmation` | password | |

The “Full access” radio is effectively a super-admin flag; role-based users get the union of their roles' permissions.

**ASSUMPTION:** email must be unique within the company; password rules are the same as profile change; a welcome email is optional (not observed).

---

## 2. Roles & permissions (`/company/roles`)

Card grid. Each role card shows:

- name (Accountant, Admin, Construction Manager, Employee, HR Manager, Maintenance Manager, Project Manager, Property Manager, Sales Manager, Salesperson…);
- description (“Default role created with your company”);
- `Default` badge when applicable;
- member count;
- permission count (Admin 140, Accountant 64, Construction Manager 41, Project Manager 37, HR Manager 16, Maintenance Manager 11, Employee 3, …);
- `Edit permissions`.

Primary action: `New role`.

Page copy: “Members with full access can do everything. Everyone else gets the permissions of the roles assigned to them.”

### 2.1 New role (`/company/roles/create`)

Header: `Role details` — `Name *`, `Description`, counter `0 / 144 permissions selected`, `Cancel`, `Save`.

Permissions matrix: `Select all` globally and per group. Four actions per module: **View, Create, Edit, Delete** (some groups show **Manage** or **Upload** instead of create/edit/delete).

Observed permission groups and modules:

| Group | Modules (permission sets) |
|---|---|
| Team | Team members, Roles & permissions, Branches, Master data, Company settings, Audit log |
| Projects | Projects, Units, Documents |
| Construction planning | Phases/milestones/budgets |
| Suppliers | Suppliers |
| Contractors | Contractors |
| … | (remaining groups continue below the fold; total 144 permissions) |

The full 144-permission catalogue is not enumerated in this document; it is the union of module × action across the sidebar modules.

Delete permission exists in the matrix, but the demo blocks deletes regardless of role (403). Deletion is therefore untestable here.

---

## 3. Branches (`/company/branches`)

### 3.1 List

Columns: `Branch`, `Contact`, `Manager`, `Team`, `Status`, `Actions`.

Filter: `search` (name or code). 3 rows.

Observed:

| Branch | Code | Contact | Manager | Team |
|---|---|---|---|---|
| Chattogram Office | `CTG-102` | Level 4, Finlay House, Agrabad C/A, Chattogram · +880 1711-000200 · chattogram@acme-realty.test | — | 0 |
| Head Office | `HQ-101` | Dhaka, Bangladesh · 01917948316 · rakibuddin101@gmail.com | Company Admin | 0 |
| Sylhet Office | `SYL-103` | Garden Tower, Zindabazar, Sylhet · +880 1711-000300 · sylhet@acme-realty.test | — | 0 |

Actions: `Edit`, `Delete` (demo-blocked).

### 3.2 Add branch modal (`#branchModal`)

| Label | Name | Type | Options |
|---|---|---|---|
| Name * | `name` | text | |
| Code * | `code` | text | |
| Phone | `phone` | text | |
| Email | `email` | email | |
| Address | `address` | textarea | |
| Manager | `manager_id` | select | None + team users |
| Active | `is_active` | checkbox | |

Branches are referenced by team members, projects and employees. “Team” is a computed count.

**ASSUMPTION:** branch code is unique per company; a branch with linked records cannot be hard-deleted (should be deactivated).

---

## 4. Authorization model

- Two access modes: **Full access** and **Role based**.
- Role based = union of permissions from all assigned roles.
- Permissions are module × action; a missing `View` should hide the menu and block the route (menu hiding observed only indirectly; route enforcement is **ASSUMPTION** until tested with a limited account).
- No per-record ACLs were observed (no “owner only” or branch-scoped visibility rules). Multi-branch scoping is **ASSUMPTION**; the demo’s users all have no branch assigned.
- The role editor allows creating custom roles with any subset of the 144 permissions.

---

## 5. Cross-module effects

| Event | Effect |
|---|---|
| Team member created | New login; access = full or union of roles. |
| Team member deactivated | Login blocked; historical records retain the user reference. |
| Role edited | All members with that role immediately gain/lose permissions. |
| Branch deactivated | No new assignments; existing references remain. |
| Employee linked to login | HR identity and login identity share the user (inferred). |

---

## 6. Not observed

- Role edit screen pre-populated with existing permissions (only the create screen was inspected).
- Permission-denied page and route enforcement with a limited user.
- Branch-scoped data visibility.
- Team member deletion.
- Invitation email flow.
- Two-factor or SSO settings for team members.
- Audit trail of role changes (audit log exists; specific entries not inspected).

---

## 7. Acceptance criteria for a reimplementation

1. Team list with access mode, roles, branch, last login and active state.
2. Add/edit team member with full-access vs role-based choice, multi-role assignment and password confirmation.
3. Deactivate/reactivate instead of delete for users with history.
4. Role CRUD with a 144-permission-style matrix grouped by module, global and per-group select-all, and a live selected count.
5. Seed roles equivalent to the observed defaults (Admin, Accountant, Sales Manager, Salesperson, Project Manager, Construction Manager, Property Manager, HR Manager, Maintenance Manager, Employee).
6. Branches with code, contact, manager, active state and computed team count.
7. Server-side permission enforcement on every route and API, not only menu filtering.
8. Audit log entries for team, role and branch changes.
