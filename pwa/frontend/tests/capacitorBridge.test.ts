import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nativeMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  impact: vi.fn(),
  writeFile: vi.fn(),
  share: vi.fn(),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: nativeMocks.checkPermissions,
    requestPermissions: nativeMocks.requestPermissions,
    cancel: nativeMocks.cancel,
    schedule: nativeMocks.schedule,
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: nativeMocks.impact },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: nativeMocks.writeFile },
  Directory: { External: 'EXTERNAL' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: nativeMocks.share },
}));

import { CapacitorBridge } from '../src/services/capacitorBridge';

describe('CapacitorBridge 休息通知', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T08:00:00.000Z'));
    nativeMocks.cancel.mockResolvedValue(undefined);
    nativeMocks.schedule.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('已授权时直接调度通知', async () => {
    nativeMocks.checkPermissions.mockResolvedValue({ display: 'granted' });

    await new CapacitorBridge().scheduleRestTimerNotification(75);

    expect(nativeMocks.requestPermissions).not.toHaveBeenCalled();
    expect(nativeMocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] });
    expect(nativeMocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 1001,
          schedule: { at: new Date('2026-08-08T08:01:15.000Z') },
        }),
      ],
    });
  });

  it('首次调度时申请通知权限', async () => {
    nativeMocks.checkPermissions.mockResolvedValue({ display: 'prompt' });
    nativeMocks.requestPermissions.mockResolvedValue({ display: 'granted' });

    await new CapacitorBridge().scheduleRestTimerNotification(30);

    expect(nativeMocks.requestPermissions).toHaveBeenCalledTimes(1);
    expect(nativeMocks.schedule).toHaveBeenCalledTimes(1);
  });

  it('用户拒绝权限时安全降级，不调度通知', async () => {
    nativeMocks.checkPermissions.mockResolvedValue({ display: 'denied' });
    nativeMocks.requestPermissions.mockResolvedValue({ display: 'denied' });

    await new CapacitorBridge().scheduleRestTimerNotification(30);

    expect(nativeMocks.cancel).not.toHaveBeenCalled();
    expect(nativeMocks.schedule).not.toHaveBeenCalled();
  });
});
