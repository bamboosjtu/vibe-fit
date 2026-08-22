import type { EventPublisher } from "./publisher.js";
import type { BackupCreatedEvent } from "./types.js";
import { env } from "../config/env.js";

/**
 * 本地事件发布：用 HTTP POST 模拟 Pub/Sub push，把事件推送到本地 worker。
 *
 * worker 暴露的 /pubsub/backups 端点接受与 Pub/Sub push 相同的 body 结构，
 * 因此本发布器把事件编码为 base64 后包装成 Pub/Sub push 格式发送。
 * 全部跑在 Docker 网络内，无需 Redis / GCP Pub/Sub。
 */
export class LocalHttpEventPublisher implements EventPublisher {
  async publishBackupCreated(event: BackupCreatedEvent): Promise<void> {
    const data = Buffer.from(JSON.stringify(event), "utf8").toString("base64");

    const body = {
      message: {
        data,
        messageId: event.eventId,
        publishTime: event.occurredAt,
        attributes: {
          eventType: event.eventType,
          eventVersion: String(event.eventVersion),
        },
      },
      subscription: "local-worker",
    };

    const response = await fetch(env.WORKER_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(
        `Worker push failed: ${response.status} ${response.statusText}`,
      );
    }

    console.info(
      JSON.stringify({
        message: "Pushed backup.created to local worker",
        eventId: event.eventId,
        backupId: event.backupId,
        userId: event.userId,
      }),
    );
  }
}
