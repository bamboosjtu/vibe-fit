import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ApiError } from '../types/index.js';

class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function createError(statusCode: number, code: string, message: string, details?: unknown): AppError {
  return new AppError(statusCode, code, message, details);
}

export function badRequest(message: string, details?: unknown): AppError {
  return createError(400, 'BAD_REQUEST', message, details);
}

export function notFound(message: string, details?: unknown): AppError {
  return createError(404, 'NOT_FOUND', message, details);
}

export function unauthorized(message: string, details?: unknown): AppError {
  return createError(401, 'UNAUTHORIZED', message, details);
}

export function internalError(message: string, details?: unknown): AppError {
  return createError(500, 'INTERNAL_ERROR', message, details);
}

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.error(error);

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      statusCode,
      code: 'INTERNAL_ERROR',
      message: env.isProd() ? 'Internal Server Error' : error.message,
    });
  });

  fastify.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
}

import { env } from '../config/env.js';

export default fp(errorHandlerPlugin, { name: 'errorHandler' });
