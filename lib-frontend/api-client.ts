const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 15000;

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string | Record<string, unknown> | null;
}

export class ApiClientError extends Error {
  status: number;
  rawError?: string | Record<string, unknown> | null;
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    rawError?: string | Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.rawError = rawError;
    this.fieldErrors =
      rawError && typeof rawError === "object"
        ? extractFieldErrors(rawError)
        : undefined;
  }
}

interface FetchOptions extends RequestInit {
  data?: Record<string, unknown>;
}

function extractFieldErrors(
  errorObj: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(errorObj)) {
    const value = errorObj[key];
    if (typeof value === "string") {
      out[key] = value;
      continue;
    }
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "string"
    ) {
      out[key] = value[0];
    }
  }
  return out;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Kutilmagan xatolik yuz berdi";
}

function clearAuthAndRedirect() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("sangplus_token");
  sessionStorage.removeItem("sangplus_role");
  sessionStorage.removeItem("sangplus_username");
  window.location.href = "/";
}

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("sangplus_token");
  }
  return null;
}

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  return `${API_BASE_URL}${endpoint}`;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const url = buildUrl(endpoint);
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(typeof options.headers === "object" && options.headers
      ? (options.headers as Record<string, string>)
      : {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    fetchOptions.body = JSON.stringify(options.data);
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS,
  );

  if (options.signal) {
    if (options.signal.aborted) {
      timeoutController.abort();
    } else {
      options.signal.addEventListener(
        "abort",
        () => timeoutController.abort(),
        {
          once: true,
        },
      );
    }
  }

  fetchOptions.signal = timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError(
        "Server javob bermadi (timeout). Backend ishga tushganini tekshiring.",
        408,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({
    success: false,
    message: "Invalid JSON response",
    data: null,
  }));

  const envelope = payload as Partial<ApiEnvelope<T>>;
  const success = Boolean(envelope.success) && response.ok;

  if (!success) {
    const status = response.status;
    const errorObjectMessage =
      envelope.error &&
      typeof envelope.error === "object" &&
      "message" in envelope.error &&
      typeof envelope.error.message === "string"
        ? envelope.error.message
        : null;
    const messageFromError =
      typeof envelope.error === "string"
        ? envelope.error
        : errorObjectMessage || envelope.message || `API xato: ${status}`;

    const finalMessage =
      status === 403
        ? "Sizda bu amal uchun ruxsat yo'q"
        : status === 401
          ? "Sessiya tugagan. Qayta login qiling"
          : messageFromError;

    if (status === 401) {
      clearAuthAndRedirect();
    }

    throw new ApiClientError(finalMessage, status, envelope.error ?? null);
  }

  return (envelope.data ?? null) as T;
}

export function apiGet<T = unknown>(endpoint: string, options?: FetchOptions) {
  return apiClient<T>(endpoint, {
    ...options,
    method: "GET",
  });
}

export function apiPost<T = unknown>(
  endpoint: string,
  data: Record<string, unknown>,
  options?: FetchOptions,
) {
  return apiClient<T>(endpoint, {
    ...options,
    method: "POST",
    data,
  });
}

export function apiPatch<T = unknown>(
  endpoint: string,
  data: Record<string, unknown>,
  options?: FetchOptions,
) {
  return apiClient<T>(endpoint, {
    ...options,
    method: "PATCH",
    data,
  });
}

export function apiDelete<T = unknown>(
  endpoint: string,
  options?: FetchOptions,
) {
  return apiClient<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
}

export function extractList<T>(
  payload: unknown,
  preferredKeys: string[] = [],
): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const obj = payload as Record<string, unknown>;
  const keysToTry = [
    ...preferredKeys,
    "data",
    "items",
    "rows",
    "results",
    "list",
    "groups",
    "students",
    "payments",
    "entries",
    "attendance",
  ];

  for (const key of keysToTry) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (Array.isArray(nested.items)) {
        return nested.items as T[];
      }
      if (Array.isArray(nested.rows)) {
        return nested.rows as T[];
      }
      if (Array.isArray(nested.data)) {
        return nested.data as T[];
      }
    }
  }

  return [];
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    fullName?: string;
  };
}

export const authAPI = {
  login: (username: string, password: string, role: string) =>
    apiPost<LoginResponse>("/api/auth/login", {
      username: username.trim(),
      password,
      role,
    }),

  getCurrentUser: () => apiGet("/api/auth/me"),
};

export const studentsAPI = {
  list: () => apiGet("/api/students"),
  get: (id: string) => apiGet(`/api/students/${id}`),
  create: (data: Record<string, unknown>) => apiPost("/api/students", data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch(`/api/students/${id}`, data),
  delete: (id: string) => apiDelete(`/api/students/${id}`),
};

export const teachersAPI = {
  list: () => apiGet("/api/teachers"),
  get: (id: string) => apiGet(`/api/teachers/${id}`),
  create: (data: Record<string, unknown>) => apiPost("/api/teachers", data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch(`/api/teachers/${id}`, data),
  delete: (id: string) => apiDelete(`/api/teachers/${id}`),
};

export const groupsAPI = {
  list: () => apiGet("/api/groups"),
  get: (id: string) => apiGet(`/api/groups/${id}`),
  create: (data: Record<string, unknown>) => apiPost("/api/groups", data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch(`/api/groups/${id}`, data),
  delete: (id: string) => apiDelete(`/api/groups/${id}`),
};

export const lessonsAPI = {
  list: (params?: { lessonDate?: string; groupId?: string }) => {
    const search = new URLSearchParams();
    if (params?.lessonDate) search.set("lessonDate", params.lessonDate);
    if (params?.groupId) search.set("groupId", params.groupId);
    const query = search.toString();
    return apiGet(`/api/lessons${query ? `?${query}` : ""}`);
  },

  create: (data: Record<string, unknown>) => apiPost("/api/lessons", data),
};

export const paymentsAPI = {
  list: (params?: {
    groupId?: string;
    billingMonth?: string;
    status?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.groupId) search.set("groupId", params.groupId);
    if (params?.billingMonth) search.set("billingMonth", params.billingMonth);
    if (params?.status) search.set("status", params.status);
    const query = search.toString();
    return apiGet(`/api/payments${query ? `?${query}` : ""}`);
  },

  summary: (params: { groupId: string; billingMonth: string }) => {
    const search = new URLSearchParams();
    search.set("groupId", params.groupId);
    search.set("billingMonth", params.billingMonth);
    return apiGet(`/api/payments/summary?${search.toString()}`);
  },

  get: (id: string) => apiGet(`/api/payments/${id}`),
  create: (data: Record<string, unknown>) => apiPost("/api/payments", data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch(`/api/payments/${id}`, data),
  delete: (id: string) => apiDelete(`/api/payments/${id}`),
};

export const attendanceAPI = {
  list: (params?: {
    lessonDate?: string;
    groupId?: string;
    lessonId?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.lessonDate) search.set("lessonDate", params.lessonDate);
    if (params?.groupId) search.set("groupId", params.groupId);
    if (params?.lessonId) search.set("lessonId", params.lessonId);
    const query = search.toString();
    return apiGet(`/api/attendance${query ? `?${query}` : ""}`);
  },

  create: (data: Record<string, unknown>) => apiPost("/api/attendance", data),
};
