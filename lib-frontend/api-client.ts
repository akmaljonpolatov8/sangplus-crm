/**
 * API Client Utility for SangPlus CRM
 * Handles all HTTP requests with token management and error handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  data?: Record<string, any>;
}

/**
 * Get the auth token from sessionStorage
 */
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('sangplus_token');
  }
  return null;
}

/**
 * Make an API request with automatic token handling
 */
export async function apiClient(
  endpoint: string,
  options: FetchOptions = {}
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    fetchOptions.body = JSON.stringify(options.data);
  }

  try {
    const response = await fetch(url, fetchOptions);

    // Handle 401 - Token expired or invalid
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('sangplus_token');
        sessionStorage.removeItem('sangplus_role');
        sessionStorage.removeItem('sangplus_username');
        window.location.href = '/';
      }
      throw new Error('Unauthorized - Please login again');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * GET request
 */
export function apiGet(endpoint: string, options?: FetchOptions) {
  return apiClient(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request
 */
export function apiPost(
  endpoint: string,
  data: Record<string, any>,
  options?: FetchOptions
) {
  return apiClient(endpoint, {
    ...options,
    method: 'POST',
    data,
  });
}

/**
 * PUT request
 */
export function apiPut(
  endpoint: string,
  data: Record<string, any>,
  options?: FetchOptions
) {
  return apiClient(endpoint, {
    ...options,
    method: 'PUT',
    data,
  });
}

/**
 * DELETE request
 */
export function apiDelete(endpoint: string, options?: FetchOptions) {
  return apiClient(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Auth API methods
 */
export const authAPI = {
  login: (username: string, password: string, role: string) =>
    apiPost('/api/auth/login', { username, password, role }),

  logout: () => apiPost('/api/auth/logout', {}),

  getCurrentUser: () => apiGet('/api/auth/me'),

  refreshToken: () => apiPost('/api/auth/refresh-token', {}),
};

/**
 * Dashboard API methods
 */
export const dashboardAPI = {
  getStats: () => apiGet('/api/dashboard/stats'),

  getActivity: () => apiGet('/api/dashboard/activity'),
};

/**
 * Students API methods
 */
export const studentsAPI = {
  list: () => apiGet('/api/students'),

  get: (id: string) => apiGet(`/api/students/${id}`),

  create: (data: Record<string, any>) => apiPost('/api/students', data),

  update: (id: string, data: Record<string, any>) =>
    apiPut(`/api/students/${id}`, data),

  delete: (id: string) => apiDelete(`/api/students/${id}`),
};

/**
 * Teachers API methods
 */
export const teachersAPI = {
  list: () => apiGet('/api/teachers'),

  get: (id: string) => apiGet(`/api/teachers/${id}`),

  create: (data: Record<string, any>) => apiPost('/api/teachers', data),

  update: (id: string, data: Record<string, any>) =>
    apiPut(`/api/teachers/${id}`, data),

  delete: (id: string) => apiDelete(`/api/teachers/${id}`),
};

/**
 * Groups API methods
 */
export const groupsAPI = {
  list: () => apiGet('/api/groups'),

  get: (id: string) => apiGet(`/api/groups/${id}`),

  create: (data: Record<string, any>) => apiPost('/api/groups', data),

  update: (id: string, data: Record<string, any>) =>
    apiPut(`/api/groups/${id}`, data),

  delete: (id: string) => apiDelete(`/api/groups/${id}`),
};

/**
 * Payments API methods
 */
export const paymentsAPI = {
  list: () => apiGet('/api/payments'),

  get: (id: string) => apiGet(`/api/payments/${id}`),

  create: (data: Record<string, any>) => apiPost('/api/payments', data),

  update: (id: string, data: Record<string, any>) =>
    apiPut(`/api/payments/${id}`, data),

  delete: (id: string) => apiDelete(`/api/payments/${id}`),
};

/**
 * Attendance API methods
 */
export const attendanceAPI = {
  list: () => apiGet('/api/attendance'),

  get: (id: string) => apiGet(`/api/attendance/${id}`),

  create: (data: Record<string, any>) => apiPost('/api/attendance', data),

  update: (id: string, data: Record<string, any>) =>
    apiPut(`/api/attendance/${id}`, data),

  delete: (id: string) => apiDelete(`/api/attendance/${id}`),
};
