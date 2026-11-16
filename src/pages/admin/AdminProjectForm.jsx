import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, LoaderCircle, Save } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import FormField from '../../components/common/FormField';
import { ApiError } from '../../services/apiClient';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import useToast from '../../hooks/useToast';
import {
  landAreaUnitOptions,
  projectStatusOptions,
  projectTypeOptions,
} from '../../services/inventorySelectors';

const EMPTY_FORM = {
  name: '',
  code: '',
  type: 'residential',
  status: 'planning',
  description: '',
  location: '',
  city: '',
  address: '',
  land_area: '',
  land_area_unit: 'sqft',
  latitude: '',
  longitude: '',
  booking_amount: '',
  budget: '',
  currency: '',
  start_date: '',
  expected_completion_date: '',
  actual_completion_date: '',
  branch_id: '',
  project_manager_id: '',
  video_url: '',
  payment_note: '',
  amenities: '',
  specifications: '',
  nearby_places: '',
  is_published: false,
  is_featured: false,
};

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function listToText(value) {
  if (Array.isArray(value)) return value.join('\n');
  return value || '';
}

function textToList(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function toForm(project) {
  return {
    ...EMPTY_FORM,
    name: project.name || '',
    code: project.code || '',
    type: project.type || 'residential',
    status: project.status || 'planning',
    description: project.description || '',
    location: project.location || '',
    city: project.city || '',
    address: project.address || '',
    land_area: project.land_area ?? '',
    land_area_unit: project.land_area_unit || 'sqft',
    latitude: project.latitude ?? '',
    longitude: project.longitude ?? '',
    booking_amount: project.booking_amount ?? '',
    budget: project.budget ?? '',
    currency: project.currency || '',
    start_date: project.start_date || '',
    expected_completion_date: project.expected_completion_date || '',
    actual_completion_date: project.actual_completion_date || '',
    branch_id: project.branch_id || '',
    project_manager_id: project.project_manager_id || '',
    video_url: project.video_url || '',
    payment_note: project.payment_note || '',
    amenities: listToText(project.amenities),
    specifications: listToText(project.specifications),
    nearby_places: listToText(project.nearby_places),
    is_published: Boolean(project.is_published),
    is_featured: Boolean(project.is_featured),
  };
}

export default function AdminProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const editing = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(editing ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState({ branches: [], users: [] });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [project, lookupData] = await Promise.all([
          editing ? inventoryApiService.getProject(id) : Promise.resolve(null),
          adminApiService.getLookups().catch(() => ({ branches: [], users: [] })),
        ]);
        if (ignore) return;
        if (project) setForm(toForm(project));
        setLookups({
          branches: lookupData.branches || [],
          users: lookupData.users || [],
        });
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'The project could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [editing, id]);

  function updateField(field) {
    return (event) => {
      const value =
        event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        type: form.type,
        status: form.status,
        description: form.description || null,
        location: form.location || null,
        city: form.city || null,
        address: form.address || null,
        land_area: numericOrNull(form.land_area),
        land_area_unit: form.land_area_unit,
        latitude: numericOrNull(form.latitude),
        longitude: numericOrNull(form.longitude),
        booking_amount: numericOrNull(form.booking_amount) ?? 0,
        budget: numericOrNull(form.budget) ?? 0,
        currency: form.currency || null,
        start_date: form.start_date || null,
        expected_completion_date: form.expected_completion_date || null,
        actual_completion_date: form.actual_completion_date || null,
        branch_id: form.branch_id || null,
        project_manager_id: form.project_manager_id || null,
        video_url: form.video_url || null,
        payment_note: form.payment_note || null,
        amenities: textToList(form.amenities),
        specifications: textToList(form.specifications),
        nearby_places: textToList(form.nearby_places),
        is_published: form.is_published,
        is_featured: form.is_featured,
      };

      const project = editing
        ? await inventoryApiService.updateProject(id, payload)
        : await inventoryApiService.createProject(payload);
      addToast(
        editing ? `"${project.name}" was updated.` : `"${project.name}" was created.`,
        'success',
      );
      navigate(`/admin/projects/${project.id}`);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The project could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <Container className="admin-page">
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading project…
        </div>
      </Container>
    );
  }

  if (status === 'error') {
    return (
      <Container className="admin-page">
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Project could not be loaded</strong>
            <p>{loadError}</p>
          </div>
        </div>
        <Link className="button button--secondary button--md" to="/admin/projects">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to projects
        </Link>
      </Container>
    );
  }

  const activeUsers = (lookups.users || []).filter((member) => member.is_active);

  return (
    <>
      <PageMeta
        title={editing ? 'Edit project' : 'New project'}
        description="Create or update a development project and its commercial details."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header admin-page__header--edit">
          <div>
            <Link className="admin-form-page__reference" to={editing ? `/admin/projects/${id}` : '/admin/projects'}>
              <ArrowLeft size={15} aria-hidden="true" />
              {editing ? 'Back to project' : 'Back to projects'}
            </Link>
            <h1 className="admin-page__title">{editing ? 'Edit project' : 'New project'}</h1>
            <p className="admin-page__description">
              The project number is generated from the numbering settings. The web address is
              generated from the name unless you already set one.
            </p>
          </div>
        </div>

        <form className="admin-form" onSubmit={handleSubmit} noValidate>
          {Object.keys(errors).length ? (
            <div className="admin-form__error-summary" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Some fields need attention</strong>
                <p>Please correct the highlighted fields and try again.</p>
              </div>
            </div>
          ) : null}

          <section className="admin-form-section">
            <div className="admin-form-section__heading">
              <span className="admin-form-section__number">01</span>
              <div>
                <h2>Project basics</h2>
                <p>Name, type and lifecycle status.</p>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--two">
              <FormField
                label="Project name"
                id="project-name"
                value={form.name}
                onChange={updateField('name')}
                error={errors.name}
                required
              />
              <FormField
                label="Project code"
                id="project-code"
                value={form.code}
                onChange={updateField('code')}
                error={errors.code}
                hint="Optional. Defaults to the generated number."
              />
              <FormField
                label="Project type"
                id="project-type"
                as="select"
                value={form.type}
                onChange={updateField('type')}
                error={errors.type}
                required
              >
                {projectTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Status"
                id="project-status"
                as="select"
                value={form.status}
                onChange={updateField('status')}
                error={errors.status}
                required
              >
                {projectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section__heading">
              <span className="admin-form-section__number">02</span>
              <div>
                <h2>Location</h2>
                <p>Where the project is and how it appears on the website.</p>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--two">
              <FormField
                label="City"
                id="project-city"
                value={form.city}
                onChange={updateField('city')}
                error={errors.city}
              />
              <FormField
                label="Area or locality"
                id="project-location"
                value={form.location}
                onChange={updateField('location')}
                error={errors.location}
              />
              <FormField
                label="Full address"
                id="project-address"
                as="textarea"
                rows={2}
                className="admin-form-grid__full"
                value={form.address}
                onChange={updateField('address')}
                error={errors.address}
              />
              <FormField
                label="Latitude"
                id="project-latitude"
                type="number"
                step="0.0000001"
                value={form.latitude}
                onChange={updateField('latitude')}
                error={errors.latitude}
              />
              <FormField
                label="Longitude"
                id="project-longitude"
                type="number"
                step="0.0000001"
                value={form.longitude}
                onChange={updateField('longitude')}
                error={errors.longitude}
              />
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section__heading">
              <span className="admin-form-section__number">03</span>
              <div>
                <h2>Commercials</h2>
                <p>Budget, booking amount, land area and currency.</p>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--four">
              <FormField
                label="Budget"
                id="project-budget"
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={updateField('budget')}
                error={errors.budget}
              />
              <FormField
                label="Booking amount"
                id="project-booking"
                type="number"
                min="0"
                step="0.01"
                value={form.booking_amount}
                onChange={updateField('booking_amount')}
                error={errors.booking_amount}
              />
              <FormField
                label="Land area"
                id="project-land-area"
                type="number"
                min="0"
                step="0.01"
                value={form.land_area}
                onChange={updateField('land_area')}
                error={errors.land_area}
              />
              <FormField
                label="Land area unit"
                id="project-land-unit"
                as="select"
                value={form.land_area_unit}
                onChange={updateField('land_area_unit')}
                error={errors.land_area_unit}
              >
                {landAreaUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Currency"
                id="project-currency"
                value={form.currency}
                onChange={updateField('currency')}
                error={errors.currency}
                hint="Three-letter code. Defaults to the company currency."
              />
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section__heading">
              <span className="admin-form-section__number">04</span>
              <div>
                <h2>Timeline and team</h2>
                <p>Dates, branch and the project manager.</p>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--two">
              <FormField
                label="Start date"
                id="project-start-date"
                type="date"
                value={form.start_date}
                onChange={updateField('start_date')}
                error={errors.start_date}
              />
              <FormField
                label="Expected completion"
                id="project-expected-date"
                type="date"
                value={form.expected_completion_date}
                onChange={updateField('expected_completion_date')}
                error={errors.expected_completion_date}
              />
              <FormField
                label="Actual completion"
                id="project-actual-date"
                type="date"
                value={form.actual_completion_date}
                onChange={updateField('actual_completion_date')}
                error={errors.actual_completion_date}
              />
              <FormField
                label="Branch"
                id="project-branch"
                as="select"
                value={form.branch_id}
                onChange={updateField('branch_id')}
                error={errors.branch_id}
              >
                <option value="">Unassigned</option>
                {(lookups.branches || [])
                  .filter((branch) => branch.is_active)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
              </FormField>
              <FormField
                label="Project manager"
                id="project-manager"
                as="select"
                value={form.project_manager_id}
                onChange={updateField('project_manager_id')}
                error={errors.project_manager_id}
              >
                <option value="">Unassigned</option>
                {activeUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.email}
                  </option>
                ))}
              </FormField>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section__heading">
              <span className="admin-form-section__number">05</span>
              <div>
                <h2>Website and details</h2>
                <p>Public listing fields, amenities and internal notes.</p>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--two">
              <FormField
                label="Video URL"
                id="project-video"
                value={form.video_url}
                onChange={updateField('video_url')}
                error={errors.video_url}
              />
              <div className="admin-form-checks">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={updateField('is_published')}
                  />
                  <span>
                    <strong>Published on the website</strong>
                    <small>Only published projects appear on the public site.</small>
                  </span>
                </label>
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={updateField('is_featured')}
                  />
                  <span>
                    <strong>Featured project</strong>
                    <small>Highlights the project in marketing sections.</small>
                  </span>
                </label>
              </div>
              <FormField
                label="Description"
                id="project-description"
                as="textarea"
                rows={4}
                className="admin-form-grid__full"
                value={form.description}
                onChange={updateField('description')}
                error={errors.description}
              />
              <FormField
                label="Amenities"
                id="project-amenities"
                as="textarea"
                rows={3}
                value={form.amenities}
                onChange={updateField('amenities')}
                error={errors.amenities}
                hint="One per line or comma separated."
              />
              <FormField
                label="Specifications"
                id="project-specifications"
                as="textarea"
                rows={3}
                value={form.specifications}
                onChange={updateField('specifications')}
                error={errors.specifications}
                hint="One per line or comma separated."
              />
              <FormField
                label="Nearby places"
                id="project-nearby"
                as="textarea"
                rows={3}
                value={form.nearby_places}
                onChange={updateField('nearby_places')}
                error={errors.nearby_places}
                hint="One per line or comma separated."
              />
              <FormField
                label="Payment note"
                id="project-payment-note"
                as="textarea"
                rows={3}
                value={form.payment_note}
                onChange={updateField('payment_note')}
                error={errors.payment_note}
              />
            </div>
          </section>

          <div className="admin-form__actions">
            <Link
              className="button button--secondary button--md"
              to={editing ? `/admin/projects/${id}` : '/admin/projects'}
            >
              Cancel
            </Link>
            <button type="submit" className="button button--primary button--md" disabled={saving}>
              {saving ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              {saving ? 'Saving…' : editing ? 'Save project' : 'Create project'}
            </button>
          </div>
        </form>
      </Container>
    </>
  );
}
