import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, CheckCheck, LoaderCircle } from 'lucide-react';
import notificationsApiService from '../../services/notificationsApiService';
import { notificationRelativeTime, unreadBadge } from '../../services/dashboardSelectors';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('loading');
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const result = await notificationsApiService.listNotifications({ limit: 10 });
        if (ignore) return;
        setNotifications(result.data);
        setUnread(Number(result.meta?.unread_count || 0));
        setStatus('ready');
        setError('');
      } catch (loadError) {
        if (ignore) return;
        setError(loadError.message || 'Notifications could not be loaded.');
        setStatus('error');
      }
    }

    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  async function refresh() {
    try {
      const result = await notificationsApiService.listNotifications({ limit: 10 });
      setNotifications(result.data);
      setUnread(Number(result.meta?.unread_count || 0));
      setStatus('ready');
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Notifications could not be loaded.');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) refresh();
  }

  async function handleRead(notification) {
    if (notification.is_read) return;
    setNotifications((rows) =>
      rows.map((row) => (row.id === notification.id ? { ...row, is_read: true } : row)),
    );
    setUnread((count) => Math.max(0, count - 1));
    try {
      const result = await notificationsApiService.markNotificationRead(notification.id);
      if (result && Number.isFinite(Number(result.unread_count))) {
        setUnread(Number(result.unread_count));
      }
    } catch {
      refresh();
    }
  }

  async function handleReadAll() {
    if (markingAll || unread === 0) return;
    setMarkingAll(true);
    try {
      await notificationsApiService.markAllNotificationsRead();
      setNotifications((rows) => rows.map((row) => ({ ...row, is_read: true })));
      setUnread(0);
    } catch (readError) {
      setError(readError.message || 'Notifications could not be updated.');
    } finally {
      setMarkingAll(false);
    }
  }

  const badge = unreadBadge(unread);

  return (
    <div className="admin-bell" ref={rootRef}>
      <button
        type="button"
        className="admin-bell__trigger"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden="true" />
        {badge ? (
          <span className="admin-bell__count" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="admin-bell__panel" role="dialog" aria-label="Notifications">
          <div className="admin-bell__header">
            <div>
              <p className="admin-bell__title">Notifications</p>
              <p className="admin-bell__subtitle">
                {unread ? `${unread} unread` : 'You are all caught up'}
              </p>
            </div>
            <button
              type="button"
              className="admin-bell__action"
              onClick={handleReadAll}
              disabled={markingAll || unread === 0}
            >
              {markingAll ? (
                <LoaderCircle size={13} className="spin" aria-hidden="true" />
              ) : (
                <CheckCheck size={13} aria-hidden="true" />
              )}
              Mark all read
            </button>
          </div>

          {status === 'loading' ? (
            <div className="admin-bell__state" role="status">
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
              Loading notifications…
            </div>
          ) : null}

          {error ? (
            <div className="admin-bell__state admin-bell__state--error" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {error}
            </div>
          ) : null}

          {status === 'ready' && !error && notifications.length === 0 ? (
            <p className="admin-bell__empty">New assignments, stage changes and payments appear here.</p>
          ) : null}

          {notifications.length ? (
            <ul className="admin-bell__list">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <span className="admin-bell__item-head">
                      <span className="admin-bell__item-title">{notification.title}</span>
                      {!notification.is_read ? (
                        <span className="admin-bell__dot" aria-label="Unread" />
                      ) : null}
                    </span>
                    {notification.body ? (
                      <span className="admin-bell__item-body">{notification.body}</span>
                    ) : null}
                    <span className="admin-bell__item-time">
                      {notificationRelativeTime(notification.created_at)}
                    </span>
                  </>
                );

                return (
                  <li
                    key={notification.id}
                    className={`admin-bell__item${notification.is_read ? '' : ' is-unread'}`}
                  >
                    {notification.url ? (
                      <Link
                        className="admin-bell__link"
                        to={notification.url}
                        onClick={() => {
                          handleRead(notification);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="admin-bell__link"
                        onClick={() => handleRead(notification)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
