/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferences = vi.hoisted(() => ({
  value: null as string | null,
  get: vi.fn(async () => ({ value: preferences.value })),
  set: vi.fn(async ({ value }: { value: string }) => {
    preferences.value = value;
  }),
  remove: vi.fn(async () => {
    preferences.value = null;
  }),
}));
const repository = vi.hoisted(() => ({
  clearRemoteSyncState: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: preferences.get,
    set: preferences.set,
    remove: preferences.remove,
  },
}));

vi.mock('../src/db/repository', () => ({
  isNativePlatform: () => true,
  getRepository: () => repository,
}));

import { useAuthStore } from '../src/stores/authStore';
import {
  getApiBaseUrl,
  initializeServerConfig,
  normalizeServerOrigin,
  resetServerConfigForTests,
  saveServerOrigin,
} from '../src/services/serverConfig';

describe('Android server configuration', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { isNativePlatform: () => true },
    });
    preferences.value = null;
    vi.clearAllMocks();
    resetServerConfigForTests();
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  it('normalizes a secure origin and rejects unsafe URL components', () => {
    expect(normalizeServerOrigin(' https://vibefit.home.example/ ')).toBe(
      'https://vibefit.home.example',
    );
    expect(() => normalizeServerOrigin('http://192.168.1.20')).toThrow('HTTPS');
    expect(() => normalizeServerOrigin('https://user:pass@example.com')).toThrow('用户名');
    expect(() => normalizeServerOrigin('https://example.com/api')).toThrow('路径');
    expect(() => normalizeServerOrigin('https://example.com?token=x')).toThrow('查询参数');
  });

  it('loads the persisted origin before API requests', async () => {
    preferences.value = 'https://vibefit.home.example/';

    await initializeServerConfig();

    expect(getApiBaseUrl()).toBe('https://vibefit.home.example');
  });

  it('clears orphaned remote credentials when no server is configured', async () => {
    useAuthStore.getState().setAuth('orphaned-token', {
      id: 'user-1',
      email: 'user@example.com',
    });

    await initializeServerConfig();

    expect(useAuthStore.getState().token).toBeNull();
    expect(repository.clearRemoteSyncState).toHaveBeenCalledOnce();
  });

  it('logs out when switching to a different server without touching local data stores', async () => {
    await initializeServerConfig();
    await saveServerOrigin('https://first.home.example');
    repository.clearRemoteSyncState.mockClear();
    useAuthStore.getState().setAuth('old-server-token', {
      id: 'user-1',
      email: 'user@example.com',
    });

    const result = await saveServerOrigin('https://second.home.example');

    expect(result.changed).toBe(true);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(repository.clearRemoteSyncState).toHaveBeenCalledOnce();
  });
});
