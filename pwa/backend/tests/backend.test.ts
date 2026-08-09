import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.AUTH_MODE = "mock";
process.env.DATA_MODE = "mock";
process.env.EVENT_PUBLISHER = "mock";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
process.env.MAX_BACKUP_BYTES = String(10 * 1024 * 1024);

const [
  { buildServer },
  { buildWorker },
  { repositories },
  { getMockBackupSnapshotsForTests, resetMockBackupSnapshotsForTests },
] = await Promise.all([
  import("../src/app.js"),
  import("../src/workerApp.js"),
  import("../src/repositories/index.js"),
  import("../src/repositories/mock.js"),
]);

const validBackup = {
  schemaVersion: 1,
  exportedAt: "2026-08-08T08:00:00.000Z",
  appVersion: "1.1.0",
  settings: {
    schemaVersion: 1,
    weightUnit: "kg",
    distanceUnit: "km",
    darkMode: false,
  },
  plans: [],
  sessions: [],
  exercises: [],
};

function validBackupJsonAtSize(size: number): string {
  const exercise = {
    id: "large",
    name: "large",
    type: "cardio",
    description: "",
  };
  const payload = { ...validBackup, exercises: [exercise] };
  const empty = JSON.stringify(payload);
  exercise.description = "x".repeat(size - Buffer.byteLength(empty));
  const serialized = JSON.stringify(payload);
  assert.equal(Buffer.byteLength(serialized), size);
  return serialized;
}

describe("VibeFit backend API", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let token = "";

  before(async () => {
    app = await buildServer();
    const email = `pi-test-${randomUUID()}@example.com`;
    const sendCode = await app.inject({
      method: "POST",
      url: "/api/auth/send-code",
      payload: { email },
    });
    assert.equal(sendCode.statusCode, 200);
    const devCode = sendCode.json().devCode as string;

    const verify = await app.inject({
      method: "POST",
      url: "/api/auth/verify-code",
      payload: { email, code: devCode },
    });
    assert.equal(verify.statusCode, 200);
    token = verify.json().token as string;
  });

  after(async () => {
    await app.close();
  });

  it("reports immutable release metadata", async () => {
    const response = await app.inject({ method: "GET", url: "/api/version" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().releaseVersion, "1.1.0");
    assert.equal(response.json().databaseSchemaVersion, "1");
    assert.ok(response.json().gitRevision);
  });

  it("stores a valid backup and returns it as the latest snapshot", async () => {
    const push = await app.inject({
      method: "POST",
      url: "/api/backups",
      headers: { authorization: `Bearer ${token}` },
      payload: validBackup,
    });
    assert.equal(push.statusCode, 200);
    assert.equal(push.json().success, true);

    const pull = await app.inject({
      method: "GET",
      url: "/api/backups/latest",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(pull.statusCode, 200);
    assert.deepEqual(pull.json().data, validBackup);
  });

  it("rejects malformed backup payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backups",
      headers: { authorization: `Bearer ${token}` },
      payload: { schemaVersion: 1, plans: "invalid" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "BAD_REQUEST");
  });

  it("rejects a malformed nested session without storing it", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backups",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...validBackup,
        sessions: [{ id: "broken", startedAt: "2026-08-08T08:00:00Z", exercises: "invalid" }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "BAD_REQUEST");
  });

  it("accepts a valid payload exactly at the 10MiB boundary", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backups",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: validBackupJsonAtSize(10 * 1024 * 1024),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().success, true);
  });

  it("rejects payloads larger than 10MiB", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backups",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: validBackupJsonAtSize(10 * 1024 * 1024 + 1),
    });

    assert.equal(response.statusCode, 413);
    assert.equal(response.json().code, "PAYLOAD_TOO_LARGE");
  });
});

describe("VibeFit backup worker", () => {
  it("rejects malformed event envelopes without running retention", async () => {
    const prune = mock.method(
      repositories.backups,
      "pruneExpiredByUserId",
      async () => 0,
    );
    const worker = await buildWorker();
    const response = await worker.inject({
      method: "POST",
      url: "/pubsub/backups",
      payload: { message: { data: "not-valid-base64-json" } },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(prune.mock.calls.length, 0);
    prune.mock.restore();
    await worker.close();
  });

  it("applies the 90-day policy while preserving at least 10 snapshots", async () => {
    const prune = mock.method(
      repositories.backups,
      "pruneExpiredByUserId",
      async () => 2,
    );
    const worker = await buildWorker();
    const userId = randomUUID();
    const event = {
      eventType: "backup.created",
      eventVersion: 1,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      userId,
      backupId: randomUUID(),
      deviceId: null,
    };
    const response = await worker.inject({
      method: "POST",
      url: "/pubsub/backups",
      payload: {
        message: {
          data: Buffer.from(JSON.stringify(event)).toString("base64"),
          messageId: event.eventId,
        },
        subscription: "local-worker",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(prune.mock.calls.length, 1);
    assert.equal(prune.mock.calls[0].arguments[0], userId);
    assert.equal(prune.mock.calls[0].arguments[1].minToKeep, 10);
    const retentionCutoff = prune.mock.calls[0].arguments[1].olderThan.getTime();
    const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(retentionCutoff - expectedCutoff) < 2_000);

    prune.mock.restore();
    await worker.close();
  });

  it("deletes only snapshots older than 90 days and always retains the latest 10", async () => {
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const now = Date.now();
    const snapshots = Array.from({ length: 13 }, (_, index) => ({
      id: randomUUID(),
      userId,
      deviceId: null,
      payload: { index },
      createdAt: new Date(now - (index === 0 ? 1 : 100 + index) * 24 * 60 * 60 * 1000).toISOString(),
    }));
    const otherSnapshot = {
      id: randomUUID(),
      userId: otherUserId,
      deviceId: null,
      payload: { other: true },
      createdAt: new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    resetMockBackupSnapshotsForTests([...snapshots, otherSnapshot]);

    const worker = await buildWorker();
    const event = {
      eventType: "backup.created",
      eventVersion: 1,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      userId,
      backupId: snapshots[0].id,
      deviceId: null,
    };
    const payload = {
      message: {
        data: Buffer.from(JSON.stringify(event)).toString("base64"),
        messageId: event.eventId,
      },
    };

    assert.equal((await worker.inject({ method: "POST", url: "/pubsub/backups", payload })).statusCode, 204);
    assert.equal((await worker.inject({ method: "POST", url: "/pubsub/backups", payload })).statusCode, 204);

    const remaining = getMockBackupSnapshotsForTests();
    const userSnapshots = remaining.filter((snapshot) => snapshot.userId === userId);
    assert.equal(userSnapshots.length, 10);
    assert.deepEqual(
      new Set(userSnapshots.map((snapshot) => snapshot.id)),
      new Set(snapshots.slice(0, 10).map((snapshot) => snapshot.id)),
    );
    assert.ok(remaining.some((snapshot) => snapshot.id === otherSnapshot.id));
    await worker.close();
  });
});
