import { useAuthStore } from "../stores/authStore";
import { getApiBaseUrl } from './serverConfig';

// Web/PWA 使用同源相对路径；Android 在启动时从 Capacitor Preferences
// 加载家庭服务器 origin。每次请求动态读取，确保修改服务器后立即生效。
function buildUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

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
  const response = await fetch(buildUrl(path), {
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
  const response = await fetch(buildUrl(path), {
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
  const response = await fetch(buildUrl(path), {
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
  const response = await fetch(buildUrl(path), {
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
  releaseVersion: string;
  gitRevision: string;
  databaseSchemaVersion: string;
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
