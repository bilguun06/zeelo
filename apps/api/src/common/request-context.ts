import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function requestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Assigns a request id (or accepts a sane inbound one) and exposes ip/UA to services. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header('x-request-id');
  const requestId = inbound && /^[\w-]{8,64}$/.test(inbound) ? inbound : randomUUID();
  res.setHeader('x-request-id', requestId);
  storage.run({ requestId, ip: req.ip, userAgent: req.header('user-agent')?.slice(0, 255) }, () => next());
}
