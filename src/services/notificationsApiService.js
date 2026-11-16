import { apiRequest } from './apiClient';

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listNotifications(params) {
  const response = await apiRequest(`/notifications${queryString(params)}`);
  return {
    data: response?.data ?? [],
    meta: response?.meta ?? { unread_count: 0 },
  };
}

export async function markNotificationRead(id) {
  const response = await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
  return response?.data ?? null;
}

export async function markAllNotificationsRead() {
  const response = await apiRequest('/notifications/read-all', { method: 'POST' });
  return response?.data ?? null;
}

const notificationsApiService = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};

export default notificationsApiService;
