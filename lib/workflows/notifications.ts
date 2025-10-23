/**
 * Workflow Step Notification Service
 * 
 * Sends email notifications when workflow steps enter READY state.
 * Feature flag controlled via ENABLE_WORKFLOW_NOTIFICATIONS env variable.
 */

import { Role, type WorkflowInstanceStep } from "@prisma/client";
import { getMailer } from "@/lib/mail/transporter";
import { WorkflowMetrics } from "./observability";
import type { PrismaClient } from "@prisma/client";

type PrismaClientOrTransaction = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type NotificationContext = {
  stepId: string;
  stepTitle: string;
  actionType: string;
  roleScope: Role;
  workflowName: string;
  matterTitle: string;
  matterOwner: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

/**
 * Check if workflow notifications are enabled
 */
export function isNotificationEnabled(): boolean {
  return process.env.ENABLE_WORKFLOW_NOTIFICATIONS === "true";
}

/**
 * Get eligible actors for a workflow step based on roleScope
 */
async function getEligibleActors(
  tx: PrismaClientOrTransaction,
  step: WorkflowInstanceStep & {
    instance: {
      id: string;
      matterId: string;
      matter: {
        id: string;
        ownerId: string | null;
        parties: Array<{
          role: string;
          contact: {
            email: string | null;
            firstName: string;
            lastName: string;
          };
        }>;
      };
    };
  },
): Promise<Array<{ email: string; name: string }>> {
  const recipients: Array<{ email: string; name: string }> = [];
  const matter = step.instance.matter;

  switch (step.roleScope) {
    case "ADMIN": {
      // Get all org admins
      const admins = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { email: true, name: true },
      });
      recipients.push(...admins.map(admin => ({
        email: admin.email ?? "",
        name: admin.name ?? admin.email ?? "Admin",
      })).filter(a => a.email));
      break;
    }

    case "LAWYER": {
      // Get matter owner (lawyer)
      if (matter.ownerId) {
        const owner = await tx.user.findUnique({
          where: { id: matter.ownerId },
          select: { email: true, name: true },
        });
        if (owner?.email) {
          recipients.push({
            email: owner.email,
            name: owner.name ?? owner.email,
          });
        }
      }
      break;
    }

    case "PARALEGAL": {
      // Get paralegals associated with the matter
      // For now, get all paralegals in the org
      const paralegals = await tx.user.findMany({
        where: { role: "PARALEGAL" },
        select: { email: true, name: true },
      });
      recipients.push(...paralegals.map(p => ({
        email: p.email ?? "",
        name: p.name ?? p.email ?? "Paralegal",
      })).filter(p => p.email));
      break;
    }

    case "CLIENT": {
      // Get assigned client from matter parties
      const clientParties = matter.parties.filter(p => 
        p.role === "PLAINTIFF" || p.role === "DEFENDANT"
      );
      for (const party of clientParties) {
        if (party.contact.email) {
          recipients.push({
            email: party.contact.email,
            name: `${party.contact.firstName} ${party.contact.lastName}`.trim(),
          });
        }
      }
      break;
    }
  }

  return recipients;
}

/**
 * Send notification email for a READY workflow step
 */
async function sendStepReadyNotification(
  recipient: { email: string; name: string },
  context: NotificationContext,
): Promise<void> {
  const mailer = getMailer();
  const from = process.env.SMTP_FROM ?? process.env.MAIL_FROM ?? "Legal CRM <noreply@legalcrm.local>";
  const subject = `Workflow Adımı Hazır: ${context.stepTitle}`;

  const actionTypeLabels: Record<string, string> = {
    APPROVAL_LAWYER: "Avukat Onayı",
    SIGNATURE_CLIENT: "Müvekkil İmzası",
    REQUEST_DOC: "Doküman Talebi",
    PAYMENT_CLIENT: "Ödeme",
    CHECKLIST: "Kontrol Listesi",
  };

  const actionLabel = actionTypeLabels[context.actionType] ?? context.actionType;

  const text = [
    `Merhaba ${recipient.name},`,
    "",
    `"${context.workflowName}" workflow'unda yeni bir adım sizin aksiyonunuzu bekliyor:`,
    "",
    `Adım: ${context.stepTitle}`,
    `Aksiyon Tipi: ${actionLabel}`,
    `Dosya: ${context.matterTitle}`,
    "",
    "Adımı görüntülemek ve işleme almak için lütfen Legal CRM'e giriş yapın.",
    "",
    "Teşekkürler,",
    "Legal CRM Ekibi",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Merhaba <strong>${recipient.name}</strong>,</p>
      <p>"<strong>${context.workflowName}</strong>" workflow'unda yeni bir adım sizin aksiyonunuzu bekliyor:</p>
      
      <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Adım:</strong> ${context.stepTitle}</p>
        <p style="margin: 8px 0 0 0;"><strong>Aksiyon Tipi:</strong> ${actionLabel}</p>
        <p style="margin: 8px 0 0 0;"><strong>Dosya:</strong> ${context.matterTitle}</p>
      </div>

      <p>Adımı görüntülemek ve işleme almak için lütfen Legal CRM'e giriş yapın.</p>
      
      <p style="margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/dashboard" 
           style="background-color:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
          Dashboard'a Git
        </a>
      </p>

      <p style="margin-top: 32px;">Teşekkürler,<br/>Legal CRM Ekibi</p>
    </div>
  `;

  await mailer.sendMail({
    from,
    to: recipient.email,
    subject,
    text,
    html,
  });
}

/**
 * Notify eligible actors when a step enters READY state
 * 
 * This function should be called after a step is updated to READY state.
 * It will:
 * 1. Check if notifications are enabled
 * 2. Determine eligible actors based on roleScope
 * 3. Send email notifications to each eligible actor
 * 
 * @param tx - Prisma transaction client
 * @param stepId - ID of the step that entered READY state
 */
export async function notifyStepReady(
  tx: PrismaClientOrTransaction,
  stepId: string,
): Promise<void> {
  // Check feature flag
  if (!isNotificationEnabled()) {
    console.log(`[Workflow Notifications] Disabled - skipping notification for step ${stepId}`);
    return;
  }

  try {
    // Fetch step with related data
    const step = await tx.workflowInstanceStep.findUnique({
      where: { id: stepId },
      include: {
        instance: {
          include: {
            template: {
              select: { name: true },
            },
            matter: {
              select: {
                id: true,
                title: true,
                ownerId: true,
                parties: {
                  include: {
                    contact: {
                      select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!step) {
      console.warn(`[Workflow Notifications] Step ${stepId} not found`);
      return;
    }

    // Get matter owner info
    const ownerId = step.instance.matter.ownerId;
    if (!ownerId) {
      console.warn(`[Workflow Notifications] Matter has no owner for step ${stepId}`);
      return;
    }

    const matterOwner = await tx.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, email: true },
    });

    if (!matterOwner) {
      console.warn(`[Workflow Notifications] Matter owner not found for step ${stepId}`);
      return;
    }

    const context: NotificationContext = {
      stepId: step.id,
      stepTitle: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      workflowName: step.instance.template.name,
      matterTitle: step.instance.matter.title,
      matterOwner: {
        id: matterOwner.id,
        name: matterOwner.name,
        email: matterOwner.email,
      },
    };

    // Get eligible actors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recipients = await getEligibleActors(tx, step as any);

    if (recipients.length === 0) {
      console.warn(`[Workflow Notifications] No eligible recipients for step ${stepId}`);
      return;
    }

    // Send notifications (with basic throttling - one email per recipient)
    console.log(`[Workflow Notifications] Sending ${recipients.length} notification(s) for step ${stepId}`);
    
    for (const recipient of recipients) {
      try {
        await sendStepReadyNotification(recipient, context);
        console.log(`[Workflow Notifications] Sent notification to ${recipient.email}`);
        
        // Record successful notification metric
        WorkflowMetrics.recordNotificationSent(step.actionType, true);
      } catch (error) {
        console.error(`[Workflow Notifications] Failed to send to ${recipient.email}:`, error);
        
        // Record failed notification metric
        WorkflowMetrics.recordNotificationSent(step.actionType, false);
        
        // Continue with other recipients even if one fails
      }
    }
  } catch (error) {
    console.error(`[Workflow Notifications] Error processing notification for step ${stepId}:`, error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Notify multiple steps that entered READY state
 * 
 * Convenience function for bulk notifications
 */
export async function notifyStepsReady(
  tx: PrismaClientOrTransaction,
  stepIds: string[],
): Promise<void> {
  for (const stepId of stepIds) {
    await notifyStepReady(tx, stepId);
  }
}
