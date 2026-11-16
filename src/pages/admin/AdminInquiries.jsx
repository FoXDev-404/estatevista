import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Inbox, LoaderCircle, Search, X } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/properties/Pagination';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import inquiryApiService from '../../services/inquiryApiService';
import {
  inquiryInterestLabel,
  inquiryStatusOptions,
  inquiryStatusTone,
  inquiryTypeLabel,
  inquiryTypeOptions,
} from '../../services/inquirySelectors';
import { formatDateTime } from '../../services/adminFormatters';

function messagePreview(message) {
  const text = String(message || '').trim();
  if (text.length <= 140) return text || '—';
  return `${text.slice(0, 137)}…`;
}

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    let ignore = false;

    inquiryApiService
      .listWebsiteInquiries({
        search: debouncedSearch,
        type: typeFilter,
        status: statusFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setInquiries(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Website inquiries could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, typeFilter, statusFilter, page]);

  function resetPage() {
    setPage(1);
  }

  const hasFilters = Boolean(search || typeFilter || statusFilter);

  return (
    <>
      <PageMeta
        title="Website inquiries"
        description="Read the contact, project, property and visit requests submitted from the public website."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Website inquiries</h1>
            <p className="admin-page__description">
              Every message submitted from the public website, the property or project it refers
              to and the lead created for follow-up.
            </p>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar">
            <label className="admin-toolbar__search">
              <Search size={16} className="admin-toolbar__search-icon" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search name, phone, email or message"
                aria-label="Search website inquiries"
              />
              {search ? (
                <button
                  type="button"
                  className="admin-toolbar__clear"
                  onClick={() => {
                    setSearch('');
                    resetPage();
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="admin-toolbar__filters">
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by type"
              >
                {inquiryTypeOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by status"
              >
                {inquiryStatusOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} inquir{meta.total === 1 ? 'y' : 'ies'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading website inquiries…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Website inquiries could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !inquiries.length ? (
            <EmptyState
              icon={Inbox}
              title="No website inquiries found"
              description={
                hasFilters
                  ? 'Try a different search, type or status filter.'
                  : 'Inquiries submitted from the public website will appear here with their lead.'
              }
            />
          ) : null}

          {status === 'ready' && inquiries.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table inquiry-table">
                  <thead>
                    <tr>
                      <th scope="col">Received</th>
                      <th scope="col">Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Interested in</th>
                      <th scope="col">Message</th>
                      <th scope="col">Lead</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.map((inquiry) => (
                      <tr key={inquiry.id}>
                        <td>
                          <div className="admin-table__stack">
                            <span>{formatDateTime(inquiry.created_at)}</span>
                            {inquiry.source_page ? (
                              <span className="admin-table__muted">{inquiry.source_page}</span>
                            ) : null}
                          </div>
                        </td>
                        <th scope="row">
                          <div className="admin-table__stack">
                            <span className="admin-table__title">{inquiry.name}</span>
                            {inquiry.phone ? (
                              <span className="admin-table__muted">{inquiry.phone}</span>
                            ) : null}
                            {inquiry.email ? (
                              <span className="admin-table__muted">{inquiry.email}</span>
                            ) : null}
                          </div>
                        </th>
                        <td>
                          <div className="inquiry-table__badges">
                            <span className="admin-badge admin-badge--muted">
                              {inquiryTypeLabel(inquiry.type)}
                            </span>
                            <span
                              className={`admin-badge admin-badge--${inquiryStatusTone(
                                inquiry.status,
                              )}`}
                            >
                              {inquiryStatusOptions.find(
                                (option) => option.value === inquiry.status,
                              )?.label || inquiry.status}
                            </span>
                          </div>
                        </td>
                        <td>{inquiryInterestLabel(inquiry)}</td>
                        <td>
                          <p className="inquiry-table__message" title={inquiry.message || ''}>
                            {messagePreview(inquiry.message)}
                          </p>
                        </td>
                        <td>
                          {inquiry.lead ? (
                            <div className="admin-table__stack">
                              <span>{inquiry.lead.name}</span>
                              <span className="admin-table__muted">
                                {inquiry.lead.status}
                              </span>
                            </div>
                          ) : (
                            <span className="admin-table__muted">No lead</span>
                          )}
                        </td>
                        <td>
                          {inquiry.lead ? (
                            <Link
                              className="table-action"
                              to={`/admin/leads/${inquiry.lead.id}`}
                            >
                              <ArrowUpRight size={15} aria-hidden="true" />
                              <span>Open lead</span>
                            </Link>
                          ) : (
                            <span className="admin-table__muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Website inquiry pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>
    </>
  );
}
