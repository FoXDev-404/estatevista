import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '../lib/crm.js';
import { UNIT_STATUSES, UNIT_STATUS_LABELS } from '../lib/inventory.js';
import { roundMoney } from '../lib/sales.js';

const DAY = 24 * 60 * 60 * 1000;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyOf(value) {
  return String(value || '').slice(0, 7);
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`).getTime();
  const end = new Date(`${String(to).slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY));
}

function percentOf(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((Number(part) / Number(total)) * 100));
}

function sumAllocations(receipts, key) {
  return roundMoney(
    receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.allocations || [])
          .filter((allocation) => allocation[key])
          .reduce((lineTotal, allocation) => lineTotal + Number(allocation.amount || 0), 0),
      0,
    ),
  );
}

function receiptAllocationIds(receipt, key) {
  return (receipt.allocations || []).filter((allocation) => allocation[key]).length;
}

function isPastDue(row, today) {
  if (['paid', 'waived', 'cancelled'].includes(row.status)) return false;
  if (Number(row.balance || 0) <= 0) return false;
  const dueDate = String(row.due_date || '').slice(0, 10);
  if (!dueDate) return false;
  return today > addDays(dueDate, Math.max(0, Number(row.grace_days || 0)));
}

function dashboardStatus(row, today) {
  return isPastDue(row, today) ? 'overdue' : row.status;
}

function buildSalesSection(receipts, installments, sales, monthKey, today) {
  const monthReceipts = receipts.filter(
    (receipt) =>
      receipt.status === 'completed' &&
      monthKeyOf(receipt.received_on) === monthKey &&
      receiptAllocationIds(receipt, 'installment_id') > 0,
  );
  const collected = sumAllocations(monthReceipts, 'installment_id');

  const overdue = installments.filter((row) => isPastDue(row, today));
  const overdueAmount = roundMoney(
    overdue.reduce((sum, row) => sum + Number(row.balance || 0), 0),
  );

  const horizon = addDays(today, 30);
  const installmentsDue = installments
    .filter((row) => !['paid', 'waived', 'cancelled'].includes(row.status))
    .filter(
      (row) => isPastDue(row, today) || String(row.due_date || '') <= horizon,
    )
    .sort((a, b) => {
      const aOverdue = isPastDue(a, today);
      const bOverdue = isPastDue(b, today);
      if (aOverdue && !bOverdue) return -1;
      if (bOverdue && !aOverdue) return 1;
      return String(a.due_date).localeCompare(String(b.due_date));
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      sequence: row.sequence,
      due_date: row.due_date,
      amount: row.amount,
      paid_amount: row.paid_amount,
      balance: row.balance,
      status: dashboardStatus(row, today),
      aging_days: isPastDue(row, today) ? daysBetween(row.due_date, today) : 0,
      sale: row.sale
        ? {
            id: row.sale.id,
            number: row.sale.number,
            customer: row.sale.customer || null,
            unit: row.sale.unit || null,
          }
        : null,
    }));

  const recentSales = sales
    .filter((row) => row.status !== 'cancelled')
    .slice(0, 6)
    .map((row) => ({
    id: row.id,
    number: row.number,
    agreement_date: row.agreement_date,
    net_price: row.net_price,
    collected_amount: row.collected_amount,
    balance_due: row.balance_due,
    status: row.status,
    customer: row.customer || null,
    unit: row.unit || null,
    salesperson: row.salesperson || null,
  }));

  return {
    kpis: [
      {
        key: 'sales_collected',
        label: 'Sales collected this month',
        value: collected,
        count: monthReceipts.length,
        caption: `${monthReceipts.length} payment${monthReceipts.length === 1 ? '' : 's'}`,
        format: 'currency',
        tone: 'green',
        to: '/admin/collections',
      },
      {
        key: 'overdue_installments',
        label: 'Overdue installments',
        value: overdueAmount,
        count: overdue.length,
        caption: `${overdue.length} installment${overdue.length === 1 ? '' : 's'}`,
        format: 'currency',
        tone: 'red',
        to: '/admin/installments',
      },
    ],
    installments_due: installmentsDue,
    recent_sales: recentSales,
  };
}

function buildRentSection(receipts, schedules, monthKey) {
  const monthReceipts = receipts.filter(
    (receipt) =>
      receipt.status === 'completed' &&
      monthKeyOf(receipt.received_on) === monthKey &&
      receiptAllocationIds(receipt, 'rent_schedule_id') > 0,
  );
  const collected = sumAllocations(monthReceipts, 'rent_schedule_id');

  const monthSchedules = schedules.filter(
    (row) =>
      monthKeyOf(row.due_date) === monthKey && !['cancelled', 'waived'].includes(row.status),
  );
  const due = roundMoney(
    monthSchedules.reduce(
      (sum, row) =>
        sum +
        Number(row.rent_amount || 0) +
        Number(row.adjustments || 0) +
        Number(row.late_fee || 0),
      0,
    ),
  );
  const paid = roundMoney(
    monthSchedules.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
  );

  return {
    kpi: {
      key: 'rent_collected',
      label: 'Rent collected this month',
      value: collected,
      count: monthReceipts.length,
      percent: percentOf(paid, due),
      caption: `${percentOf(paid, due)}% of this month's rent collected`,
      format: 'currency',
      tone: 'purple',
      to: '/admin/rent-collections',
    },
  };
}

function buildInventorySection(counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  const available = Number(counts.available || 0);
  return {
    kpi: {
      key: 'available_units',
      label: 'Available units',
      value: available,
      total,
      caption: `${available} of ${total} unit${total === 1 ? '' : 's'}`,
      format: 'number',
      tone: 'brand',
      to: '/admin/units?status=available',
    },
    inventory: {
      total,
      available,
      by_status: UNIT_STATUSES.map((status) => ({
        status,
        label: UNIT_STATUS_LABELS[status] || status,
        count: Number(counts[status] || 0),
        percent: percentOf(counts[status] || 0, total),
      })),
    },
  };
}

function buildPipeline(leads) {
  return LEAD_STATUSES.map((stage) => ({
    stage,
    label: LEAD_STATUS_LABELS[stage] || stage,
    count: leads.filter((lead) => lead.status === stage).length,
    to: `/admin/leads?status=${stage}`,
  }));
}

export function createDashboardRouter({ auth, repository }) {
  const router = Router();

  router.get(
    '/',
    auth.requireAuth,
    auth.requirePermission('dashboard.view'),
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const permissions = req.auth.permissions || [];
      const can = (key) =>
        Boolean(req.auth.user?.full_access) ||
        permissions.includes('*') ||
        permissions.includes(key);

      const canSales = can('sales.view');
      const canRent = can('rent.view');
      const canUnits = can('units.view');
      const canProjects = can('projects.view');
      const canPipeline = can('leads.view');

      const [receipts, installments, sales, schedules, projects, leads, unitCounts] =
        await Promise.all([
          canSales || canRent ? repository.listReceipts(companyId) : [],
          canSales ? repository.listInstallments(companyId) : [],
          canSales ? repository.listSales(companyId) : [],
          canRent ? repository.listRentSchedules(companyId) : [],
          canProjects ? repository.listProjects(companyId) : [],
          canPipeline ? repository.listLeads(companyId) : [],
          canUnits ? repository.listUnitStatusCounts(companyId) : {},
        ]);

      const today = todayIso();
      const monthKey = monthKeyOf(today);
      const kpis = [];

      let installmentsDue = [];
      let recentSales = [];
      if (canSales) {
        const section = buildSalesSection(receipts, installments, sales, monthKey, today);
        kpis.push(...section.kpis);
        installmentsDue = section.installments_due;
        recentSales = section.recent_sales;
      }

      if (canRent) {
        const section = buildRentSection(receipts, schedules, monthKey);
        kpis.push(section.kpi);
      }

      let inventory = null;
      if (canUnits) {
        const section = buildInventorySection(unitCounts);
        kpis.push(section.kpi);
        inventory = section.inventory;
      }

      const projectProgress = canProjects
        ? projects.map((project) => ({
            id: project.id,
            name: project.name,
            code: project.code,
            status: project.status,
            units_count: project.units_count || 0,
            available_units: project.available_units || 0,
            sold_units: project.sold_units || 0,
            rented_units: project.rented_units || 0,
            percent: percentOf(
              Number(project.sold_units || 0) + Number(project.rented_units || 0),
              project.units_count || 0,
            ),
          }))
        : [];

      res.json({
        data: {
          generated_at: new Date().toISOString(),
          month: monthKey,
          sections: {
            sales: canSales,
            rent: canRent,
            inventory: canUnits,
            projects: canProjects,
            pipeline: canPipeline,
          },
          kpis,
          installments_due: installmentsDue,
          recent_sales: recentSales,
          inventory,
          project_progress: projectProgress,
          lead_pipeline: canPipeline ? buildPipeline(leads) : [],
        },
      });
    }),
  );

  return router;
}

export default createDashboardRouter;
