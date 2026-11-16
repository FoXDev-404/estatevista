import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarClock,
  FileSignature,
  Handshake,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  UserPlus,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import dashboardApiService from '../../services/dashboardApiService';
import {
  agingLabel,
  inventoryRows,
  pipelineBarPercent,
  projectPercent,
} from '../../services/dashboardSelectors';
import { installmentStatusOptions, installmentTone, labelFor, saleTone } from '../../services/salesSelectors';
import { statusTone } from '../../services/inventorySelectors';
import { formatDate, formatNumber, formatPrice } from '../../services/formatters';

const KPI_ICONS = {
  sales_collected: Banknote,
  overdue_installments: TriangleAlert,
  rent_collected: CalendarClock,
  available_units: Building2,
};

function SectionPanel({ title, description, icon: Icon, action, children }) {
  return (
    <section className="admin-panel dashboard-panel">
      <div className="admin-panel__header">
        <div>
          <h2 className="admin-panel__title">
            <Icon size={18} aria-hidden="true" />
            {title}
          </h2>
          {description ? <p className="admin-panel__description">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboard() {
  const { company } = useAuth();
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const currency = company?.currency || 'INR';

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setError('');
      try {
        const result = await dashboardApiService.getDashboard();
        if (ignore) return;
        setData(result);
        setStatus('ready');
      } catch (loadError) {
        if (ignore) return;
        setError(loadError.message || 'The dashboard could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const money = (value) => formatPrice(Number(value) || 0, currency);
  const kpis = data?.kpis || [];
  const sections = data?.sections || {};
  const installmentsDue = data?.installments_due || [];
  const recentSales = data?.recent_sales || [];
  const inventory = data?.inventory;
  const inventoryStatusRows = inventoryRows(inventory);
  const projectProgress = data?.project_progress || [];
  const leadPipeline = data?.lead_pipeline || [];
  const hasSections = Object.values(sections).some(Boolean);

  return (
    <>
      <PageMeta
        title="Dashboard"
        description="A live overview of collections, receivables, inventory and the sales pipeline."
        noIndex
      />
      <Container className="admin-page dashboard-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Overview</p>
            <h1 className="admin-page__title">Dashboard</h1>
            <p className="admin-page__description">
              Collections, overdue balances, inventory and the pipeline in one place. Figures come
              from the same records as each module.
            </p>
          </div>
          <div className="dashboard-header__actions">
            {data?.generated_at ? (
              <span className="dashboard-header__stamp">
                Updated {new Date(data.generated_at).toLocaleString()}
              </span>
            ) : null}
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={status === 'loading'}
            >
              <RefreshCw
                size={15}
                className={status === 'loading' ? 'spin' : undefined}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </div>

        {status === 'error' ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Dashboard could not be loaded</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {status === 'loading' && !data ? (
          <div className="admin-loading" role="status">
            <LoaderCircle size={20} className="spin" aria-hidden="true" />
            Loading dashboard…
          </div>
        ) : null}

        {status !== 'error' && data ? (
          <>
            {kpis.length ? (
              <section className="admin-stats admin-stats--dashboard" aria-label="Key figures">
                {kpis.map((kpi) => {
                  const Icon = KPI_ICONS[kpi.key] || LayoutDashboard;
                  return (
                    <Link
                      key={kpi.key}
                      className={`admin-stat dashboard-kpi dashboard-kpi--${kpi.tone || 'brand'}`}
                      to={kpi.to || '/admin/dashboard'}
                    >
                      <span className="admin-stat__icon">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="dashboard-kpi__label">{kpi.label}</span>
                      <span className="admin-stat__value">
                        {kpi.format === 'currency' ? money(kpi.value) : formatNumber(kpi.value)}
                      </span>
                      <span className="dashboard-kpi__caption">
                        {kpi.caption}
                      </span>
                    </Link>
                  );
                })}
              </section>
            ) : null}

            {!hasSections ? (
              <EmptyState
                icon={LayoutDashboard}
                title="No dashboard sections available"
                description="Your role does not include access to sales, inventory, projects or leads. Ask an administrator for the sections you need."
              />
            ) : (
              <div className="dashboard-grid">
                <div className="dashboard-column">
                  {sections.sales ? (
                    <SectionPanel
                      title="Installments due"
                      description="Overdue balances first, then installments due in the next 30 days."
                      icon={CalendarClock}
                      action={
                        <Link className="dashboard-panel__link" to="/admin/installments">
                          All installments
                        </Link>
                      }
                    >
                      {installmentsDue.length ? (
                        <div className="admin-table__scroll">
                          <table className="admin-table dashboard-table">
                            <thead>
                              <tr>
                                <th scope="col">Sale</th>
                                <th scope="col">Due</th>
                                <th scope="col">Balance</th>
                                <th scope="col">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {installmentsDue.map((row) => (
                                <tr key={row.id}>
                                  <td>
                                    <span className="admin-table__stack">
                                      {row.sale?.id ? (
                                        <Link
                                          className="admin-table__title"
                                          to={`/admin/sales/${row.sale.id}`}
                                        >
                                          {row.sale.number}
                                        </Link>
                                      ) : (
                                        <span className="admin-table__title">Installment</span>
                                      )}
                                      <span className="admin-table__muted">
                                        {[row.sale?.customer?.name, row.sale?.unit?.unit_number]
                                          .filter(Boolean)
                                          .join(' · ') || 'Sale installment'}
                                      </span>
                                    </span>
                                  </td>
                                  <td>
                                    <span className="admin-table__stack">
                                      <span>{formatDate(row.due_date)}</span>
                                      {row.aging_days > 0 ? (
                                        <span className="dashboard-aging">
                                          {agingLabel(row.aging_days)}
                                        </span>
                                      ) : null}
                                    </span>
                                  </td>
                                  <td>{money(row.balance)}</td>
                                  <td>
                                    <span
                                      className={`admin-badge admin-badge--${installmentTone(
                                        row.status,
                                      )}`}
                                    >
                                      {labelFor(installmentStatusOptions, row.status)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="dashboard-empty">
                          No installments are due in the next 30 days.
                        </p>
                      )}
                    </SectionPanel>
                  ) : null}

                  {sections.sales ? (
                    <SectionPanel
                      title="Recent sales"
                      description="The latest sale agreements and their collection position."
                      icon={Handshake}
                      action={
                        <Link className="dashboard-panel__link" to="/admin/sales">
                          All sales
                        </Link>
                      }
                    >
                      {recentSales.length ? (
                        <div className="admin-table__scroll">
                          <table className="admin-table dashboard-table">
                            <thead>
                              <tr>
                                <th scope="col">Sale</th>
                                <th scope="col">Net price</th>
                                <th scope="col">Collected</th>
                                <th scope="col">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentSales.map((sale) => (
                                <tr key={sale.id}>
                                  <td>
                                    <span className="admin-table__stack">
                                      <Link
                                        className="admin-table__title"
                                        to={`/admin/sales/${sale.id}`}
                                      >
                                        {sale.number}
                                      </Link>
                                      <span className="admin-table__muted">
                                        {[sale.customer?.name, sale.unit?.unit_number]
                                          .filter(Boolean)
                                          .join(' · ') || 'Sale'}
                                      </span>
                                    </span>
                                  </td>
                                  <td>{money(sale.net_price)}</td>
                                  <td>{money(sale.collected_amount)}</td>
                                  <td>
                                    <span
                                      className={`admin-badge admin-badge--${saleTone(sale.status)}`}
                                    >
                                      {String(sale.status || '').replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="dashboard-empty">No sales have been recorded yet.</p>
                      )}
                    </SectionPanel>
                  ) : null}

                  {sections.projects ? (
                    <SectionPanel
                      title="Project progress"
                      description="Share of each project's units that are sold or rented."
                      icon={Building2}
                      action={
                        <Link className="dashboard-panel__link" to="/admin/projects">
                          All projects
                        </Link>
                      }
                    >
                      {projectProgress.length ? (
                        <ul className="dashboard-projects">
                          {projectProgress.map((project) => {
                            const percent = projectPercent(project);
                            return (
                              <li key={project.id} className="dashboard-projects__item">
                                <div className="dashboard-projects__head">
                                  <Link
                                    className="admin-table__title"
                                    to={`/admin/projects/${project.id}`}
                                  >
                                    {project.name}
                                  </Link>
                                  <span
                                    className={`admin-badge admin-badge--${statusTone(
                                      project.status,
                                    )}`}
                                  >
                                    {String(project.status || '').replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <div
                                  className="dashboard-progress"
                                  role="progressbar"
                                  aria-label={`${project.name} sold or rented`}
                                  aria-valuemin="0"
                                  aria-valuemax="100"
                                  aria-valuenow={percent}
                                >
                                  <span
                                    className="dashboard-progress__bar"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <div className="dashboard-projects__meta">
                                  <span>{percent}% sold or rented</span>
                                  <span>
                                    {project.sold_units} sold · {project.rented_units} rented ·{' '}
                                    {project.available_units} available
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="dashboard-empty">Add a project to track its progress.</p>
                      )}
                    </SectionPanel>
                  ) : null}
                </div>

                <div className="dashboard-column">
                  {sections.inventory && inventory ? (
                    <SectionPanel
                      title="Unit inventory"
                      description={`${formatNumber(inventory.total)} unit${
                        inventory.total === 1 ? '' : 's'
                      } across all projects.`}
                      icon={FileSignature}
                      action={
                        <Link className="dashboard-panel__link" to="/admin/units">
                          All units
                        </Link>
                      }
                    >
                      <ul className="dashboard-inventory">
                        {inventoryStatusRows.map((row) => (
                          <li key={row.status}>
                            <Link
                              className="dashboard-inventory__row"
                              to={`/admin/units?status=${row.status}`}
                            >
                              <span className="dashboard-inventory__label">{row.label}</span>
                              <span className="dashboard-inventory__count">
                                {formatNumber(row.count)}
                              </span>
                              <span className="dashboard-inventory__bar" aria-hidden="true">
                                <span style={{ width: `${row.percent}%` }} />
                              </span>
                              <span className="dashboard-inventory__percent">{row.percent}%</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </SectionPanel>
                  ) : null}

                  {sections.pipeline ? (
                    <SectionPanel
                      title="Lead pipeline"
                      description="Every lead by current stage, linked to the filtered list."
                      icon={UserPlus}
                      action={
                        <Link className="dashboard-panel__link" to="/admin/leads">
                          All leads
                        </Link>
                      }
                    >
                      <ul className="dashboard-pipeline">
                        {leadPipeline.map((row) => (
                          <li key={row.stage}>
                            <Link className="dashboard-pipeline__row" to={row.to}>
                              <span className="dashboard-pipeline__label">{row.label}</span>
                              <span className="dashboard-pipeline__count">
                                {formatNumber(row.count)}
                              </span>
                              <span className="dashboard-pipeline__bar" aria-hidden="true">
                                <span
                                  style={{ width: `${pipelineBarPercent(row, leadPipeline)}%` }}
                                />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </SectionPanel>
                  ) : null}
                </div>
              </div>
            )}
          </>
        ) : null}
      </Container>
    </>
  );
}
