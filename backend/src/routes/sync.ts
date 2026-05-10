import type { FastifyInstance } from 'fastify';
import { badRequest } from '../plugins/errorHandler.js';
import { mockDb } from '../mockDb.js';

interface PushBody {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  settings?: any;
  plans?: any[];
  sessions?: any[];
  exercises?: any[];
}

export default async function syncRoutes(fastify: FastifyInstance) {
  // Endpoints requested by m2 checklist
  fastify.post<{ Body: PushBody }>('/api/backups', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    return handlePush(request, reply);
  });

  fastify.get('/api/backups/latest', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    return handlePull(request, reply);
  });

  async function handlePush(request: any, reply: any) {
    const user = request.user;
    const body = request.body;

    if (!body.schemaVersion || !body.exportedAt || !body.appVersion) {
      throw badRequest('Missing required fields: schemaVersion, exportedAt, appVersion');
    }

    if (body.settings) mockDb.settings.set(user.id, body.settings);
    if (body.plans) mockDb.plans.set(user.id, body.plans);
    if (body.sessions) mockDb.sessions.set(user.id, body.sessions);
    
    mockDb.syncMeta.set(user.id, {
      lastSyncedAt: new Date(),
      lastSyncStatus: 'success',
    });

    return reply.status(200).send({
      success: true,
      syncedAt: new Date().toISOString(),
      message: 'Data synced to mock cloud successfully',
    });
  }

  async function handlePull(request: any, reply: any) {
    const user = request.user;

    const settings = mockDb.settings.get(user.id) || null;
    const plans = mockDb.plans.get(user.id) || [];
    const sessions = mockDb.sessions.get(user.id) || [];
    const syncMeta = mockDb.syncMeta.get(user.id) || null;

    return reply.status(200).send({
      success: true,
      data: {
        schemaVersion: settings?.schemaVersion || 1,
        exportedAt: syncMeta?.lastSyncedAt?.toISOString() || new Date().toISOString(),
        appVersion: '1.0.0', // can be dynamic
        settings,
        plans,
        sessions,
      },
      syncedAt: new Date().toISOString(),
    });
  }
}

