import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { NativeBridge } from './nativeBridge';

/**
 * 原生能力桥接（Android，Capacitor 插件封装）。
 *
 * 实现 NativeBridge 接口，在原生平台上调用 @capacitor/* 插件：
 * - 本地通知：休息计时器到点提醒（后台/锁屏可响）
 * - 触感反馈：完成组 / 结束训练轻震动
 * - 文件系统 + 分享：导出 JSON 备份文件并调起系统分享
 *
 * 注意：本文件整体只在 native 平台通过 `await import('./capacitorBridge')` 动态导入，
 * 不会进入 Web 主 bundle（顶部静态 import 的 Capacitor 插件因此被隔离到独立 chunk）。
 */
export class CapacitorBridge implements NativeBridge {
  async scheduleRestTimerNotification(seconds: number): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title: '休息结束',
          body: '该开始下一组了！',
          schedule: {
            at: new Date(Date.now() + seconds * 1000),
          },
        },
      ],
    });
  }

  async hapticLight(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light });
  }

  async hapticMedium(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }

  async exportBackupFile(filename: string, json: string): Promise<void> {
    // 写入应用外部目录（卸载时随之删除），随后调起系统分享
    const result = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.External,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      files: [result.uri],
      title: filename,
      dialogTitle: '导出备份',
    });
  }

  async importBackupFile(): Promise<string | null> {
    // TODO: 文件选择器需要额外插件（如 @capawesome/capacitor-file-picker），
    // 当前保守返回 null，避免引入未确认的 API。后续 P5 阶段补齐。
    return null;
  }
}
