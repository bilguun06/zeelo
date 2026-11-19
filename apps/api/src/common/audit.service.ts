import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService, type Tx } from './prisma.service';
import { requestContext } from './request-context';

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

const REDACT = /password|secret|token|registerNumber(?!Masked|Last4)|accountNumber(?!Masked)|otp/i;

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return value.toString();
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.test(k) ? '[REDACTED]' : redact(v)]));
  }
  return value;
}

/** Append-only audit trail. Sensitive fields are redacted before persistence. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Tx): Promise<void> {
    const ctx = requestContext();
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (redact(entry.before) ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (redact(entry.after) ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
          requestId: ctx?.requestId,
        },
      });
    } catch (e) {
      if (tx) throw e; // inside a money transaction audit failure must abort the operation
      this.logger.error(`Failed to write audit log ${entry.action}: ${(e as Error).message}`);
    }
  }
}
