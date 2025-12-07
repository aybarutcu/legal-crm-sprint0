import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { eventDefaultInclude } from "@/lib/events/service";
import { getMailer } from "@/lib/mail/transporter";
import { incrementMetric } from "@/lib/metrics";

type ReminderCandidate = Awaited<
  ReturnType<typeof prisma.event.findMany>
>[number] & {
  organizer: {
    id: string;
    email: string | null;
    name: string | null;
  };
  matter?: {
    id: string;
    title: string;
    ownerId: string;
  } | null;
};

const MAX_LOOKAHEAD_MINUTES = 24 * 60;

export async function scanAndSendReminders(now = new Date()) {
  const windowEnd = new Date(
    now.getTime() + MAX_LOOKAHEAD_MINUTES * 60 * 1000,
  );

  const candidates = (await prisma.event.findMany({
    where: {
      reminderMinutes: { gt: 0 },
      reminderSentAt: null,
      startAt: { gte: new Date(now.getTime() - 5 * 60 * 1000), lte: windowEnd },
    },
    include: eventDefaultInclude,
    orderBy: { startAt: "asc" },
    take: 200,
  })) as ReminderCandidate[];

  if (candidates.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;
  for (const event of candidates) {
    const startInMs = event.startAt.getTime() - now.getTime();
    const reminderWindow = event.reminderMinutes * 60 * 1000;
    if (startInMs < 0 || startInMs > reminderWindow) {
      continue;
    }

    const recipients = gatherRecipients(event);
    if (recipients.length === 0) {
      await prisma.event.update({
        where: { id: event.id },
        data: { reminderSentAt: now },
      });
      continue;
    }

    try {
      await sendReminderEmail(event, recipients, now);
      await prisma.event.update({
        where: { id: event.id },
        data: { reminderSentAt: now },
      });
      sent += 1;
    } catch (error) {
      console.error("Failed to send reminder email", {
        eventId: event.id,
        error,
      });
    }
  }

  if (sent > 0) {
    console.info(`[reminder] Dispatched ${sent} reminder(s)`);
    incrementMetric("event_reminders_sent", sent);
  }

  return { processed: candidates.length, sent };
}

function gatherRecipients(event: ReminderCandidate): string[] {
  const emails = new Set<string>();
  if (event.organizer?.email) {
    emails.add(event.organizer.email);
  }

  if (Array.isArray(event.attendees)) {
    for (const attendee of event.attendees as unknown as Array<{
      email?: string;
    }>) {
      if (attendee?.email) {
        emails.add(attendee.email);
      }
    }
  }

  return Array.from(emails);
}

async function sendReminderEmail(
  event: ReminderCandidate,
  recipients: string[],
  now: Date,
) {
  const transporter = getMailer();
  const startFormatted = format(event.startAt, "yyyy-MM-dd HH:mm");
  const endFormatted = format(event.endAt, "yyyy-MM-dd HH:mm");

  const subject = `[Legal CRM] Hatırlatma: ${event.title}`;
  const lines = [
    "Merhaba,",
    "",
    `Etkinlik hatırlatıcısı: ${event.title}`,
    `Başlangıç: ${startFormatted}`,
    `Bitiş: ${endFormatted}`,
  ];

  if (event.location) {
    lines.push(`Konum: ${event.location}`);
  }

  if (event.matterId && event.matter?.title) {
    lines.push(`İlişkili dava: ${event.matter.title}`);
  }

  lines.push(
    "",
    `Bu hatırlatma, etkinliğe ${event.reminderMinutes} dakika kala gönderildi.`,
    `Bildirim zamanı: ${format(now, "yyyy-MM-dd HH:mm")}`,
    "",
    "Legal CRM",
  );

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "Legal CRM <no-reply@legalcrm.local>",
    to: recipients,
    subject,
    text: lines.join("\n"),
  });
}
