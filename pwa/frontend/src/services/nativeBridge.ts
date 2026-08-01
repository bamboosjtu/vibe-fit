/**
 * 原生能力桥接（Capacitor 插件封装）。
 *
 * 在 Web 上全部降级为 no-op / fallback；在 Android（Capacitor）上调用对应原生插件。
 * 详见 android/docs/android-architecture.md 第 8 节。
 *
 * 实现：接口 + Web fallback 在本文件；原生实现见 capacitorBridge.ts，
 * 由 getNativeBridge() 在原生平台动态 import，保证 @capacitor/* 插件不进 Web 主 bundle。
 */
import { isNativePlatform } from '../db/repository';

export interface NativeBridge {
  /** 休息计时器到点通知（后台/锁屏可响） */
  scheduleRestTimerNotification(seconds: number): Promise<void>;
  /** 完成组 / 结束训练触感反馈 */
  hapticLight(): Promise<void>;
  hapticMedium(): Promise<void>;
  /** 导出备份文件到文件系统并调起分享 */
  exportBackupFile(filename: string, json: string): Promise<void>;
  /** 读取本地备份文件并返回内容 */
  importBackupFile(): Promise<string | null>;
}

/** Web fallback：全部 no-op，返回安全默认值。 */
const webBridge: NativeBridge = {
  async scheduleRestTimerNotification() {
    /* Web：休息计时器由前端 setInterval 处理，无原生通知 */
  },
  async hapticLight() { /* no-op */ },
  async hapticMedium() { /* no-op */ },
  async exportBackupFile() {
    throw new Error('文件导出仅在 Android 端可用');
  },
  async importBackupFile() {
    return null;
  },
};

/**
 * 获取原生桥接实例。
 * - Web：返回 webBridge（no-op fallback）
 * - Android：动态 import 原生实现（封装 @capacitor/* 插件），保证插件代码不进 Web 主 bundle
 */
export async function getNativeBridge(): Promise<NativeBridge> {
  if (!isNativePlatform()) {
    return webBridge;
  }

  const { CapacitorBridge } = await import('./capacitorBridge');
  return new CapacitorBridge();
}
