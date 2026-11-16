import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Flag,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  StickyNote,
  Trash2,
  UserCheck,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import LeadFormModal from '../../components/admin/crm/LeadFormModal';
import FollowupModal from '../../components/admin/crm/FollowupModal';
import VisitFormModal from '../../components/admin/crm/VisitFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import crmApiService from '../../services/crmApiService';
import {
  budgetLabel,
  followupTypeOptions,
  labelFor,
  leadInterestLabel,
  leadStageFlow,
  leadStageOptions,
  leadStageTone,
  visitActions,
  visitStatusOptions,
  visitStatusTone,
} from '../../services/crmSelectors';
import { formatDateTime } from '../../services/adminFormatters';

const FOLLOWUP_ICONS = {
  call: PhoneCall,
  meeting: CalendarCheck,
  email: Mail,
  whatsapp: MessageCircle,
  site_visit: MapPin,
  note: StickyNote,
};

function followupEvent(followup) {
  const Icon = FOLLOWUP_ICONS[followup.type] || StickyNote;
  return {
    kind: 'followup',
    id: followup.id,
    at: followup.completed_at || followup.scheduled_at || followup.created_at,
    icon: Icon,
    title: `${labelFor(followupTypeOptions, followup.type)} ${
      followup.completed_at ? 'completed' : 'scheduled'
    }`,
    badge: followup.completed_at
      ? { label: 'Completed', tone: 'success' }
      : { label: 'Open', tone: 'gold' },
    meta: [
      followup.scheduled_at ? `Scheduled ${formatDateTime(followup.scheduled_at)}` : null,
      followup.created_by_user?.name ? `By ${followup.created_by_user.name}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    notes: followup.notes,
    outcome: followup.outcome,
    data: followup,
  };
}

function visitEvent(visit) {
  return {
    kind: 'visit',
    id: visit.id,
    at: visit.scheduled_at || visit.created_at,
    icon: CalendarDays,
    title: `Site visit · ${visit.project?.name || 'Project'}`,
    badge: {
      label: labelFor(visitStatusOptions, visit.status),
      tone: visitStatusTone(visit.status),
    },
    meta: [
      formatDateTime(visit.scheduled_at),
      visit.unit?.unit_number ? `Unit ${visit.unit.unit_number}` : null,
      visit.salesperson?.name ? `With ${visit.salesperson.name}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    notes: visit.notes,
    data: visit,
  };
}

export default function AdminLeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();

  const canEditLead = hasPermission('leads.edit');
  const canDeleteLead = hasPermission('leads.delete');
  const canCreateCustomer = hasPermission('customers.create');
  const canCreateVisit = hasPermission('visits.create');
  const canEditVisit = hasPermission('visits.edit');

  const [lead, setLead] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [visitForm, setVisitForm] = useState(null);
  const [stageTarget, setStageTarget] = useState(null);
  const [stageError, setStageError] = useState({});
  const [stageSaving, setStageSaving] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [outcomeError, setOutcomeError] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [converting, setConverting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [visitBusyId, setVisitBusyId] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminApiService.getLookups().catch(() => ({ users: [], sources: [] })),
      inventoryApiService.listProjects({}).catch(() => ({ data: [] })),
      inventoryApiService.listUnits({ limit: 100 }).catch(() => ({ data: [] })),
    ]).then(([lookups, projectResult, unitResult]) => {
      if (ignore) return;
      setSources(lookups.sources || []);
      setUsers(lookups.users || []);
      setProjects(projectResult.data || []);
      setUnits(unitResult.data || []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    crmApiService
      .getLead(id)
      .then((data) => {
        if (ignore) return;
        setLead(data);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.status === 404 ? 'This lead could not be found.' : error.message);
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [id, reloadKey]);

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  function openStage(targetStatus) {
    setStageError({});
    setStageTarget({ status: targetStatus, lost_reason: '' });
  }

  async function handleStageSubmit(event) {
    event.preventDefault();
    if (!stageTarget) return;
    setStageSaving(true);
    setStageError({});
    try {
      await crmApiService.updateLeadStatus(lead.id, {
        status: stageTarget.status,
        lost_reason: stageTarget.status === 'lost' ? stageTarget.lost_reason : null,
      });
      addToast(`Lead moved to ${labelFor(leadStageOptions, stageTarget.status)}.`, 'success');
      setStageTarget(null);
      refresh();
    } catch (error) {
      setStageError(
        error.fields || {
          form: error.message || 'The stage could not be changed.',
        },
      );
      addToast(error.message || 'The stage could not be changed.', 'error');
    } finally {
      setStageSaving(false);
    }
  }

  async function handleCompleteFollowup(event) {
    event.preventDefault();
    if (!completeTarget) return;
    setCompleteSaving(true);
    setOutcomeError('');
    try {
      await crmApiService.updateFollowup(lead.id, completeTarget.id, { outcome });
      addToast('Follow-up completed.', 'success');
      setCompleteTarget(null);
      setOutcome('');
      refresh();
    } catch (error) {
      setOutcomeError(error.fields?.outcome || error.message || 'The follow-up could not be completed.');
    } finally {
      setCompleteSaving(false);
    }
  }

  async function handleConvert() {
    setConverting(true);
    setConvertError('');
    try {
      const result = await crmApiService.convertLead(lead.id);
      addToast(`Customer ${result.customer.name} was created.`, 'success');
      setConvertOpen(false);
      refresh();
    } catch (error) {
      setConvertError(error.message || 'The lead could not be converted.');
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await crmApiService.deleteLead(lead.id);
      addToast(`Lead ${lead.name} was deleted.`, 'success');
      navigate('/admin/leads');
    } catch (error) {
      setDeleteError(error.message || 'The lead could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  async function changeVisitStatus(visit, nextStatus) {
    setVisitBusyId(visit.id);
    try {
      await crmApiService.updateVisit(visit.id, { status: nextStatus });
      addToast(`Visit marked ${labelFor(visitStatusOptions, nextStatus).toLowerCase()}.`, 'success');
      refresh();
    } catch (error) {
      addToast(error.message || 'The visit could not be updated.', 'error');
    } finally {
      setVisitBusyId(null);
    }
  }

  if (status === 'loading') {
    return (
      <Container className="admin-page">
        <PageMeta title="Lead" noIndex />
        <Link className="back-link" to="/admin/leads">
          <ArrowLeft size={14} aria-hidden="true" />
          All leads
        </Link>
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading lead…
        </div>
      </Container>
    );
  }

  if (status === 'error' || !lead) {
    return (
      <Container className="admin-page">
        <PageMeta title="Lead" noIndex />
        <Link className="back-link" to="/admin/leads">
          <ArrowLeft size={14} aria-hidden="true" />
          All leads
        </Link>
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Lead could not be loaded</strong>
            <p>{loadError}</p>
          </div>
        </div>
      </Container>
    );
  }

  const stageIndex = leadStageFlow.findIndex((option) => option.value === lead.status);
  const events = [
    ...(lead.followups || []).map(followupEvent),
    ...(lead.visits || []).map(visitEvent),
  ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  const currency = company?.currency || 'USD';
  const converted = Boolean(lead.customer);

  return (
    <>
      <PageMeta
        title={`${lead.name} · Lead`}
        description="Lead profile, activity and site visits."
        noIndex
      />
      <Container className="admin-page">
        <Link className="back-link" to="/admin/leads">
          <ArrowLeft size={14} aria-hidden="true" />
          All leads
        </Link>

        <div className="admin-page__header admin-page__header--edit">
          <div>
            <p className="eyebrow">Lead</p>
            <div className="admin-project-detail__title">
              <h1 className="admin-page__title">{lead.name}</h1>
              <span className={`admin-badge admin-badge--${leadStageTone(lead.status)}`}>
                {labelFor(leadStageOptions, lead.status)}
              </span>
            </div>
            <p className="admin-page__meta">
              <span>Created {formatDateTime(lead.created_at)}</span>
              <span>Updated {formatDateTime(lead.updated_at)}</span>
              {lead.source?.name ? <span>Source: {lead.source.name}</span> : null}
            </p>
          </div>

          <div className="admin-page__actions">
            {canEditLead ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => setFollowupOpen(true)}
              >
                <CalendarPlus size={15} aria-hidden="true" />
                Schedule follow-up
              </button>
            ) : null}
            {canCreateVisit ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() =>
                  setVisitForm({
                    defaults: {
                      lead_id: lead.id,
                      project_id: lead.project_id || '',
                      unit_id: lead.unit_id || '',
                    },
                  })
                }
              >
                <CalendarDays size={15} aria-hidden="true" />
                Schedule visit
              </button>
            ) : null}
            {canEditLead ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => setLeadFormOpen(true)}
              >
                <Pencil size={15} aria-hidden="true" />
                Edit
              </button>
            ) : null}
            {canEditLead && lead.status !== 'lost' ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => openStage('lost')}
              >
                <Flag size={15} aria-hidden="true" />
                Mark as lost
              </button>
            ) : null}
            {canEditLead && canCreateCustomer && !converted && lead.status !== 'lost' ? (
              <button
                type="button"
                className="button button--primary button--md"
                onClick={() => {
                  setConvertError('');
                  setConvertOpen(true);
                }}
              >
                <UserCheck size={15} aria-hidden="true" />
                Convert to customer
              </button>
            ) : null}
            {canDeleteLead ? (
              <button
                type="button"
                className="button button--danger button--md"
                onClick={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="crm-detail">
          <div className="crm-detail__main">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">Pipeline stage</h2>
                  <p className="admin-panel__description">
                    Click a stage to move the lead. Lost leads require a reason.
                  </p>
                </div>
              </div>
              <div className="crm-panel__body">
                <ol className="crm-stepper">
                  {leadStageFlow.map((option, index) => {
                    const state =
                      stageIndex === -1
                        ? ''
                        : index < stageIndex
                          ? 'done'
                          : index === stageIndex
                            ? 'current'
                            : '';
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          className={`crm-step${state ? ` crm-step--${state}` : ''}`}
                          onClick={() => openStage(option.value)}
                          disabled={!canEditLead}
                          aria-current={state === 'current' ? 'step' : undefined}
                        >
                          <span className="crm-step__index">
                            {state === 'done' ? (
                              <CircleCheck size={16} aria-hidden="true" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="crm-step__label">{option.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {lead.status === 'lost' ? (
                  <div className="admin-alert admin-alert--danger crm-stage-lost" role="status">
                    <Flag size={18} aria-hidden="true" />
                    <div>
                      <strong>Lead marked as lost</strong>
                      <p>{lead.lost_reason || 'No reason was recorded.'}</p>
                    </div>
                  </div>
                ) : null}
                {converted ? (
                  <div className="admin-alert crm-stage-converted" role="status">
                    <UserCheck size={18} aria-hidden="true" />
                    <div>
                      <strong>Converted customer</strong>
                      <p>
                        {lead.customer.name}{' '}
                        <Link to={`/admin/customers?search=${encodeURIComponent(lead.customer.name)}`}>
                          Open in customers
                        </Link>
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">Activity</h2>
                  <p className="admin-panel__description">
                    Follow-ups and site visits in reverse chronological order.
                  </p>
                </div>
                {canEditLead ? (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => setFollowupOpen(true)}
                  >
                    <CalendarPlus size={15} aria-hidden="true" />
                    <span>Add follow-up</span>
                  </button>
                ) : null}
              </div>
              {events.length ? (
                <ol className="crm-timeline">
                  {events.map((event) => {
                    const Icon = event.icon;
                    return (
                      <li key={`${event.kind}-${event.id}`} className="crm-timeline__item">
                        <span className={`crm-timeline__marker crm-timeline__marker--${event.kind}`}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <div className="crm-timeline__body">
                          <div className="crm-timeline__header">
                            <strong>{event.title}</strong>
                            <span className={`admin-badge admin-badge--${event.badge.tone}`}>
                              {event.badge.label}
                            </span>
                          </div>
                          {event.meta ? (
                            <p className="crm-timeline__meta">{event.meta}</p>
                          ) : null}
                          {event.notes ? (
                            <p className="crm-timeline__notes">{event.notes}</p>
                          ) : null}
                          {event.outcome ? (
                            <p className="crm-timeline__outcome">
                              <span>Outcome</span>
                              {event.outcome}
                            </p>
                          ) : null}

                          {event.kind === 'followup' && !event.data.completed_at && canEditLead ? (
                            <div className="crm-timeline__actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => {
                                  setOutcome('');
                                  setOutcomeError('');
                                  setCompleteTarget(event.data);
                                }}
                              >
                                <CircleCheck size={15} aria-hidden="true" />
                                <span>Complete</span>
                              </button>
                            </div>
                          ) : null}

                          {event.kind === 'visit' ? (
                            <div className="crm-timeline__actions">
                              {canEditVisit ? (
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() => setVisitForm({ visit: event.data })}
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                  <span>Edit</span>
                                </button>
                              ) : null}
                              {canEditVisit
                                ? visitActions(event.data.status).map((action) => (
                                    <button
                                      key={action.status}
                                      type="button"
                                      className={`table-action${
                                        action.status === 'cancelled' ||
                                        action.status === 'no_show'
                                          ? ' table-action--danger'
                                          : ''
                                      }`}
                                      onClick={() => changeVisitStatus(event.data, action.status)}
                                      disabled={visitBusyId === event.data.id}
                                    >
                                      {action.label}
                                    </button>
                                  ))
                                : null}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="crm-timeline-empty">
                  <p>No activity yet.</p>
                  <p>Schedule a call, meeting or site visit to start the history.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="crm-detail__side">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <h2 className="admin-panel__title">Contact</h2>
              </div>
              <dl className="crm-facts">
                <div>
                  <dt>Phone</dt>
                  <dd>
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`}>
                        <Phone size={13} aria-hidden="true" />
                        {lead.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`}>
                        <Mail size={13} aria-hidden="true" />
                        {lead.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{lead.source?.name || '—'}</dd>
                </div>
                <div>
                  <dt>Assigned to</dt>
                  <dd>{lead.assigned_user?.name || 'Unassigned'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <h2 className="admin-panel__title">Enquiry</h2>
              </div>
              <dl className="crm-facts">
                <div>
                  <dt>Interest</dt>
                  <dd>{leadInterestLabel(lead)}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>{budgetLabel(lead, currency)}</dd>
                </div>
              </dl>
              {lead.notes ? (
                <div className="crm-notes">
                  <span>Notes</span>
                  <p>{lead.notes}</p>
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </Container>

      {leadFormOpen ? (
        <LeadFormModal
          lead={lead}
          projects={projects}
          units={units}
          users={users}
          sources={sources}
          onClose={() => setLeadFormOpen(false)}
          onSaved={refresh}
        />
      ) : null}

      {followupOpen ? (
        <FollowupModal
          leadId={lead.id}
          onClose={() => setFollowupOpen(false)}
          onSaved={refresh}
        />
      ) : null}

      {visitForm ? (
        <VisitFormModal
          key={visitForm.visit?.id || 'new-visit'}
          visit={visitForm.visit || null}
          defaults={visitForm.defaults || {}}
          leads={visitForm.visit?.lead ? [visitForm.visit.lead] : [lead]}
          customers={visitForm.visit?.customer ? [visitForm.visit.customer] : []}
          projects={projects}
          units={units}
          users={users}
          onClose={() => setVisitForm(null)}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={Boolean(stageTarget)}
        onClose={() => (stageSaving ? null : setStageTarget(null))}
        title={
          stageTarget
            ? `Move lead to ${labelFor(leadStageOptions, stageTarget.status)}`
            : 'Move lead'
        }
        description={
          stageTarget?.status === 'lost'
            ? 'Record why the lead was lost so the pipeline history stays clear.'
            : 'The stage change is recorded in the audit log.'
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setStageTarget(null)}
              disabled={stageSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lead-stage-form"
              className="button button--primary button--md"
              disabled={stageSaving}
            >
              {stageSaving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {stageSaving ? 'Saving…' : 'Move stage'}
            </button>
          </>
        }
      >
        <form id="lead-stage-form" className="admin-modal-form" onSubmit={handleStageSubmit} noValidate>
          {stageTarget?.status === 'lost' ? (
            <FormField
              label="Reason lost"
              id="lead-stage-reason"
              as="textarea"
              rows="3"
              value={stageTarget.lost_reason}
              onChange={(event) =>
                setStageTarget((current) => ({ ...current, lost_reason: event.target.value }))
              }
              error={stageError.lost_reason}
              required
            />
          ) : (
            <p className="admin-modal-note">
              This moves the lead from {labelFor(leadStageOptions, lead.status)} to{' '}
              {stageTarget ? labelFor(leadStageOptions, stageTarget.status) : ''}.
            </p>
          )}
          {stageError.form ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <p>{stageError.form}</p>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => (completeSaving ? null : setCompleteTarget(null))}
        title="Complete follow-up"
        description="Record the outcome so the next person knows what happened."
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setCompleteTarget(null)}
              disabled={completeSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="complete-followup-form"
              className="button button--primary button--md"
              disabled={completeSaving}
            >
              {completeSaving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {completeSaving ? 'Saving…' : 'Complete follow-up'}
            </button>
          </>
        }
      >
        <form
          id="complete-followup-form"
          className="admin-modal-form"
          onSubmit={handleCompleteFollowup}
          noValidate
        >
          <FormField
            label="Outcome"
            id="followup-outcome"
            as="textarea"
            rows="3"
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value);
              setOutcomeError('');
            }}
            error={outcomeError}
            hint="Optional, but useful for the activity history."
          />
        </form>
      </Modal>

      <Modal
        open={convertOpen}
        onClose={() => (converting ? null : setConvertOpen(false))}
        title="Convert lead to customer"
        description={`Create a customer record for ${lead.name} and mark this lead as won. The lead keeps its activity history.`}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setConvertOpen(false)}
              disabled={converting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary button--md"
              onClick={handleConvert}
              disabled={converting}
            >
              {converting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {converting ? 'Converting…' : 'Convert lead'}
            </button>
          </>
        }
      >
        {convertError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{convertError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">
            A lead can only be converted once. The customer receives the lead&apos;s name, phone,
            email and source.
          </p>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        title="Delete lead"
        description={`Delete ${lead.name}? The lead is hidden from the workspace but its audit history is kept.`}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {deleting ? 'Deleting…' : 'Delete lead'}
            </button>
          </>
        }
      >
        {deleteError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{deleteError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">This action is recorded in the audit log.</p>
        )}
      </Modal>
    </>
  );
}
