import type { BackupCreatedEvent } from "./types.js";

export interface EventPublisher {
  publishBackupCreated(event: BackupCreatedEvent): Promise<void>;
}
