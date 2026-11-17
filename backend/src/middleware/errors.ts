import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { log, safeErrorFields } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'NOT_FOUND', requisicao: req.requestId });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    const firstMessage = error.issues[0]?.message;
    res.status(400).json({
      erro: firstMessage && firstMessage !== 'Invalid input' ? firstMessage : 'Confira os dados informados.',
      codigo: 'VALIDATION_ERROR',
      campos: error.flatten().fieldErrors,
      requisicao: req.requestId,
    });
    return;
  }

  if (error instanceof HttpError) {
    log(error.status >= 500 ? 'error' : 'warn', 'api_error', {
      requestId: req.requestId,
      status: error.status,
      errorCode: error.code,
    });
    res.status(error.status).json({ erro: error.message, codigo: error.code, requisicao: req.requestId });
    return;
  }

  log('error', 'unhandled_error', { requestId: req.requestId, ...safeErrorFields(error) });
  res.status(500).json({ erro: 'Erro interno do servidor.', codigo: 'INTERNAL_ERROR', requisicao: req.requestId });
};
