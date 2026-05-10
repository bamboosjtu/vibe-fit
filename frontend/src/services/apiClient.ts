import { useAuthStore } from "../stores/authStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = useAuthStore.getState().token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.code || "UNKNOWN_ERROR",
      errorData.message || `HTTP ${response.status}`,
      errorData.details,
    );
  }
  return response.json() as Promise<T>;
}

export async function get<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  return handleResponse<T>(response);
}

export async function post<T>(
  path: string,
  body: unknown,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
  return handleResponse<T>(response);
}

export async function put<T>(
  path: string,
  body: unknown,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
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
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  return handleResponse<T>(response);
}

export interface HealthResponse {
  status: "ok";
}

export interface VersionResponse {
  name: string;
  version: string;
  environment: string;
  authMode?: string;
  dataMode?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  return get<HealthResponse>("/health");
}

export async function checkBackendConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  version?: string;
}> {
  const start = performance.now();

  try {
    await checkHealth();

    const versionData = await get<VersionResponse>("/api/version").catch(
      () => null,
    );

    const latencyMs = Math.round(performance.now() - start);

    return {
      connected: true,
      latencyMs,
      version: versionData?.version,
    };
  } catch {
    const latencyMs = Math.round(performance.now() - start);

    return {
      connected: false,
      latencyMs,
    };
  }
}
