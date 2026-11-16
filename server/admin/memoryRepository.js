import { randomUUID } from 'node:crypto';
import { ApiError, notFound } from '../lib/errors.js';
import { formatSequencePreview, sortSequences } from './catalog.js';

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
