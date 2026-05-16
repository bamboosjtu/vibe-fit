import type { EventPublisher } from "./publisher.js";
import type { BackupCreatedEvent } from "./types.js";

export class MockEventPublisher implements EventPublisher {
  async publishBackupCreated(event: BackupCreatedEvent): Promise<void> {
    console.info(
      JSON.stringify({
        message: "Mock publish backup.created",
        event,
      }),
    );
  }
}
