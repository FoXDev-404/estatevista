import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Hash,
  LoaderCircle,
  Save,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { ApiError } from '../../services/apiClient';
import adminApiService from '../../services/adminApiService';
import { formatSequencePreview } from '../../services/adminFormatters';

const TABS = [
  {
    id: 'profile',
    label: 'Company profile',
    description: 'Legal identity and contact details used across documents and the workspace.',
    icon: Building2,
  },
  {
    id: 'localization',
    label: 'Localization',
    description: 'Currency, timezone, date format and decimal precision for the whole company.',
    icon: CalendarClock,
  },
  {
    id: 'numbering',
    label: 'Number sequences',
    description: 'Prefix, padding and reset period for every document reference.',
    icon: Hash,
  },
];

const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'BDT',
  'AED',
  'SAR',
  'CAD',
  'AUD',
  'SGD',
  'MYR',
  'JPY',
  'CNY',
  'ZAR',
  'KES',
  'NGN',
];

const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const PROFILE_FIELDS = [
  'name',
  'legal_name',
  'registration_number',
  'tax_number',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'postal_code',
  'country',
];

function profileFromCompany(company) {
  const values = {};
  PROFILE_FIELDS.forEach((field) => {
    values[field] = company?.[field] ?? '';
  });
  return values;
}

function localizationFromCompany(company) {
  return {
    currency: company?.currency || 'USD',
    timezone: company?.timezone || 'UTC',
    date_format: company?.date_format || 'YYYY-MM-DD',
    number_decimals: company?.number_decimals ?? 2,
  };
}

function sequenceDraft(row) {
  return {
    prefix: row.prefix,
    padding: row.padding,
    reset_period: row.reset_period,
  };
}

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canEdit = hasPermission('settings.edit');

  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState({ date_formats: [], number_decimals: [], reset_periods: [] });
  const [sequences, setSequences] = useState([]);

  const [profile, setProfile] = useState(profileFromCompany(null));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);

  const [localization, setLocalization] = useState(localizationFromCompany(null));
  const [localizationErrors, setLocalizationErrors] = useState({});
  const [localizationSaving, setLocalizationSaving] = useState(false);

  const [numberingDrafts, setNumberingDrafts] = useState({});
  const [numberingErrors, setNumberingErrors] = useState({});
  const [numberingSaving, setNumberingSaving] = useState(false);

  const tabParam = searchParams.get('tab');
  const activeTab = TABS.some((tab) => tab.id === tabParam) ? tabParam : 'profile';

  const timezones = useMemo(() => {
    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        return Intl.supportedValuesOf('timeZone');
      }
    } catch {
      // Fall back to the short list below.
    }
    return FALLBACK_TIMEZONES;
  }, []);

  const timezoneOptions = useMemo(() => {
    const current = localization.timezone;
    if (current && !timezones.includes(current)) return [current, ...timezones];
    return timezones;
  }, [timezones, localization.timezone]);

  const currencyOptions = useMemo(() => {
    const current = localization.currency;
    if (current && !CURRENCIES.includes(current)) return [current, ...CURRENCIES];
    return CURRENCIES;
  }, [localization.currency]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const result = await adminApiService.getSettings();
        if (ignore) return;
        const data = result.data || {};
        setMeta(result.meta || { date_formats: [], number_decimals: [], reset_periods: [] });
        setSequences(data.sequences || []);
        setProfile(profileFromCompany(data.company));
        setLocalization(localizationFromCompany(data.company));
        setNumberingDrafts(
          Object.fromEntries((data.sequences || []).map((row) => [row.id, sequenceDraft(row)])),
        );
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'Settings could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  function selectTab(tabId) {
    setSearchParams(tabId === 'profile' ? {} : { tab: tabId }, { replace: true });
  }

  function updateProfile(field) {
    return (event) => {
      const value = event.target.value;
      setProfile((current) => ({ ...current, [field]: value }));
      setProfileErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function updateLocalization(field) {
    return (event) => {
      const value = field === 'number_decimals' ? Number(event.target.value) : event.target.value;
      setLocalization((current) => ({ ...current, [field]: value }));
      setLocalizationErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function updateSequence(id, field) {
    return (event) => {
      const raw = event.target.value;
      const value = field === 'padding' ? Number(raw) : raw;
      setNumberingDrafts((current) => ({
        ...current,
        [id]: { ...current[id], [field]: value },
      }));
      setNumberingErrors((current) => ({ ...current, [id]: undefined }));
    };
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!canEdit) return;
    setProfileSaving(true);
    setProfileErrors({});
    try {
      const updated = await adminApiService.updateProfile(profile);
      setProfile(profileFromCompany(updated));
      addToast('Company profile saved.', 'success');
    } catch (error) {
      if (error instanceof ApiError) setProfileErrors(error.fields || {});
      addToast(error.message || 'The profile could not be saved.', 'error');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLocalizationSubmit(event) {
    event.preventDefault();
    if (!canEdit) return;
    setLocalizationSaving(true);
    setLocalizationErrors({});
    try {
      const updated = await adminApiService.updateLocalization(localization);
      setLocalization(localizationFromCompany(updated));
      addToast('Localization settings saved.', 'success');
    } catch (error) {
      if (error instanceof ApiError) setLocalizationErrors(error.fields || {});
      addToast(error.message || 'Localization settings could not be saved.', 'error');
    } finally {
      setLocalizationSaving(false);
    }
  }

  const changedSequences = sequences.filter((row) => {
    const draft = numberingDrafts[row.id];
    if (!draft) return false;
    return (
      draft.prefix !== row.prefix ||
      Number(draft.padding) !== Number(row.padding) ||
      draft.reset_period !== row.reset_period
    );
  });

  async function handleNumberingSubmit(event) {
    event.preventDefault();
    if (!canEdit || !changedSequences.length) return;
    setNumberingSaving(true);
    setNumberingErrors({});
    try {
      const updated = await adminApiService.updateNumbering(
        changedSequences.map((row) => ({
          id: row.id,
          ...numberingDrafts[row.id],
          padding: Number(numberingDrafts[row.id].padding),
        })),
      );
      setSequences((current) =>
        current.map((row) => updated.find((entry) => entry.id === row.id) || row),
      );
      setNumberingDrafts((current) => {
        const next = { ...current };
        updated.forEach((row) => {
          next[row.id] = sequenceDraft(row);
        });
        return next;
      });
      addToast(
        `${updated.length} number sequence${updated.length === 1 ? '' : 's'} saved.`,
        'success',
      );
    } catch (error) {
      if (error instanceof ApiError) setNumberingErrors(error.fields || {});
      addToast(error.message || 'Number sequences could not be saved.', 'error');
    } finally {
      setNumberingSaving(false);
    }
  }

  const activeDefinition = TABS.find((tab) => tab.id === activeTab);

  return (
    <>
      <PageMeta
        title="Company settings"
        description="Manage the company profile, localization and document numbering used across the EstateVista workspace."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Workspace setup</p>
            <h1 className="admin-page__title">Company settings</h1>
            <p className="admin-page__description">
              Company-wide defaults for identity, regional formats and every document reference.
              Changes are recorded in the audit log.
            </p>
          </div>
        </div>

        {status === 'loading' ? (
          <div className="admin-loading" role="status">
            <LoaderCircle size={20} className="spin" aria-hidden="true" />
            Loading settings…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Settings could not be loaded</strong>
              <p>{loadError}</p>
            </div>
          </div>
        ) : null}

        {status === 'ready' ? (
          <>
            <div className="admin-tabs" role="tablist" aria-label="Settings sections">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`settings-tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`settings-panel-${tab.id}`}
                    className={`admin-tab${activeTab === tab.id ? ' is-active' : ''}`}
                    onClick={() => selectTab(tab.id)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <section
              className="admin-panel admin-settings-panel"
              role="tabpanel"
              id={`settings-panel-${activeTab}`}
              aria-labelledby={`settings-tab-${activeTab}`}
            >
              <header className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">{activeDefinition.label}</h2>
                  <p className="admin-panel__description">{activeDefinition.description}</p>
                </div>
                {!canEdit ? <span className="admin-badge">Read only</span> : null}
              </header>

              {activeTab === 'profile' ? (
                <form className="admin-settings-form" onSubmit={handleProfileSubmit} noValidate>
                  <div className="admin-form-grid">
                    <FormField
                      label="Company name"
                      id="settings-company-name"
                      value={profile.name}
                      onChange={updateProfile('name')}
                      error={profileErrors.name}
                      required
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Legal name"
                      id="settings-legal-name"
                      value={profile.legal_name}
                      onChange={updateProfile('legal_name')}
                      error={profileErrors.legal_name}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Registration number"
                      id="settings-registration"
                      value={profile.registration_number}
                      onChange={updateProfile('registration_number')}
                      error={profileErrors.registration_number}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Tax / VAT number"
                      id="settings-tax"
                      value={profile.tax_number}
                      onChange={updateProfile('tax_number')}
                      error={profileErrors.tax_number}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Company email"
                      id="settings-email"
                      type="email"
                      value={profile.email}
                      onChange={updateProfile('email')}
                      error={profileErrors.email}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Phone"
                      id="settings-phone"
                      value={profile.phone}
                      onChange={updateProfile('phone')}
                      error={profileErrors.phone}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Address"
                      id="settings-address"
                      as="textarea"
                      rows={3}
                      className="admin-form-grid__full"
                      value={profile.address}
                      onChange={updateProfile('address')}
                      error={profileErrors.address}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="City"
                      id="settings-city"
                      value={profile.city}
                      onChange={updateProfile('city')}
                      error={profileErrors.city}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="State / region"
                      id="settings-state"
                      value={profile.state}
                      onChange={updateProfile('state')}
                      error={profileErrors.state}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Postal code"
                      id="settings-postal"
                      value={profile.postal_code}
                      onChange={updateProfile('postal_code')}
                      error={profileErrors.postal_code}
                      disabled={!canEdit}
                    />
                    <FormField
                      label="Country"
                      id="settings-country"
                      value={profile.country}
                      onChange={updateProfile('country')}
                      error={profileErrors.country}
                      disabled={!canEdit}
                    />
                  </div>

                  {canEdit ? (
                    <div className="admin-settings-form__actions">
                      <button type="submit" className="button button--primary button--md" disabled={profileSaving}>
                        {profileSaving ? (
                          <LoaderCircle size={16} className="spin" aria-hidden="true" />
                        ) : (
                          <Save size={16} aria-hidden="true" />
                        )}
                        {profileSaving ? 'Saving…' : 'Save profile'}
                      </button>
                    </div>
                  ) : null}
                </form>
              ) : null}

              {activeTab === 'localization' ? (
                <form className="admin-settings-form" onSubmit={handleLocalizationSubmit} noValidate>
                  <div className="admin-form-grid">
                    <FormField
                      label="Currency"
                      id="settings-currency"
                      as="select"
                      value={localization.currency}
                      onChange={updateLocalization('currency')}
                      error={localizationErrors.currency}
                      hint="Used for prices, schedules and collection totals."
                      disabled={!canEdit}
                    >
                      {currencyOptions.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      label="Timezone"
                      id="settings-timezone"
                      as="select"
                      value={localization.timezone}
                      onChange={updateLocalization('timezone')}
                      error={localizationErrors.timezone}
                      disabled={!canEdit}
                    >
                      {timezoneOptions.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      label="Date format"
                      id="settings-date-format"
                      as="select"
                      value={localization.date_format}
                      onChange={updateLocalization('date_format')}
                      error={localizationErrors.date_format}
                      disabled={!canEdit}
                    >
                      {(meta.date_formats || []).map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      label="Number decimals"
                      id="settings-decimals"
                      as="select"
                      value={localization.number_decimals}
                      onChange={updateLocalization('number_decimals')}
                      error={localizationErrors.number_decimals}
                      disabled={!canEdit}
                    >
                      {(meta.number_decimals || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </FormField>
                  </div>

                  {canEdit ? (
                    <div className="admin-settings-form__actions">
                      <button
                        type="submit"
                        className="button button--primary button--md"
                        disabled={localizationSaving}
                      >
                        {localizationSaving ? (
                          <LoaderCircle size={16} className="spin" aria-hidden="true" />
                        ) : (
                          <Save size={16} aria-hidden="true" />
                        )}
                        {localizationSaving ? 'Saving…' : 'Save localization'}
                      </button>
                    </div>
                  ) : null}
                </form>
              ) : null}

              {activeTab === 'numbering' ? (
                <form className="admin-settings-form" onSubmit={handleNumberingSubmit} noValidate>
                  {Object.keys(numberingErrors).length ? (
                    <div className="admin-alert admin-alert--danger" role="alert">
                      <AlertCircle size={18} aria-hidden="true" />
                      <p>Some number sequences need attention before they can be saved.</p>
                    </div>
                  ) : null}

                  <div className="admin-numbering__scroll">
                    <table className="admin-table admin-numbering">
                      <thead>
                        <tr>
                          <th scope="col">Document</th>
                          <th scope="col">Prefix</th>
                          <th scope="col">Padding</th>
                          <th scope="col">Reset</th>
                          <th scope="col">Next preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sequences.map((row) => {
                          const draft = numberingDrafts[row.id] || sequenceDraft(row);
                          return (
                            <tr key={row.id}>
                              <th scope="row">
                                <span className="admin-numbering__label">{row.label}</span>
                                <code>{row.document_type}</code>
                              </th>
                              <td>
                                <input
                                  className="admin-numbering__input"
                                  value={draft.prefix}
                                  onChange={updateSequence(row.id, 'prefix')}
                                  aria-label={`${row.label} prefix`}
                                  maxLength={20}
                                  disabled={!canEdit}
                                />
                                {numberingErrors[row.id] ? (
                                  <span className="admin-numbering__error">{numberingErrors[row.id]}</span>
                                ) : null}
                              </td>
                              <td>
                                <input
                                  className="admin-numbering__input admin-numbering__input--number"
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={draft.padding}
                                  onChange={updateSequence(row.id, 'padding')}
                                  aria-label={`${row.label} padding`}
                                  disabled={!canEdit}
                                />
                              </td>
                              <td>
                                <select
                                  className="admin-numbering__input"
                                  value={draft.reset_period}
                                  onChange={updateSequence(row.id, 'reset_period')}
                                  aria-label={`${row.label} reset period`}
                                  disabled={!canEdit}
                                >
                                  {(meta.reset_periods || []).map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <code className="admin-numbering__preview">
                                  {formatSequencePreview({ ...row, ...draft })}
                                </code>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="admin-settings-form__actions">
                    <p className="admin-settings-form__note">
                      Changing a prefix, padding or reset period affects future numbers only.
                    </p>
                    {canEdit ? (
                      <button
                        type="submit"
                        className="button button--primary button--md"
                        disabled={numberingSaving || !changedSequences.length}
                      >
                        {numberingSaving ? (
                          <LoaderCircle size={16} className="spin" aria-hidden="true" />
                        ) : (
                          <Save size={16} aria-hidden="true" />
                        )}
                        {numberingSaving
                          ? 'Saving…'
                          : changedSequences.length
                            ? `Save ${changedSequences.length} change${changedSequences.length === 1 ? '' : 's'}`
                            : 'No changes'}
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </section>
          </>
        ) : null}
      </Container>
    </>
  );
}
