/**
 * Workflow Step Notification Service
 * 
 * Sends email notifications when workflow steps enter READY state.
 * Feature flag controlled via ENABLE_WORKFLOW_NOTIFICATIONS env variable.
 */

import { Role, type WorkflowInstanceStep, type WorkflowInstance } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getMailer } from "@/lib/mail/transporter";
import { WorkflowMetrics } from "./observability";
import type { NotificationPolicy, NotificationTrigger } from "./notification-policy";
import type { NotificationChannel } from "./notification-policy";

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

type StepWithContext = WorkflowInstanceStep & {
  instance: WorkflowInstance & {
    template: { name: string } | null;
    matter: {
      id: string;
      title: string;
      ownerId: string | null;
      owner?: { id: string; name: string | null; email: string | null } | null;
      parties: Array<{
        role: string;
        contact: {
          email: string | null;
          firstName: string;
          lastName: string;
          phone?: string | null;
        };
      }>;
    } | null;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone?: string | null;
    } | null;
  };
  assignedTo?: { id: string; name: string | null; email: string | null; phone?: string | null } | null;
};

type NotificationLogEntry = {
  at: string;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  recipients: string[];
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
};

function parseNotificationPolicies(value: Prisma.JsonValue | null | undefined): NotificationPolicy[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value as NotificationPolicy[];
  }
  return [];
}

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
  step: StepWithContext,
): Promise<Array<{ email: string; name: string }>> {
  const recipients: Array<{ email: string; name: string }> = [];
  const matter = step.instance.matter;

  if (!matter) {
    console.warn(`[Workflow Notifications] No matter found for step ${step.id}, cannot determine recipients`);
    return recipients;
  }

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

type TemplateContext = {
  step: {
    id: string;
    title: string;
    actionType: string;
    roleScope: string;
  };
  instance: {
    id: string;
    templateName?: string | null;
  };
  matter?: {
    id: string;
    title: string;
    owner?: { id: string | null; name: string | null; email: string | null };
  } | null;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
  } | null;
};

function buildTemplateContext(step: StepWithContext): TemplateContext {
  return {
    step: {
      id: step.id,
      title: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
    },
    instance: {
      id: step.instance.id,
      templateName: step.instance.template?.name,
    },
    matter: step.instance.matter
      ? {
          id: step.instance.matter.id,
          title: step.instance.matter.title,
          owner: {
            id: step.instance.matter.ownerId ?? null,
            name: step.instance.matter.owner?.name ?? null,
            email: step.instance.matter.owner?.email ?? null,
          },
        }
      : null,
    contact: step.instance.contact,
    assignedTo: step.assignedTo ?? null,
  };
}

function resolveTemplateValue(path: string, context: Record<string, unknown>): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

function renderTemplate(template: string | undefined, context: Record<string, unknown>): string | undefined {
  if (!template) return undefined;
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, token) => {
    const value = resolveTemplateValue(token.trim(), context);
    return value === undefined || value === null ? "" : String(value);
  });
}

function resolveAddressList(values: string[] | undefined, context: Record<string, unknown>): string[] {
  if (!values) return [];
  return values
    .map((raw) => renderTemplate(raw, context)?.trim())
    .filter((val): val is string => Boolean(val))
    .filter((val, idx, arr) => arr.indexOf(val) === idx);
}

function appendLogEntries(
  existing: Prisma.JsonValue | null | undefined,
  entries: NotificationLogEntry[],
): NotificationLogEntry[] {
  const current = Array.isArray(existing) ? (existing as NotificationLogEntry[]) : [];
  return [...current, ...entries];
}

async function fetchStepWithContext(
  tx: PrismaClientOrTransaction,
  stepId: string,
): Promise<StepWithContext | null> {
  return tx.workflowInstanceStep.findUnique({
    where: { id: stepId },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      instance: {
        include: {
          template: { select: { name: true } },
          matter: {
            select: {
              id: true,
              title: true,
              ownerId: true,
              owner: { select: { id: true, name: true, email: true } },
              parties: {
                include: {
                  contact: {
                    select: {
                      email: true,
                      firstName: true,
                      lastName: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  }) as Promise<StepWithContext | null>;
}

async function dispatchNotificationPolicies(
  tx: PrismaClientOrTransaction,
  step: StepWithContext,
  trigger: NotificationTrigger,
): Promise<boolean> {
  const policies = parseNotificationPolicies(step.notificationPolicies);
  if (policies.length === 0) {
    return false;
  }

  const matching = policies.filter((policy) => {
    const triggers = (policy.triggers && policy.triggers.length > 0) ? policy.triggers : ["ON_READY"];
    return triggers.includes(trigger);
  });

  if (matching.length === 0) {
    return false;
  }

  const templateContext = buildTemplateContext(step);
  const logs: NotificationLogEntry[] = [];
  const now = new Date().toISOString();

  for (const policy of matching) {
    if (
      policy.sendStrategy === "DELAYED" &&
      (policy.delayMinutes ?? 0) > 0
    ) {
      logs.push({
        at: now,
        trigger,
        channel: policy.channel,
        recipients: policy.recipients ?? [],
        status: "SKIPPED",
        error: "Delayed notifications are not implemented yet",
      });
      continue;
    }

    if (policy.channel === "EMAIL") {
      const entry = await processEmailPolicy(policy, step, templateContext, trigger);
      logs.push(entry);
    } else {
      logs.push({
        at: now,
        trigger,
        channel: policy.channel,
        recipients: policy.recipients ?? [],
        status: "SKIPPED",
        error: `Channel ${policy.channel} not implemented`,
      });
    }
  }

  if (logs.length > 0) {
    await tx.workflowInstanceStep.update({
      where: { id: step.id },
      data: {
        notificationLog: appendLogEntries(step.notificationLog, logs) as Prisma.InputJsonValue,
      },
    });
  }

  return logs.some((entry) => entry.status === "SENT");
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
    APPROVAL: "Avukat Onayı",
    SIGNATURE: "Müvekkil İmzası",
    REQUEST_DOC: "Doküman Talebi",
    PAYMENT: "Ödeme",
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

async function processEmailPolicy(
  policy: NotificationPolicy,
  step: StepWithContext,
  templateContext: TemplateContext,
  trigger: NotificationTrigger,
): Promise<NotificationLogEntry> {
  const mailer = getMailer();
  const recipients = resolveAddressList(policy.recipients ?? [], templateContext);

  if (recipients.length === 0) {
    return {
      at: new Date().toISOString(),
      trigger,
      channel: "EMAIL",
      recipients: [],
      status: "SKIPPED",
      error: "No recipients resolved",
    };
  }

  const cc = resolveAddressList(policy.cc ?? [], templateContext);
  const subject =
    renderTemplate(policy.subjectTemplate, templateContext) ??
    `Workflow Update: ${templateContext.step.title}`;

  const defaultBody = [
    `Hello,`,
    "",
    `Step "${templateContext.step.title}" (${templateContext.step.actionType}) triggered event ${trigger}.`,
    templateContext.matter ? `Matter: ${templateContext.matter.title}` : "",
    "",
    "Please sign in to review the details.",
  ]
    .filter(Boolean)
    .join("\n");

  const textBody = renderTemplate(policy.bodyTemplate, templateContext) ?? defaultBody;
  const htmlBody = `<div style="font-family: Arial, sans-serif; line-height:1.6; white-space:pre-wrap;">${textBody.replace(
    /\n/g,
    "<br/>",
  )}</div>`;

  const from = process.env.SMTP_FROM ?? process.env.MAIL_FROM ?? "Legal CRM <noreply@legalcrm.local>";

  try {
    await mailer.sendMail({
      from,
      to: recipients,
      cc: cc.length ? cc : undefined,
      subject,
      text: textBody,
      html: htmlBody,
    });
    WorkflowMetrics.recordNotificationSent(step.actionType, true);
    return {
      at: new Date().toISOString(),
      trigger,
      channel: "EMAIL",
      recipients,
      status: "SENT",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    WorkflowMetrics.recordNotificationSent(step.actionType, false);
    return {
      at: new Date().toISOString(),
      trigger,
      channel: "EMAIL",
      recipients,
      status: "FAILED",
      error: message,
    };
  }
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
    const step = await fetchStepWithContext(tx, stepId);

    if (!step) {
      console.warn(`[Workflow Notifications] Step ${stepId} not found`);
      return;
    }

    const handled = await dispatchNotificationPolicies(tx, step, "ON_READY");
    if (handled) {
      return;
    }

    const ownerId = step.instance.matter?.ownerId;
    if (!ownerId) {
      console.warn(`[Workflow Notifications] Matter has no owner for step ${stepId}`);
      return;
    }

    const matterOwner = await tx.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, email: true },
    });

    if (!matterOwner?.email) {
      console.warn(`[Workflow Notifications] Matter owner not found or missing email for step ${stepId}`);
      return;
    }

    const context: NotificationContext = {
      stepId: step.id,
      stepTitle: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      workflowName: step.instance.template?.name ?? "",
      matterTitle: step.instance.matter?.title ?? "",
      matterOwner: {
        id: matterOwner.id,
        name: matterOwner.name,
        email: matterOwner.email,
      },
    };

    const recipients = await getEligibleActors(tx, step);

    if (recipients.length === 0) {
      console.warn(`[Workflow Notifications] No eligible recipients for step ${stepId}`);
      return;
    }

    for (const recipient of recipients) {
      try {
        await sendStepReadyNotification(recipient, context);
        WorkflowMetrics.recordNotificationSent(step.actionType, true);
      } catch (error) {
        console.error(`[Workflow Notifications] Failed to send to ${recipient.email}:`, error);
        WorkflowMetrics.recordNotificationSent(step.actionType, false);
      }
    }
  } catch (error) {
    console.error(`[Workflow Notifications] Error processing notification for step ${stepId}:`, error);
    // Don't throw - notifications are non-critical
  }
}

export async function notifyStepCompleted(
  tx: PrismaClientOrTransaction,
  stepId: string,
): Promise<void> {
  if (!isNotificationEnabled()) {
    return;
  }
  const step = await fetchStepWithContext(tx, stepId);
  if (!step) return;
  await dispatchNotificationPolicies(tx, step, "ON_COMPLETED");
}

export async function notifyStepFailed(
  tx: PrismaClientOrTransaction,
  stepId: string,
): Promise<void> {
  if (!isNotificationEnabled()) {
    return;
  }
  const step = await fetchStepWithContext(tx, stepId);
  if (!step) return;
  await dispatchNotificationPolicies(tx, step, "ON_FAILED");
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
