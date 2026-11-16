import { ApiError, validationError } from '../lib/errors.js';

export async function loadSource(repository, companyId, sourceId) {
  if (!sourceId) return null;
  const source = await repository.getLookup(companyId, sourceId, 'source');
  if (!source) {
    throw validationError({ source_id: 'Choose a source from this company.' });
  }
  return source;
}

export async function loadTeamMember(repository, companyId, userId, field) {
  if (!userId) return null;
  const member = await repository.getTeamMember(companyId, userId);
  if (!member) {
    throw validationError({ [field]: 'Choose a team member from this company.' });
  }
  return member;
}

export async function loadProject(repository, companyId, projectId, field = 'project_id') {
  if (!projectId) return null;
  const project = await repository.getProject(companyId, projectId);
  if (!project) {
    throw validationError({ [field]: 'Choose a project from this company.' });
  }
  return project;
}

export async function loadUnit(repository, companyId, unitId, field = 'unit_id') {
  if (!unitId) return null;
  const unit = await repository.getUnit(companyId, unitId);
  if (!unit) {
    throw validationError({ [field]: 'Choose a unit from this company.' });
  }
  return unit;
}

export async function requireLead(repository, companyId, leadId) {
  const lead = await repository.getLead(companyId, leadId);
  if (!lead) throw new ApiError(404, 'Lead not found.');
  return lead;
}

export async function requireCustomer(repository, companyId, customerId) {
  const customer = await repository.getCustomer(companyId, customerId);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  return customer;
}

/**
 * Validates the optional project/unit pair on a lead or visit. Choosing a unit
 * without a project adopts the unit's project, and a mismatched pair is rejected.
 */
export async function resolveProjectUnit(repository, companyId, input) {
  if (!input.unit_id) {
    await loadProject(repository, companyId, input.project_id);
    return input;
  }

  const unit = await loadUnit(repository, companyId, input.unit_id);
  if (input.project_id && unit.project_id !== input.project_id) {
    await loadProject(repository, companyId, input.project_id);
    throw validationError({ unit_id: 'Choose a unit from the selected project.' });
  }
  return { ...input, project_id: input.project_id || unit.project_id };
}
