export interface BackupCreatedEvent {
  eventType: "backup.created";
  eventVersion: 1;
  eventId: string;
  occurredAt: string;
  userId: string;
  backupId: string;
  deviceId?: string | null;
}

export type DomainEvent = BackupCreatedEvent;
