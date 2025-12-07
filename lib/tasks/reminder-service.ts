import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getMailer } from "@/lib/mail/transporter";
import { incrementMetric } from "@/lib/metrics";
import { TaskStatus } from "@prisma/client";

const LOOKAHEAD_MINUTES = Math.max(
  Number.parseInt(process.env.TASK_REMINDER_LOOKAHEAD_MINUTES ?? "60", 10),
  5,
);

const STATUS_ELIGIBLE: TaskStatus[] = ["OPEN", "IN_PROGRESS"];

type TaskReminderCandidate = Awaited<
  ReturnType<(typeof prisma.task)["findMany"]>
>[number];

type CandidateWithRelations = TaskReminderCandidate & {
  assignee: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
  matter: {
    id: string;
    title: string;
    owner: { email: string | null } | null;
  } | null;
};

const WINDOW_BACKSTOP_MS = 5 * 60 * 1000;

export async function scanAndSendTaskReminders(now = new Date()) {
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60 * 1000);

  const candidates = (await prisma.task.findMany({
    where: {
      reminderNotified: false,
      dueAt: { not: null, lte: windowEnd },
      status: { in: STATUS_ELIGIBLE },
    },
    include: {
      assignee: { select: { id: true, email: true, name: true } },
      matter: {
        select: {
          id: true,
          title: true,
          owner: { select: { email: true } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: 200,
  })) as CandidateWithRelations[];

  if (candidates.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;
  for (const task of candidates) {
    if (!task.dueAt) continue;

    const diffMs = task.dueAt.getTime() - now.getTime();
    if (diffMs < -WINDOW_BACKSTOP_MS) {
      continue;
    }

    if (diffMs > LOOKAHEAD_MINUTES * 60 * 1000) {
      continue;
    }

    const recipients = new Set<string>();
    if (task.assignee?.email) {
      recipients.add(task.assignee.email);
    }

    if (task.matter?.owner?.email) {
      recipients.add(task.matter.owner.email);
    }

    if (recipients.size === 0) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          reminderNotified: true,
          reminderNotifiedAt: now,
        },
      });
      continue;
    }

    try {
      await sendTaskReminderEmail(task, Array.from(recipients), now);
      await prisma.task.update({
        where: { id: task.id },
        data: {
          reminderNotified: true,
          reminderNotifiedAt: now,
        },
      });
      sent += 1;
    } catch (error) {
      console.error("[task-reminder] Failed to send email", {
        taskId: task.id,
        error,
      });
    }
  }

  if (sent > 0) {
    incrementMetric("task_reminders_sent", sent);
    console.info(`[task-reminder] Dispatched ${sent} reminder(s)`);
  }

  return { processed: candidates.length, sent };
}

async function sendTaskReminderEmail(
  task: CandidateWithRelations,
  recipients: string[],
  now: Date,
) {
  const transporter = getMailer();
  const dueFormatted = task.dueAt
    ? format(task.dueAt, "yyyy-MM-dd HH:mm")
    : "Belirtilmedi";

  const subject = `[Legal CRM] Task Reminder: ${task.title}`;
  const bodyLines = [
    "Merhaba,",
    "",
    `Görev hatırlatıcısı: ${task.title}`,
    `Öncelik: ${task.priority}`,
    `Planlanan bitiş: ${dueFormatted}`,
  ];

  if (task.matter?.title) {
    bodyLines.push(`Dava: ${task.matter.title}`);
  }

  if (task.description) {
    bodyLines.push("", "Görev detayı:", task.description);
  }

  bodyLines.push(
    "",
    `Bu hatırlatma ${format(now, "yyyy-MM-dd HH:mm")} tarihinde gönderildi.`,
    "",
    "Legal CRM",
  );

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "Legal CRM <no-reply@legalcrm.local>",
    to: recipients,
    subject,
    text: bodyLines.join("\n"),
  });
}
