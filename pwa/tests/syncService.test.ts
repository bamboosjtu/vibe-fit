import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  exportAllData: vi.fn(),
  importAllData: vi.fn(),
  isAuthenticated: vi.fn(),
}));

vi.mock('../src/services/apiClient', () => ({
  get: mocks.get,
  post: mocks.post,
}));

vi.mock('../src/db', () => ({
  exportAllData: mocks.exportAllData,
  importAllData: mocks.importAllData,
}));

vi.mock('../src/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ isAuthenticated: mocks.isAuthenticated }),
  },
}));

vi.mock('../src/utils/helpers', () => ({
  getCurrentISOString: () => '2026-08-08T08:00:00.000Z',
}));

import { MAX_BACKUP_BYTES, syncPull, syncPush } from '../src/services/syncService';

const validBackup = {
  schemaVersion: 1,
  exportedAt: '2026-08-08T08:00:00.000Z',
  appVersion: '1.0.4',
  settings: {
    weightUnit: 'kg',
    distanceUnit: 'km',
    darkMode: false,
    schemaVersion: 1,
  },
  plans: [],
  sessions: [],
  exercises: [],
};

describe('syncPull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.importAllData.mockResolvedValue(undefined);
    mocks.post.mockResolvedValue({ success: true, syncedAt: '2026-08-08T08:01:00.000Z' });
  });

  it('校验通过后才覆盖本地数据', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: validBackup,
      syncedAt: '2026-08-08T08:01:00.000Z',
    });

    await syncPull();

    expect(mocks.importAllData).toHaveBeenCalledWith({
      settings: validBackup.settings,
      plans: [],
      sessions: [],
      exercises: [],
    });
  });

  it('损坏备份不会清空或覆盖本地数据', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: { schemaVersion: 1, plans: 'invalid' },
      syncedAt: '2026-08-08T08:01:00.000Z',
    });

    await expect(syncPull()).rejects.toThrow('云端备份格式无效');
    expect(mocks.importAllData).not.toHaveBeenCalled();
  });

  it('未登录时不请求云端备份', async () => {
    mocks.isAuthenticated.mockReturnValue(false);

    await expect(syncPull()).rejects.toThrow('未登录');
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('上传前拒绝超过 10MiB 的完整快照', async () => {
    mocks.exportAllData.mockResolvedValue({
      settings: validBackup.settings,
      plans: [],
      sessions: [],
      exercises: [{
        id: 'large',
        name: 'large',
        type: 'cardio',
        description: 'x'.repeat(MAX_BACKUP_BYTES),
      }],
    });

    await expect(syncPush()).rejects.toThrow('超过 10MiB');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
