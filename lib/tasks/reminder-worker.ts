import { scanAndSendTaskReminders } from "@/lib/tasks/reminder-service";

const globalWorkers = globalThis as unknown as {
  __legalCrmTaskReminderWorker?: ReturnType<typeof setInterval>;
};

const DEFAULT_INTERVAL_SECONDS = 60;
const INTERVAL_MS = Math.max(
  Number.parseInt(process.env.TASK_REMINDER_INTERVAL_SECONDS ?? "60", 10),
  DEFAULT_INTERVAL_SECONDS,
) * 1000;

async function runTaskReminderJob() {
  try {
    await scanAndSendTaskReminders();
  } catch (error) {
    console.error("[task-reminder] job failed", error);
  }
}

export function ensureTaskReminderWorker() {
  if (process.env.NODE_ENV === "test") return;
  // Don't start workers during build time
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (typeof window !== "undefined") return; // Don't run in browser
  if (globalWorkers.__legalCrmTaskReminderWorker) return;

  void runTaskReminderJob();
  globalWorkers.__legalCrmTaskReminderWorker = setInterval(() => {
    void runTaskReminderJob();
  }, INTERVAL_MS);
}

ensureTaskReminderWorker();
