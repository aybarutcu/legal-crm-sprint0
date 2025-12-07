import { scanAndSendReminders } from "@/lib/events/reminder-service";

const globalWorkers = globalThis as unknown as {
  __legalCrmReminderWorker?: NodeJS.Timeout;
};

const DEFAULT_INTERVAL_SECONDS = Number.parseInt(
  process.env.CALENDAR_SYNC_POLL_INTERVAL_SEC ?? "60",
  10,
);

const INTERVAL_MS = Math.max(DEFAULT_INTERVAL_SECONDS, 30) * 1000;

async function runReminderJob() {
  try {
    await scanAndSendReminders();
  } catch (error) {
    console.error("[reminder] job failed", error);
  }
}

export function ensureReminderWorker() {
  if (process.env.NODE_ENV === "test") return;
  // Don't start workers during build time
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (typeof window !== "undefined") return; // Don't run in browser
  if (globalWorkers.__legalCrmReminderWorker) return;

  void runReminderJob();
  globalWorkers.__legalCrmReminderWorker = setInterval(
    () => {
      void runReminderJob();
    },
    INTERVAL_MS,
  );
}

ensureReminderWorker();
