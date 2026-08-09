import { getRepository, isNativePlatform } from '../db/repository';
import { useAuthStore } from '../stores/authStore';

const SERVER_ORIGIN_KEY = 'vibefit-server-origin';
const CONNECTION_TIMEOUT_MS = 8_000;

let initialized = false;
let nativeServerOrigin: string | null = null;

export class ServerNotConfiguredError extends Error {
  constructor() {
    super('请先配置家庭服务器地址');
    this.name = 'ServerNotConfiguredError';
  }
}

function getWebApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function normalizeServerOrigin(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error('服务器地址不能为空');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('服务器地址格式不正确');
  }

  if (url.protocol !== 'https:') {
    throw new Error('服务器地址必须使用 HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('服务器地址不能包含用户名或密码');
  }
  if (url.search || url.hash) {
    throw new Error('服务器地址不能包含查询参数或片段');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('服务器地址只能包含域名或 IP，不能包含路径');
  }

  return url.origin;
}

export async function initializeServerConfig(): Promise<void> {
  if (initialized) return;

  if (!isNativePlatform()) {
    initialized = true;
    return;
  }

  const { Preferences } = await import('@capacitor/preferences');
  const stored = await Preferences.get({ key: SERVER_ORIGIN_KEY });

  if (stored.value) {
    try {
      nativeServerOrigin = normalizeServerOrigin(stored.value);
    } catch {
      await Preferences.remove({ key: SERVER_ORIGIN_KEY });
      nativeServerOrigin = null;
    }
  }

  if (!nativeServerOrigin) {
    useAuthStore.getState().logout();
    await getRepository().clearRemoteSyncState();
  }

  initialized = true;
}

export function getConfiguredServerOrigin(): string | null {
  return isNativePlatform() ? nativeServerOrigin : getWebApiBaseUrl() || null;
}

export function getApiBaseUrl(): string {
  if (!isNativePlatform()) return getWebApiBaseUrl();
  if (!initialized || !nativeServerOrigin) throw new ServerNotConfiguredError();
  return nativeServerOrigin;
}

export async function saveServerOrigin(input: string): Promise<{
  origin: string;
  changed: boolean;
}> {
  if (!isNativePlatform()) {
    throw new Error('Web/PWA 使用同源服务器，不能在应用内修改');
  }

  const origin = normalizeServerOrigin(input);
  const previous = nativeServerOrigin;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: SERVER_ORIGIN_KEY, value: origin });
  nativeServerOrigin = origin;
  initialized = true;

  const changed = previous !== null && previous !== origin;
  if (changed) {
    useAuthStore.getState().logout();
    await getRepository().clearRemoteSyncState();
  }

  return { origin, changed };
}

export async function testServerConnection(input: string): Promise<{
  origin: string;
  latencyMs: number;
  version?: string;
}> {
  const origin = normalizeServerOrigin(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const healthResponse = await fetch(`${origin}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!healthResponse.ok) {
      throw new Error(`健康检查失败（HTTP ${healthResponse.status}）`);
    }

    const health = await healthResponse.json().catch(() => null) as { status?: string } | null;
    if (health?.status !== 'ok') {
      throw new Error('服务器健康检查响应无效');
    }

    const versionResponse = await fetch(`${origin}/api/version`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!versionResponse.ok) {
      throw new Error(`版本检查失败（HTTP ${versionResponse.status}）`);
    }
    const version = await versionResponse.json().catch(() => null) as {
      releaseVersion?: string;
      version?: string;
    } | null;

    return {
      origin,
      latencyMs: Date.now() - startedAt,
      version: version?.releaseVersion ?? version?.version,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('连接服务器超时');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function resetServerConfigForTests(): void {
  initialized = false;
  nativeServerOrigin = null;
}
