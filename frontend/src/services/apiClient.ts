const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const SYNC_TOKEN = import.meta.env.VITE_SYNC_TOKEN || '';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (SYNC_TOKEN) {
    headers['Authorization'] = `Bearer ${SYNC_TOKEN}`;
  }
  return headers;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || `HTTP ${response.status}`,
      errorData.details
    );
  }
  return response.json() as Promise<T>;
}

export async function get<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  return handleResponse<T>(response);
}

export async function post<T>(path: string, body: unknown, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
  return handleResponse<T>(response);
}

export async function put<T>(path: string, body: unknown, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
  return handleResponse<T>(response);
}

export async function del<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  return handleResponse<T>(response);
}

export interface HealthzResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

export async function checkHealth(): Promise<HealthzResponse> {
  return get<HealthzResponse>('/healthz');
}

export async function checkBackendConnection(): Promise<{ connected: boolean; latencyMs: number; version?: string }> {
  const start = performance.now();
  try {
    const data = await checkHealth();
    const latencyMs = Math.round(performance.now() - start);
    return { connected: true, latencyMs, version: data.version };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return { connected: false, latencyMs };
  }
}
