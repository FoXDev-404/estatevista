import { randomUUID } from 'node:crypto';
import { ApiError, notFound } from '../lib/errors.js';
import { formatSequencePreview, sortSequences } from './catalog.js';
import { installmentStatus, nextDueInstallment, roundMoney } from '../lib/sales.js';

/**
 * In-memory implementation of the admin repository contract. It mirrors the
 * Supabase implementation closely enough for route tests: company scoping,
 * joined role/branch summaries, audit rows and the safety counts used before
 * deactivating a full-access administrator.
 */
export class MemoryAdminRepository {
  constructor({
    companies = [],
    settings = [],
    sequences = [],
    branches = [],
    projects = [],
    buildings = [],
    floors = [],
    unitTypes = [],
    units = [],
    documents = [],
    lookups = [],
    leads = [],
    customers = [],
    leadFollowups = [],
    visits = [],
    quotations = [],
    reservations = [],
    sales = [],
    installmentPlans = [],
    installments = [],
    receipts = [],
    receiptAllocations = [],
    commissionRules = [],
    salesCommissions = [],
    team = [],
    roles = [],
    rolePermissions = {},
  } = {}) {
    this.companies = companies.map((row) => ({ ...row }));
    this.settings = settings.map((row) => ({ ...row }));
    this.sequences = sequences.map((row) => ({ ...row }));
    this.branches = branches.map((row) => ({ ...row }));
    this.projects = projects.map((row) => ({ ...row }));
    this.buildings = buildings.map((row) => ({ ...row }));
    this.floors = floors.map((row) => ({ ...row }));
    this.unitTypes = unitTypes.map((row) => ({ ...row }));
    this.units = units.map((row) => ({ ...row }));
    this.documents = documents.map((row) => ({ ...row }));
    this.lookups = lookups.map((row) => ({ ...row }));
    this.leads = leads.map((row) => ({ ...row }));
    this.customers = customers.map((row) => ({ ...row }));
    this.leadFollowups = leadFollowups.map((row) => ({ ...row }));
    this.visits = visits.map((row) => ({ ...row }));
    this.quotations = quotations.map((row) => ({ ...row }));
    this.reservations = reservations.map((row) => ({ ...row }));
    this.sales = sales.map((row) => ({ ...row }));
    this.installmentPlans = installmentPlans.map((row) => ({ ...row }));
    this.installments = installments.map((row) => ({ ...row }));
    this.receipts = receipts.map((row) => ({ ...row }));
    this.receiptAllocations = receiptAllocations.map((row) => ({ ...row }));
    this.commissionRules = commissionRules.map((row) => ({ ...row }));
    this.salesCommissions = salesCommissions.map((row) => ({ ...row }));
    this.unitStatusHistory = [];
    this.unitContracts = new Map();
    this.team = team.map((row) => ({ ...row, roles: [...(row.roles || [])] }));
    this.roles = roles.map((row) => ({ ...row }));
    this.rolePermissions = new Map(
      Object.entries(rolePermissions).map(([roleId, keys]) => [roleId, [...keys]]),
    );
    this.auditLogs = [];
    this.deletedSessionsFor = [];
  }

  async getCompany(companyId) {
    const company = this.companies.find((row) => row.id === companyId);
    if (!company) throw notFound('Company not found.');
    return { ...company };
  }

  async updateCompany(companyId, patch) {
    const company = this.companies.find((row) => row.id === companyId);
    if (!company) throw notFound('Company not found.');
    Object.assign(company, patch, { updated_at: new Date().toISOString() });
    return { ...company };
  }

  async getSettings(companyId) {
    let settings = this.settings.find((row) => row.company_id === companyId);
    if (!settings) {
      settings = { company_id: companyId, updated_at: new Date().toISOString() };
      this.settings.push(settings);
    }
    return { ...settings };
  }

  async updateSettings(companyId, patch) {
    let settings = this.settings.find((row) => row.company_id === companyId);
    if (!settings) {
      settings = { company_id: companyId };
      this.settings.push(settings);
    }
    Object.assign(settings, patch, { updated_at: new Date().toISOString() });
    return { ...settings };
  }

  async listSequences(companyId) {
    return sortSequences(this.sequences.filter((row) => row.company_id === companyId)).map(
      (row) => ({ ...row }),
    );
  }

  async updateSequence(companyId, id, patch) {
    const sequence = this.sequences.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!sequence) throw notFound('Number sequence not found.');
    Object.assign(sequence, patch, { updated_at: new Date().toISOString() });
    return { ...sequence };
  }

  async nextDocumentNumber(companyId, documentType) {
    const sequence = this.sequences.find(
      (row) => row.company_id === companyId && row.document_type === documentType,
    );
    if (!sequence) {
      throw new ApiError(500, `The ${documentType} number sequence is not configured.`);
    }
    const number = formatSequencePreview(sequence);
    sequence.next_value = Number(sequence.next_value || 0) + 1;
    return number;
  }

  projectSummary(companyId, project) {
    const units = this.units.filter(
      (unit) =>
        unit.company_id === companyId && unit.project_id === project.id && !unit.deleted_at,
    );
    const branch = this.branches.find((row) => row.id === project.branch_id) || null;
    const manager = this.team.find((row) => row.id === project.project_manager_id) || null;
    return {
      ...project,
      buildings_count: this.buildings.filter(
        (row) => row.company_id === companyId && row.project_id === project.id,
      ).length,
      units_count: units.length,
      available_units: units.filter((unit) => unit.status === 'available').length,
      sold_units: units.filter((unit) => unit.status === 'sold').length,
      branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
      project_manager: manager
        ? { id: manager.id, name: manager.name, email: manager.email }
        : null,
    };
  }

  async listProjects(companyId) {
    return this.projects
      .filter((row) => row.company_id === companyId && !row.deleted_at)
      .map((project) => this.projectSummary(companyId, project))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProject(companyId, id) {
    const projects = await this.listProjects(companyId);
    return projects.find((project) => project.id === id) || null;
  }

  async findProjectBySlug(companyId, slug, excludeId = null) {
    const normalized = String(slug).toLowerCase();
    return (
      this.projects.find(
        (row) =>
          row.company_id === companyId &&
          row.id !== excludeId &&
          String(row.slug).toLowerCase() === normalized,
      ) || null
    );
  }

  async createProject(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.projects.push(row);
    return this.getProject(companyId, row.id);
  }

  async updateProject(companyId, id, patch) {
    const project = this.projects.find((row) => row.company_id === companyId && row.id === id);
    if (!project) throw notFound('Project not found.');
    Object.assign(project, patch, { updated_at: new Date().toISOString() });
    return this.getProject(companyId, id);
  }

  async deleteProject(companyId, id) {
    const project = this.projects.find((row) => row.company_id === companyId && row.id === id);
    if (!project) throw notFound('Project not found.');
    project.deleted_at = new Date().toISOString();
  }

  async countProjectUnits(companyId, projectId) {
    return this.units.filter(
      (row) => row.company_id === companyId && row.project_id === projectId && !row.deleted_at,
    ).length;
  }

  async listProjectUnitNumbers(companyId, projectId) {
    return this.units
      .filter((row) => row.company_id === companyId && row.project_id === projectId)
      .map((row) => row.unit_number);
  }

  async listBuildings(companyId, projectId) {
    const buildings = this.buildings.filter(
      (row) => row.company_id === companyId && row.project_id === projectId,
    );
    const floors = this.floors.filter((row) =>
      buildings.some((building) => building.id === row.building_id),
    );
    const units = this.units.filter(
      (row) => row.company_id === companyId && row.project_id === projectId && !row.deleted_at,
    );

    return buildings
      .map((building) => ({
        ...building,
        units_count: units.filter((unit) => unit.building_id === building.id).length,
        floors: floors
          .filter((floor) => floor.building_id === building.id)
          .sort((a, b) => a.number - b.number)
          .map((floor) => ({
            ...floor,
            units_count: units.filter((unit) => unit.floor_id === floor.id).length,
          })),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  async getBuilding(companyId, id) {
    const building = this.buildings.find((row) => row.company_id === companyId && row.id === id);
    if (!building) return null;
    const rows = await this.listBuildings(companyId, building.project_id);
    return rows.find((row) => row.id === id) || null;
  }

  async createBuilding(companyId, projectId, patch) {
    const duplicate = this.buildings.find(
      (row) =>
        row.company_id === companyId &&
        row.project_id === projectId &&
        row.code.toLowerCase() === patch.code.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError(422, 'A building with this code already exists in the project.', {
        code: 'Choose a different building code.',
      });
    }

    const building = {
      id: randomUUID(),
      company_id: companyId,
      project_id: projectId,
      code: patch.code,
      name: patch.name,
      floors_count: patch.floors_count,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.buildings.push(building);

    for (let number = 1; number <= patch.floors_count; number += 1) {
      this.floors.push({
        id: randomUUID(),
        company_id: companyId,
        building_id: building.id,
        number,
        name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return this.getBuilding(companyId, building.id);
  }

  async updateBuilding(companyId, id, patch) {
    const building = this.buildings.find((row) => row.company_id === companyId && row.id === id);
    if (!building) throw notFound('Building not found.');
    Object.assign(building, patch, { updated_at: new Date().toISOString() });
    return this.getBuilding(companyId, id);
  }

  async deleteBuilding(companyId, id) {
    this.buildings = this.buildings.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
    this.floors = this.floors.filter((row) => row.building_id !== id);
  }

  async createFloor(companyId, buildingId, patch) {
    const duplicate = this.floors.find(
      (row) => row.company_id === companyId && row.building_id === buildingId && row.number === patch.number,
    );
    if (duplicate) {
      throw new ApiError(422, 'This floor number already exists in the building.', {
        number: 'Choose a different floor number.',
      });
    }
    const floor = {
      id: randomUUID(),
      company_id: companyId,
      building_id: buildingId,
      number: patch.number,
      name: patch.name ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.floors.push(floor);
    return { ...floor, units_count: 0 };
  }

  async deleteFloor(companyId, buildingId, floorId) {
    this.floors = this.floors.filter(
      (row) =>
        !(row.company_id === companyId && row.building_id === buildingId && row.id === floorId),
    );
  }

  async listUnitTypes(companyId) {
    return this.unitTypes
      .filter((row) => row.company_id === companyId && row.is_active !== false)
      .map((row) => ({ ...row }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  }

  async getUnitType(companyId, id) {
    return (
      this.unitTypes.find(
        (row) => row.company_id === companyId && row.id === id && row.is_active !== false,
      ) || null
    );
  }

  unitSummary(unit) {
    const project = this.projects.find((row) => row.id === unit.project_id) || null;
    const building = this.buildings.find((row) => row.id === unit.building_id) || null;
    const floor = this.floors.find((row) => row.id === unit.floor_id) || null;
    const unitType = this.unitTypes.find((row) => row.id === unit.unit_type_id) || null;
    return {
      ...unit,
      project: project
        ? {
            id: project.id,
            name: project.name,
            number: project.number,
            code: project.code,
            currency: project.currency,
          }
        : null,
      building: building
        ? { id: building.id, code: building.code, name: building.name }
        : null,
      floor: floor ? { id: floor.id, number: floor.number, name: floor.name } : null,
      unit_type: unitType ? { id: unitType.id, name: unitType.name } : null,
    };
  }

  async listUnits(companyId, filters = {}) {
    const search = String(filters.search || '').trim().toLowerCase();
    let rows = this.units.filter((row) => row.company_id === companyId && !row.deleted_at);

    if (filters.project_id) rows = rows.filter((row) => row.project_id === filters.project_id);
    if (filters.building_id) rows = rows.filter((row) => row.building_id === filters.building_id);
    if (filters.unit_type_id) rows = rows.filter((row) => row.unit_type_id === filters.unit_type_id);
    if (filters.status) rows = rows.filter((row) => row.status === filters.status);
    if (search) {
      rows = rows.filter((row) => row.unit_number.toLowerCase().includes(search));
    }

    rows = [...rows].sort((a, b) =>
      a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }),
    );
    const total = rows.length;
    const from = Number.isFinite(filters.from) ? filters.from : 0;
    const to = Number.isFinite(filters.to) ? filters.to : total - 1;

    return {
      data: rows.slice(from, to + 1).map((unit) => this.unitSummary(unit)),
      total,
    };
  }

  async getUnit(companyId, id) {
    const unit = this.units.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    return unit ? this.unitSummary(unit) : null;
  }

  async findUnitByNumber(companyId, projectId, unitNumber, excludeId = null) {
    return (
      this.units.find(
        (row) =>
          row.company_id === companyId &&
          row.project_id === projectId &&
          row.id !== excludeId &&
          row.unit_number === unitNumber,
      ) || null
    );
  }

  async createUnit(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      status: 'available',
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.units.push(row);
    return this.getUnit(companyId, row.id);
  }

  async createUnits(companyId, rows) {
    const ids = [];
    for (const patch of rows) {
      const row = {
        id: randomUUID(),
        company_id: companyId,
        status: 'available',
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...patch,
      };
      this.units.push(row);
      ids.push(row.id);
    }
    return ids.map((id) => {
      const row = this.units.find((unit) => unit.id === id);
      return this.unitSummary(row);
    });
  }

  async updateUnit(companyId, id, patch) {
    const unit = this.units.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!unit) throw notFound('Unit not found.');
    Object.assign(unit, patch, { updated_at: new Date().toISOString() });
    return this.getUnit(companyId, id);
  }

  async updateUnitStatus(companyId, id, { status, reason, changedBy }) {
    const unit = this.units.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!unit) throw notFound('Unit not found.');
    const fromStatus = unit.status;
    unit.status = status;
    unit.updated_at = new Date().toISOString();
    this.unitStatusHistory.push({
      id: randomUUID(),
      company_id: companyId,
      unit_id: id,
      from_status: fromStatus,
      to_status: status,
      reason: reason || null,
      changed_by: changedBy || null,
      created_at: new Date().toISOString(),
    });
    return this.getUnit(companyId, id);
  }

  async listUnitHistory(companyId, unitId) {
    return this.unitStatusHistory
      .filter((row) => row.company_id === companyId && row.unit_id === unitId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((row) => {
        const user = this.team.find((member) => member.id === row.changed_by) || null;
        return {
          ...row,
          changed_by_user: user ? { id: user.id, name: user.name } : null,
        };
      });
  }

  async deleteUnit(companyId, id) {
    const unit = this.units.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!unit) throw notFound('Unit not found.');
    unit.deleted_at = new Date().toISOString();
  }

  setUnitActiveContracts(unitId, contracts = {}) {
    this.unitContracts.set(unitId, {
      reservations: 0,
      sales: 0,
      leases: 0,
      ...contracts,
    });
  }

  async countActiveUnitContracts(companyId, unitId) {
    const unit = this.units.find((row) => row.company_id === companyId && row.id === unitId);
    if (!unit) return { reservations: 0, sales: 0, leases: 0 };
    return {
      reservations: 0,
      sales: 0,
      leases: 0,
      ...(this.unitContracts.get(unitId) || {}),
    };
  }

  async listDocuments(companyId, { ownerType = null, ownerId = null } = {}) {
    return this.documents
      .filter((row) => row.company_id === companyId)
      .filter((row) => !ownerType || row.owner_type === ownerType)
      .filter((row) => !ownerId || row.owner_id === ownerId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((row) => ({ ...row }));
  }

  async createDocument(companyId, document) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      owner_type: document.ownerType,
      owner_id: document.ownerId,
      category: document.category,
      file_name: document.fileName,
      storage_path: `memory://${companyId}/${document.ownerType}/${document.ownerId}/${document.fileName}`,
      mime_type: document.mimeType,
      size_bytes: document.sizeBytes,
      uploaded_by: document.uploadedBy,
      created_at: new Date().toISOString(),
    };
    this.documents.push(row);
    return { ...row };
  }

  async getDocument(companyId, id) {
    return this.documents.find((row) => row.company_id === companyId && row.id === id) || null;
  }

  async deleteDocument(companyId, id) {
    this.documents = this.documents.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
  }

  // --- CRM: leads, follow-ups, customers and visits -------------------

  getLookup(companyId, id, listKey = null) {
    return (
      this.lookups.find(
        (row) =>
          row.company_id === companyId &&
          row.id === id &&
          (!listKey || row.list_key === listKey) &&
          row.is_active !== false,
      ) || null
    );
  }

  leadSummary(companyId, lead) {
    const project = this.projects.find((row) => row.id === lead.project_id) || null;
    const unit = this.units.find((row) => row.id === lead.unit_id && !row.deleted_at) || null;
    const source = this.lookups.find((row) => row.id === lead.source_id) || null;
    const assigned = this.team.find((row) => row.id === lead.assigned_to) || null;
    return {
      ...lead,
      project: project ? { id: project.id, name: project.name } : null,
      unit: unit ? { id: unit.id, unit_number: unit.unit_number, status: unit.status } : null,
      source: source ? { id: source.id, name: source.name } : null,
      assigned_user: assigned
        ? { id: assigned.id, name: assigned.name, email: assigned.email }
        : null,
    };
  }

  async listLeads(companyId) {
    return this.leads
      .filter((row) => row.company_id === companyId && !row.deleted_at)
      .map((row) => this.leadWithNextFollowup(companyId, row))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  async getLead(companyId, id) {
    const lead = this.leads.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!lead) return null;
    return this.leadWithNextFollowup(companyId, lead);
  }

  leadWithNextFollowup(companyId, lead) {
    const next = this.leadFollowups
      .filter(
        (row) =>
          row.company_id === companyId &&
          row.lead_id === lead.id &&
          !row.completed_at &&
          row.scheduled_at,
      )
      .map((row) => row.scheduled_at)
      .sort()[0];
    return { ...this.leadSummary(companyId, lead), next_followup_at: next || null };
  }

  async createLead(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      branch_id: patch.branch_id ?? null,
      source_id: patch.source_id ?? null,
      assigned_to: patch.assigned_to ?? null,
      project_id: patch.project_id ?? null,
      unit_id: patch.unit_id ?? null,
      name: patch.name,
      phone: patch.phone ?? null,
      email: patch.email ?? null,
      status: patch.status ?? 'new',
      lost_reason: patch.lost_reason ?? null,
      budget_min: patch.budget_min ?? null,
      budget_max: patch.budget_max ?? null,
      notes: patch.notes ?? null,
      created_by: patch.created_by ?? null,
      updated_by: patch.updated_by ?? null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.leads.push(row);
    return this.getLead(companyId, row.id);
  }

  async updateLead(companyId, id, patch) {
    const lead = this.leads.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!lead) throw notFound('Lead not found.');
    Object.assign(lead, patch, { updated_at: new Date().toISOString() });
    return this.getLead(companyId, id);
  }

  async deleteLead(companyId, id) {
    const lead = this.leads.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!lead) throw notFound('Lead not found.');
    lead.deleted_at = new Date().toISOString();
    lead.updated_at = lead.deleted_at;
  }

  async listLeadFollowups(companyId, leadId) {
    return this.leadFollowups
      .filter((row) => row.company_id === companyId && row.lead_id === leadId)
      .map((row) => ({
        ...row,
        created_by_user: this.team.find((member) => member.id === row.created_by) || null,
      }))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  async createLeadFollowup(companyId, leadId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      lead_id: leadId,
      type: patch.type ?? 'note',
      scheduled_at: patch.scheduled_at ?? null,
      completed_at: null,
      outcome: null,
      notes: patch.notes ?? null,
      created_by: patch.created_by ?? null,
      created_at: new Date().toISOString(),
    };
    this.leadFollowups.push(row);
    return {
      ...row,
      created_by_user: this.team.find((member) => member.id === row.created_by) || null,
    };
  }

  async updateLeadFollowup(companyId, leadId, followupId, patch) {
    const followup = this.leadFollowups.find(
      (row) =>
        row.company_id === companyId && row.lead_id === leadId && row.id === followupId,
    );
    if (!followup) throw notFound('Follow-up not found.');
    Object.assign(followup, patch);
    if (patch.completed_at !== undefined) {
      followup.completed_at = patch.completed_at;
    }
    return {
      ...followup,
      created_by_user: this.team.find((member) => member.id === followup.created_by) || null,
    };
  }

  customerSummary(companyId, customer) {
    const source = this.lookups.find((row) => row.id === customer.source_id) || null;
    const lead = this.leads.find((row) => row.id === customer.lead_id) || null;
    return {
      ...customer,
      source: source ? { id: source.id, name: source.name } : null,
      lead: lead ? { id: lead.id, name: lead.name } : null,
      // Sales and installment data arrives with WP5; keep the list columns at 0.
      units_bought: 0,
      balance_due: 0,
    };
  }

  async listCustomers(companyId) {
    return this.customers
      .filter((row) => row.company_id === companyId && !row.deleted_at)
      .map((row) => this.customerSummary(companyId, row))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCustomer(companyId, id) {
    const customer = this.customers.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    return customer ? this.customerSummary(companyId, customer) : null;
  }

  async findCustomerByLead(companyId, leadId) {
    const customer = this.customers.find(
      (row) => row.company_id === companyId && row.lead_id === leadId && !row.deleted_at,
    );
    return customer ? this.customerSummary(companyId, customer) : null;
  }

  async createCustomer(companyId, patch) {
    if (patch.lead_id) {
      const existing = this.customers.find(
        (row) => row.company_id === companyId && row.lead_id === patch.lead_id,
      );
      if (existing) {
        throw new ApiError(409, 'This lead has already been converted to a customer.');
      }
    }
    const row = {
      id: randomUUID(),
      company_id: companyId,
      lead_id: patch.lead_id ?? null,
      source_id: patch.source_id ?? null,
      name: patch.name,
      type: patch.type ?? 'individual',
      phone: patch.phone ?? null,
      alternate_phone: patch.alternate_phone ?? null,
      email: patch.email ?? null,
      national_id: patch.national_id ?? null,
      date_of_birth: patch.date_of_birth ?? null,
      occupation: patch.occupation ?? null,
      address: patch.address ?? null,
      city: patch.city ?? null,
      country: patch.country ?? null,
      is_active: patch.is_active ?? true,
      created_by: patch.created_by ?? null,
      updated_by: patch.updated_by ?? null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.customers.push(row);
    return this.getCustomer(companyId, row.id);
  }

  async updateCustomer(companyId, id, patch) {
    const customer = this.customers.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!customer) throw notFound('Customer not found.');
    Object.assign(customer, patch, { updated_at: new Date().toISOString() });
    return this.getCustomer(companyId, id);
  }

  async deleteCustomer(companyId, id) {
    const customer = this.customers.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!customer) throw notFound('Customer not found.');
    customer.deleted_at = new Date().toISOString();
    customer.updated_at = customer.deleted_at;
    customer.lead_id = null;
  }

  // --- Sales: quotations, reservations, sales, receipts, commissions ---

  quotationSummary(companyId, quotation) {
    const customer = this.customers.find((row) => row.id === quotation.customer_id) || null;
    const lead = this.leads.find((row) => row.id === quotation.lead_id) || null;
    const unit = this.units.find((row) => row.id === quotation.unit_id && !row.deleted_at) || null;
    const salesperson = this.team.find((row) => row.id === quotation.salesperson_id) || null;
    return {
      ...quotation,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      lead: lead ? { id: lead.id, name: lead.name } : null,
      unit: unit ? this.unitSummary(unit) : null,
      salesperson: salesperson ? { id: salesperson.id, name: salesperson.name } : null,
    };
  }

  async listQuotations(companyId) {
    return this.quotations
      .filter((row) => row.company_id === companyId && !row.deleted_at)
      .map((row) => this.quotationSummary(companyId, row))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  async getQuotation(companyId, id) {
    const quotation = this.quotations.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    return quotation ? this.quotationSummary(companyId, quotation) : null;
  }

  async createQuotation(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      ...patch,
    };
    this.quotations.push(row);
    return this.getQuotation(companyId, row.id);
  }

  async updateQuotation(companyId, id, patch) {
    const quotation = this.quotations.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!quotation) throw notFound('Quotation not found.');
    Object.assign(quotation, patch, { updated_at: new Date().toISOString() });
    return this.getQuotation(companyId, id);
  }

  async deleteQuotation(companyId, id) {
    const quotation = this.quotations.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!quotation) throw notFound('Quotation not found.');
    quotation.deleted_at = new Date().toISOString();
    quotation.updated_at = quotation.deleted_at;
  }

  reservationSummary(companyId, reservation) {
    const customer = this.customers.find((row) => row.id === reservation.customer_id) || null;
    const unit = this.units.find((row) => row.id === reservation.unit_id && !row.deleted_at) || null;
    const sale = this.sales.find((row) => row.id === reservation.converted_sale_id) || null;
    return {
      ...reservation,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      unit: unit ? this.unitSummary(unit) : null,
      converted_sale: sale ? { id: sale.id, number: sale.number } : null,
    };
  }

  async listReservations(companyId) {
    return this.reservations
      .filter((row) => row.company_id === companyId)
      .map((row) => this.reservationSummary(companyId, row))
      .sort((a, b) => String(b.reserved_on).localeCompare(String(a.reserved_on)));
  }

  async getReservation(companyId, id) {
    const reservation = this.reservations.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    return reservation ? this.reservationSummary(companyId, reservation) : null;
  }

  async createReservation(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.reservations.push(row);
    return this.getReservation(companyId, row.id);
  }

  async updateReservation(companyId, id, patch) {
    const reservation = this.reservations.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!reservation) throw notFound('Reservation not found.');
    Object.assign(reservation, patch, { updated_at: new Date().toISOString() });
    return this.getReservation(companyId, id);
  }

  async findActiveReservationForUnit(companyId, unitId, excludeId = null) {
    return (
      this.reservations.find(
        (row) =>
          row.company_id === companyId &&
          row.unit_id === unitId &&
          row.id !== excludeId &&
          row.status === 'active',
      ) || null
    );
  }

  async findActiveSaleForUnit(companyId, unitId, excludeId = null) {
    return (
      this.sales.find(
        (row) =>
          row.company_id === companyId &&
          row.unit_id === unitId &&
          row.id !== excludeId &&
          ['pending_approval', 'active', 'fully_paid'].includes(row.status),
      ) || null
    );
  }

  async expireReservations(companyId, today) {
    const expired = this.reservations.filter(
      (row) =>
        row.company_id === companyId &&
        row.status === 'active' &&
        String(row.expires_at).slice(0, 10) < String(today).slice(0, 10),
    );
    for (const reservation of expired) {
      reservation.status = 'expired';
      reservation.updated_at = new Date().toISOString();
      const unit = this.units.find((row) => row.id === reservation.unit_id && !row.deleted_at);
      if (!unit || unit.status !== 'reserved') continue;
      const [otherReservation, activeSale] = await Promise.all([
        this.findActiveReservationForUnit(companyId, unit.id, reservation.id),
        this.findActiveSaleForUnit(companyId, unit.id),
      ]);
      if (!otherReservation && !activeSale) {
        await this.updateUnitStatus(companyId, unit.id, {
          status: 'available',
          reason: `Reservation ${reservation.number} expired`,
          changedBy: null,
        });
      }
    }
    return expired.length;
  }

  installmentView(companyId, installment) {
    const plan = this.installmentPlans.find((row) => row.id === installment.plan_id) || null;
    const graceDays = Number(plan?.grace_days || 0);
    const status = installmentStatus(installment, {
      today: new Date().toISOString().slice(0, 10),
      graceDays,
    });
    const gross = Number(installment.amount || 0) + Number(installment.late_fee || 0);
    const balance =
      status === 'waived' || status === 'cancelled'
        ? 0
        : roundMoney(gross - Number(installment.paid_amount || 0));
    return {
      ...installment,
      status,
      grace_days: graceDays,
      balance,
    };
  }

  installmentWithSale(companyId, installment) {
    const sale = this.sales.find((row) => row.id === installment.sale_id) || null;
    const unit = sale ? this.units.find((row) => row.id === sale.unit_id) || null : null;
    const customer = sale
      ? this.customers.find((row) => row.id === sale.customer_id) || null
      : null;
    return {
      ...this.installmentView(companyId, installment),
      sale: sale
        ? {
            id: sale.id,
            number: sale.number,
            customer_id: sale.customer_id,
            unit_id: sale.unit_id,
            project_id: unit?.project_id || null,
            net_price: sale.net_price,
            customer: customer ? { id: customer.id, name: customer.name } : null,
            unit: unit ? { id: unit.id, unit_number: unit.unit_number } : null,
          }
        : null,
    };
  }

  saleSummary(companyId, sale) {
    const customer = this.customers.find((row) => row.id === sale.customer_id) || null;
    const unit = this.units.find((row) => row.id === sale.unit_id && !row.deleted_at) || null;
    const salesperson = this.team.find((row) => row.id === sale.salesperson_id) || null;
    const plan = this.installmentPlans.find((row) => row.sale_id === sale.id) || null;
    const installments = this.installments
      .filter((row) => row.sale_id === sale.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((row) => this.installmentView(companyId, row));
    const nextDue = nextDueInstallment(installments);
    const balanceDue = roundMoney(
      installments
        .filter((row) => !['waived', 'cancelled'].includes(row.status))
        .reduce((sum, row) => sum + Number(row.balance || 0), 0),
    );
    return {
      ...sale,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      unit: unit ? this.unitSummary(unit) : null,
      salesperson: salesperson ? { id: salesperson.id, name: salesperson.name } : null,
      plan,
      installments,
      balance_due: balanceDue,
      overdue_amount: roundMoney(
        installments
          .filter((row) => row.status === 'overdue')
          .reduce((sum, row) => sum + Number(row.balance || 0), 0),
      ),
      next_due: nextDue,
    };
  }

  async listSales(companyId) {
    return this.sales
      .filter((row) => row.company_id === companyId && !row.deleted_at)
      .map((row) => this.saleSummary(companyId, row))
      .sort((a, b) => String(b.agreement_date).localeCompare(String(a.agreement_date)));
  }

  async getSale(companyId, id) {
    const sale = this.sales.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    return sale ? this.saleSummary(companyId, sale) : null;
  }

  async createSale(companyId, { sale, plan, installments }) {
    const saleRow = {
      id: randomUUID(),
      company_id: companyId,
      status: 'active',
      collected_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      ...sale,
    };
    this.sales.push(saleRow);

    const planRow = {
      id: randomUUID(),
      company_id: companyId,
      sale_id: saleRow.id,
      created_at: new Date().toISOString(),
      ...plan,
    };
    this.installmentPlans.push(planRow);

    for (const installment of installments) {
      this.installments.push({
        id: randomUUID(),
        company_id: companyId,
        plan_id: planRow.id,
        sale_id: saleRow.id,
        late_fee: 0,
        paid_amount: 0,
        status: 'upcoming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...installment,
        balance: roundMoney(Number(installment.amount || 0)),
      });
    }

    const unit = this.units.find((row) => row.id === saleRow.unit_id && !row.deleted_at);
    if (unit && unit.status !== 'sold') {
      await this.updateUnitStatus(companyId, unit.id, {
        status: 'sold',
        reason: `Sale ${saleRow.number}`,
        changedBy: saleRow.created_by || null,
      });
    }

    return this.getSale(companyId, saleRow.id);
  }

  async updateSale(companyId, id, patch) {
    const sale = this.sales.find(
      (row) => row.company_id === companyId && row.id === id && !row.deleted_at,
    );
    if (!sale) throw notFound('Sale not found.');
    Object.assign(sale, patch, { updated_at: new Date().toISOString() });
    return this.saleSummary(companyId, sale);
  }

  async listInstallments(companyId) {
    return this.installments
      .filter((row) => row.company_id === companyId)
      .map((row) => this.installmentWithSale(companyId, row))
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }

  async getInstallment(companyId, id) {
    const installment = this.installments.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    return installment ? this.installmentWithSale(companyId, installment) : null;
  }

  async updateInstallment(companyId, saleId, id, patch) {
    const installment = this.installments.find(
      (row) => row.company_id === companyId && row.sale_id === saleId && row.id === id,
    );
    if (!installment) throw notFound('Installment not found.');
    const next = { ...patch };
    if (['waived', 'cancelled'].includes(next.status)) next.balance = 0;
    Object.assign(installment, next, { updated_at: new Date().toISOString() });
    return this.installmentView(companyId, installment);
  }

  receiptSummary(companyId, receipt) {
    const customer = this.customers.find((row) => row.id === receipt.customer_id) || null;
    const allocations = this.receiptAllocations
      .filter((row) => row.receipt_id === receipt.id)
      .map((allocation) => {
        const installment = this.installments.find((row) => row.id === allocation.installment_id);
        const sale = installment
          ? this.sales.find((row) => row.id === installment.sale_id)
          : null;
        return {
          ...allocation,
          installment: installment
            ? {
                id: installment.id,
                sequence: installment.sequence,
                due_date: installment.due_date,
                amount: installment.amount,
              }
            : null,
          sale: sale ? { id: sale.id, number: sale.number } : null,
        };
      });
    return {
      ...receipt,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      allocations,
      settles: allocations
        .map((row) => row.sale?.number)
        .filter((value, index, all) => value && all.indexOf(value) === index)
        .join(', '),
    };
  }

  async listReceipts(companyId) {
    return this.receipts
      .filter((row) => row.company_id === companyId)
      .map((row) => this.receiptSummary(companyId, row))
      .sort((a, b) => String(b.received_on).localeCompare(String(a.received_on)));
  }

  async getReceipt(companyId, id) {
    const receipt = this.receipts.find((row) => row.company_id === companyId && row.id === id);
    return receipt ? this.receiptSummary(companyId, receipt) : null;
  }

  async refreshSaleCollected(companyId, saleId) {
    const sale = this.sales.find((row) => row.company_id === companyId && row.id === saleId);
    if (!sale) return;
    const plan = this.installmentPlans.find((row) => row.sale_id === saleId);
    const completedIds = new Set(
      this.receipts
        .filter((row) => row.company_id === companyId && row.status === 'completed')
        .map((row) => row.id),
    );
    const allocated = this.receiptAllocations
      .filter((row) => completedIds.has(row.receipt_id))
      .filter((row) => {
        const installment = this.installments.find((item) => item.id === row.installment_id);
        return installment?.sale_id === saleId;
      })
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const downPayment = Number(plan?.down_payment || 0);
    sale.collected_amount = roundMoney(downPayment + allocated);
    sale.status =
      sale.status === 'cancelled'
        ? 'cancelled'
        : sale.collected_amount + 0.005 >= Number(sale.net_price || 0)
          ? 'fully_paid'
          : 'active';
    sale.updated_at = new Date().toISOString();
  }

  async createReceipt(companyId, payload) {
    const { allocations = [], ...input } = payload;
    const receipt = {
      id: randomUUID(),
      company_id: companyId,
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...input,
    };
    this.receipts.push(receipt);

    for (const allocation of allocations) {
      const installment = this.installments.find(
        (row) => row.company_id === companyId && row.id === allocation.installment_id,
      );
      if (!installment) throw notFound('Installment not found.');
      this.receiptAllocations.push({
        id: randomUUID(),
        company_id: companyId,
        receipt_id: receipt.id,
        installment_id: installment.id,
        amount: roundMoney(allocation.amount),
        created_at: new Date().toISOString(),
      });
      installment.paid_amount = roundMoney(
        Number(installment.paid_amount || 0) + Number(allocation.amount),
      );
      installment.balance = roundMoney(
        Number(installment.amount || 0) +
          Number(installment.late_fee || 0) -
          Number(installment.paid_amount || 0),
      );
      installment.status = installment.balance <= 0.005 ? 'paid' : 'partly_paid';
      installment.updated_at = new Date().toISOString();
    }

    for (const sale of this.sales.filter(
      (row) => row.company_id === companyId && allocations.some((allocation) => {
        const installment = this.installments.find((item) => item.id === allocation.installment_id);
        return installment?.sale_id === row.id;
      }),
    )) {
      await this.refreshSaleCollected(companyId, sale.id);
    }
    return this.getReceipt(companyId, receipt.id);
  }

  async voidReceipt(companyId, id, { reason, userId }) {
    const receipt = this.receipts.find((row) => row.company_id === companyId && row.id === id);
    if (!receipt) throw notFound('Receipt not found.');
    if (receipt.status !== 'completed') {
      throw new ApiError(422, 'Only a completed receipt can be voided.');
    }
    const allocations = this.receiptAllocations.filter((row) => row.receipt_id === receipt.id);
    const saleIds = new Set();
    for (const allocation of allocations) {
      const installment = this.installments.find((row) => row.id === allocation.installment_id);
      if (!installment) continue;
      saleIds.add(installment.sale_id);
      installment.paid_amount = roundMoney(
        Math.max(0, Number(installment.paid_amount || 0) - Number(allocation.amount)),
      );
      installment.balance = roundMoney(
        Number(installment.amount || 0) +
          Number(installment.late_fee || 0) -
          Number(installment.paid_amount || 0),
      );
      installment.status = installment.paid_amount > 0 ? 'partly_paid' : 'upcoming';
      installment.updated_at = new Date().toISOString();
    }
    receipt.status = 'voided';
    receipt.voided_at = new Date().toISOString();
    receipt.void_reason = reason || null;
    receipt.updated_at = receipt.voided_at;
    receipt.voided_by = userId || null;

    for (const saleId of saleIds) {
      await this.refreshSaleCollected(companyId, saleId);
    }
    return this.getReceipt(companyId, receipt.id);
  }

  async listCommissionRules(companyId) {
    return this.commissionRules
      .filter((row) => row.company_id === companyId)
      .map((row) => ({ ...row }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCommissionRule(companyId, id) {
    return (
      this.commissionRules.find((row) => row.company_id === companyId && row.id === id) || null
    );
  }

  async createCommissionRule(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.commissionRules.push(row);
    return { ...row };
  }

  async updateCommissionRule(companyId, id, patch) {
    const rule = this.commissionRules.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!rule) throw notFound('Commission rule not found.');
    Object.assign(rule, patch, { updated_at: new Date().toISOString() });
    return { ...rule };
  }

  async deleteCommissionRule(companyId, id) {
    const rule = this.commissionRules.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!rule) throw notFound('Commission rule not found.');
    this.commissionRules = this.commissionRules.filter((row) => row.id !== id);
    for (const commission of this.salesCommissions) {
      if (commission.rule_id === id) commission.rule_id = null;
    }
  }

  commissionSummary(companyId, commission) {
    const sale = this.sales.find((row) => row.id === commission.sale_id) || null;
    const salesperson = this.team.find((row) => row.id === commission.salesperson_id) || null;
    const rule = this.commissionRules.find((row) => row.id === commission.rule_id) || null;
    return {
      ...commission,
      sale: sale ? { id: sale.id, number: sale.number, net_price: sale.net_price } : null,
      salesperson: salesperson ? { id: salesperson.id, name: salesperson.name } : null,
      rule: rule ? { id: rule.id, name: rule.name } : null,
    };
  }

  async listSalesCommissions(companyId, filters = {}) {
    return this.salesCommissions
      .filter((row) => row.company_id === companyId)
      .filter((row) => !filters.sale_id || row.sale_id === filters.sale_id)
      .filter((row) => !filters.status || row.status === filters.status)
      .filter((row) => !filters.salesperson_id || row.salesperson_id === filters.salesperson_id)
      .map((row) => this.commissionSummary(companyId, row))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  async getSalesCommission(companyId, id) {
    const commission = this.salesCommissions.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    return commission ? this.commissionSummary(companyId, commission) : null;
  }

  async createSalesCommission(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.salesCommissions.push(row);
    return this.commissionSummary(companyId, row);
  }

  async updateSalesCommission(companyId, id, patch) {
    const commission = this.salesCommissions.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!commission) throw notFound('Commission entry not found.');
    Object.assign(commission, patch, { updated_at: new Date().toISOString() });
    return this.commissionSummary(companyId, commission);
  }

  visitSummary(companyId, visit) {
    const lead = this.leads.find((row) => row.id === visit.lead_id) || null;
    const customer = this.customers.find((row) => row.id === visit.customer_id) || null;
    const project = this.projects.find((row) => row.id === visit.project_id) || null;
    const unit = this.units.find((row) => row.id === visit.unit_id && !row.deleted_at) || null;
    const salesperson = this.team.find((row) => row.id === visit.salesperson_id) || null;
    return {
      ...visit,
      lead: lead ? { id: lead.id, name: lead.name } : null,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      project: project ? { id: project.id, name: project.name } : null,
      unit: unit ? { id: unit.id, unit_number: unit.unit_number } : null,
      salesperson: salesperson
        ? { id: salesperson.id, name: salesperson.name }
        : null,
    };
  }

  async listVisits(companyId, filters = {}) {
    return this.visits
      .filter((row) => row.company_id === companyId)
      .filter((row) => !filters.leadId || row.lead_id === filters.leadId)
      .filter((row) => !filters.customerId || row.customer_id === filters.customerId)
      .filter((row) => !filters.projectId || row.project_id === filters.projectId)
      .filter((row) => !filters.salespersonId || row.salesperson_id === filters.salespersonId)
      .filter((row) => !filters.status || row.status === filters.status)
      .map((row) => this.visitSummary(companyId, row))
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  }

  async getVisit(companyId, id) {
    const visit = this.visits.find((row) => row.company_id === companyId && row.id === id);
    return visit ? this.visitSummary(companyId, visit) : null;
  }

  async createVisit(companyId, patch) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      lead_id: patch.lead_id ?? null,
      customer_id: patch.customer_id ?? null,
      project_id: patch.project_id ?? null,
      unit_id: patch.unit_id ?? null,
      salesperson_id: patch.salesperson_id ?? null,
      scheduled_at: patch.scheduled_at,
      status: patch.status ?? 'scheduled',
      notes: patch.notes ?? null,
      created_by: patch.created_by ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.visits.push(row);
    return this.getVisit(companyId, row.id);
  }

  async updateVisit(companyId, id, patch) {
    const visit = this.visits.find((row) => row.company_id === companyId && row.id === id);
    if (!visit) throw notFound('Visit not found.');
    Object.assign(visit, patch, { updated_at: new Date().toISOString() });
    return this.getVisit(companyId, id);
  }

  async deleteVisit(companyId, id) {
    this.visits = this.visits.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
  }

  async listBranches(companyId) {
    const companyTeam = this.team.filter((row) => row.company_id === companyId);
    return this.branches
      .filter((row) => row.company_id === companyId)
      .map((branch) => {
        const manager = companyTeam.find((member) => member.id === branch.manager_id) || null;
        return {
          ...branch,
          team_count: companyTeam.filter((member) => member.branch_id === branch.id).length,
          manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBranch(companyId, id) {
    const branches = await this.listBranches(companyId);
    return branches.find((branch) => branch.id === id) || null;
  }

  async createBranch(companyId, patch) {
    const duplicate = this.branches.find(
      (row) => row.company_id === companyId && row.code.toLowerCase() === patch.code.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError(422, 'A branch with this code already exists.', {
        code: 'Choose a different branch code.',
      });
    }

    const row = {
      id: randomUUID(),
      company_id: companyId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.branches.push(row);
    return this.getBranch(companyId, row.id);
  }

  async updateBranch(companyId, id, patch) {
    const branch = this.branches.find((row) => row.company_id === companyId && row.id === id);
    if (!branch) throw notFound('Branch not found.');
    Object.assign(branch, patch, { updated_at: new Date().toISOString() });
    return this.getBranch(companyId, id);
  }

  async deleteBranch(companyId, id) {
    this.branches = this.branches.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
  }

  async countBranchTeam(companyId, branchId) {
    return this.team.filter(
      (row) => row.company_id === companyId && row.branch_id === branchId,
    ).length;
  }

  async countBranchProjects(companyId, branchId) {
    return this.projects.filter(
      (row) => row.company_id === companyId && row.branch_id === branchId,
    ).length;
  }

  async listTeam(companyId) {
    const branches = this.branches.filter((row) => row.company_id === companyId);
    return this.team
      .filter((row) => row.company_id === companyId)
      .map((member) => {
        const { password_hash: _ignored, ...safe } = member;
        const branch = branches.find((row) => row.id === member.branch_id) || null;
        return {
          ...safe,
          branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
          roles: [...(member.roles || [])],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTeamMember(companyId, id) {
    const members = await this.listTeam(companyId);
    return members.find((member) => member.id === id) || null;
  }

  async findTeamMemberByEmail(companyId, email) {
    const member = this.team.find(
      (row) =>
        row.company_id === companyId &&
        row.email.toLowerCase() === String(email).trim().toLowerCase(),
    );
    return member ? { id: member.id, email: member.email } : null;
  }

  async createTeamMember(companyId, user, roleIds = []) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      branch_id: null,
      full_access: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      roles: roleIds
        .map((roleId) => this.roles.find((role) => role.id === roleId))
        .filter(Boolean)
        .map((role) => ({ id: role.id, name: role.name })),
      ...user,
    };
    this.team.push(row);
    return this.getTeamMember(companyId, row.id);
  }

  async updateTeamMember(companyId, id, patch, roleIds) {
    const member = this.team.find((row) => row.company_id === companyId && row.id === id);
    if (!member) throw notFound('Team member not found.');
    Object.assign(member, patch, { updated_at: new Date().toISOString() });

    if (Array.isArray(roleIds)) {
      member.roles = roleIds
        .map((roleId) => this.roles.find((role) => role.id === roleId))
        .filter(Boolean)
        .map((role) => ({ id: role.id, name: role.name }));
    }
    return this.getTeamMember(companyId, id);
  }

  async countActiveFullAccess(companyId, excludeId = null) {
    return this.team.filter(
      (row) =>
        row.company_id === companyId &&
        row.full_access &&
        row.is_active &&
        row.id !== excludeId,
    ).length;
  }

  async deleteSessionsForUser(userId) {
    this.deletedSessionsFor.push(userId);
  }

  async listRoles(companyId) {
    return this.roles
      .filter((row) => row.company_id === companyId)
      .map((role) => ({
        ...role,
        member_count: this.team.filter((member) =>
          (member.roles || []).some((assigned) => assigned.id === role.id),
        ).length,
        permission_count: (this.rolePermissions.get(role.id) || []).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRole(companyId, id) {
    const role = this.roles.find((row) => row.company_id === companyId && row.id === id);
    if (!role) return null;
    return {
      ...role,
      permission_keys: [...(this.rolePermissions.get(role.id) || [])].sort(),
      member_count: this.team.filter((member) =>
        (member.roles || []).some((assigned) => assigned.id === role.id),
      ).length,
    };
  }

  async listPermissions() {
    const keys = new Set();
    for (const values of this.rolePermissions.values()) {
      for (const key of values) keys.add(key);
    }
    return [...keys].sort().map((key, index) => ({ id: index + 1, key }));
  }

  async permissionIdsForKeys(keys = []) {
    const rows = await this.listPermissions();
    const wanted = new Set(keys);
    return rows.filter((row) => wanted.has(row.key)).map((row) => row.id);
  }

  async replaceRolePermissions(roleId, permissionKeys) {
    this.rolePermissions.set(roleId, [...new Set(permissionKeys)].sort());
  }

  async createRole(companyId, role, permissionKeys) {
    const duplicate = this.roles.find(
      (row) => row.company_id === companyId && row.name.toLowerCase() === role.name.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError(422, 'A role with this name already exists.', {
        name: 'Choose a different role name.',
      });
    }

    const row = {
      id: randomUUID(),
      company_id: companyId,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...role,
    };
    this.roles.push(row);
    await this.replaceRolePermissions(row.id, permissionKeys);
    return this.getRole(companyId, row.id);
  }

  async updateRole(companyId, id, patch, permissionKeys) {
    const role = this.roles.find((row) => row.company_id === companyId && row.id === id);
    if (!role) throw notFound('Role not found.');
    Object.assign(role, patch, { updated_at: new Date().toISOString() });
    if (Array.isArray(permissionKeys)) {
      await this.replaceRolePermissions(id, permissionKeys);
    }
    return this.getRole(companyId, id);
  }

  async deleteRole(companyId, id) {
    this.roles = this.roles.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
    this.rolePermissions.delete(id);
  }

  async listAuditLogs(companyId, filters = {}) {
    const { page = 1, limit = 25, userId, module, event, dateFrom, dateTo } = filters;
    let rows = this.auditLogs.filter((row) => row.company_id === companyId);

    if (userId) rows = rows.filter((row) => row.user_id === userId);
    if (module) rows = rows.filter((row) => row.module === module);
    if (event) rows = rows.filter((row) => row.event === event);
    if (dateFrom) rows = rows.filter((row) => row.created_at >= dateFrom);
    if (dateTo) rows = rows.filter((row) => row.created_at <= dateTo);

    rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const total = rows.length;
    const from = (page - 1) * limit;

    return {
      data: rows.slice(from, from + limit).map((row) => ({
        ...row,
        user: this.team.find((member) => member.id === row.user_id) || null,
      })),
      total,
    };
  }

  async listAuditOptions(companyId) {
    const rows = this.auditLogs.filter((row) => row.company_id === companyId);
    return {
      modules: [...new Set(rows.map((row) => row.module).filter(Boolean))].sort(),
      users: this.team
        .filter((row) => row.company_id === companyId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          is_active: row.is_active,
        })),
    };
  }

  async getLookups(companyId) {
    return {
      branches: this.branches
        .filter((row) => row.company_id === companyId)
        .map((row) => ({ id: row.id, name: row.name, code: row.code, is_active: row.is_active })),
      roles: this.roles
        .filter((row) => row.company_id === companyId)
        .map((row) => ({ id: row.id, name: row.name, is_default: row.is_default })),
      users: this.team
        .filter((row) => row.company_id === companyId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          is_active: row.is_active,
          full_access: row.full_access,
          branch_id: row.branch_id,
        })),
      unit_types: this.unitTypes
        .filter((row) => row.company_id === companyId && row.is_active !== false)
        .map((row) => ({ id: row.id, name: row.name, sort_order: row.sort_order }))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name)),
      sources: this.lookups
        .filter(
          (row) =>
            row.company_id === companyId && row.list_key === 'source' && row.is_active !== false,
        )
        .map((row) => ({ id: row.id, name: row.name, sort_order: row.sort_order }))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name)),
    };
  }

  async writeAudit(entry) {
    const row = {
      id: this.auditLogs.length + 1,
      created_at: new Date().toISOString(),
      ...entry,
      company_id: entry.companyId ?? entry.company_id,
      user_id: entry.userId ?? entry.user_id ?? null,
      before_data: entry.before ?? entry.before_data ?? null,
      after_data: entry.after ?? entry.after_data ?? null,
    };
    delete row.companyId;
    delete row.userId;
    delete row.before;
    delete row.after;
    this.auditLogs.push(row);
  }
}

export default MemoryAdminRepository;
