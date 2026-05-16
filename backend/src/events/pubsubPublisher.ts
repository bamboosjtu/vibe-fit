import { PubSub } from "@google-cloud/pubsub";
import { env } from "../config/env.js";
import type { EventPublisher } from "./publisher.js";
import type { BackupCreatedEvent } from "./types.js";

export class PubSubEventPublisher implements EventPublisher {
  private readonly pubsub = new PubSub();

  async publishBackupCreated(event: BackupCreatedEvent): Promise<void> {
    const data = Buffer.from(JSON.stringify(event), "utf8");

    const messageId = await this.pubsub
      .topic(env.PUBSUB_TOPIC_BACKUP_CREATED)
      .publishMessage({
        data,
        attributes: {
          eventType: event.eventType,
          eventVersion: String(event.eventVersion),
        },
      });

    console.info(
      JSON.stringify({
        message: "Published backup.created",
        messageId,
        eventId: event.eventId,
        backupId: event.backupId,
        userId: event.userId,
      }),
    );
  }
}
