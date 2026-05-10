import { Prisma } from '@splash/db';

// Mirror of the Prisma AuditAction enum. Defined locally so the build does
// not depend on the enum being re-exported by @splash/db.
type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'state_change'
  | 'grant'
  | 'revoke'
  | 'adjust';

export type AuditInput = {
  businessId: string;
  actorType: 'user' | 'customer' | 'system' | 'webhook';
  actorUserId?: string | null;
  actorCustomerId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function audit(tx: Prisma.TransactionClient, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      businessId: input.businessId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorCustomerId: input.actorCustomerId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      diff: (input.diff as any) ?? undefined,
      metadata: (input.metadata as any) ?? undefined,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
