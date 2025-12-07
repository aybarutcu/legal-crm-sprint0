import { prisma } from "@/lib/prisma";

type AuditParams = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  metadata,
}: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata as any,
      },
    });
  } catch (error) {
    // Audit logs must never block user operations.
    console.error("Failed to record audit log", {
      error,
      action,
      entityType,
      entityId,
    });
  }
}
