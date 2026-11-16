import { ApiError, apiRequest } from './apiClient';

export async function login(credentials) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });
  return response?.data ?? null;
}

export async function logout() {
  const response = await apiRequest('/auth/logout', { method: 'POST' });
  return response?.data ?? null;
}

export async function getCurrentSession() {
  try {
    const response = await apiRequest('/auth/me');
    return response?.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  const response = await apiRequest('/auth/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
  return response?.data ?? null;
}

const authApiService = { login, logout, me: getCurrentSession, changePassword };

export default authApiService;
