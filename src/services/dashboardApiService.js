import { apiRequest } from './apiClient';

export async function getDashboard() {
  const response = await apiRequest('/dashboard');
  return response?.data ?? null;
}

const dashboardApiService = { getDashboard };

export default dashboardApiService;
