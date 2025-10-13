import { afterEach, describe, expect, it, vi } from "vitest";
import { scanAndSendTaskReminders } from "@/lib/tasks/reminder-service";
import { getMetric, resetMetrics } from "@/lib/metrics";

const prismaMocks = vi.hoisted(() => {
  const taskFindMany = vi.fn();
  const taskUpdate = vi.fn();
  return { taskFindMany, taskUpdate };
});

const mailerMock = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({});
  return { sendMail };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: prismaMocks.taskFindMany,
      update: prismaMocks.taskUpdate,
    },
  },
}));

vi.mock("@/lib/mail/transporter", () => ({
  getMailer: () => mailerMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  resetMetrics();
});

describe("scanAndSendTaskReminders", () => {
  it("sends reminders for tasks due soon", async () => {
    const now = new Date("2024-10-10T09:00:00.000Z");
    prismaMocks.taskFindMany.mockResolvedValueOnce([
      {
        id: "task-1",
        title: "Dosya incele",
        description: "Görev açıklaması",
        priority: "HIGH",
        dueAt: new Date("2024-10-10T09:30:00.000Z"),
        reminderNotified: false,
        assignee: { id: "user-1", email: "lawyer@example.com", name: "Lawyer" },
        matter: {
          id: "matter-1",
          title: "Doe vs Corp",
          owner: { email: "owner@example.com" },
        },
      },
    ]);
    prismaMocks.taskUpdate.mockResolvedValue({});

    const result = await scanAndSendTaskReminders(now);

    expect(mailerMock.sendMail).toHaveBeenCalledTimes(1);
    expect(prismaMocks.taskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        reminderNotified: true,
        reminderNotifiedAt: now,
      },
    });
    expect(result.sent).toBe(1);
    expect(getMetric("task_reminders_sent")).toBe(1);
  });

  it("skips tasks without recipients", async () => {
    const now = new Date();
    prismaMocks.taskFindMany.mockResolvedValueOnce([
      {
        id: "task-2",
        title: "Görev",
        description: null,
        priority: "MEDIUM",
        dueAt: new Date(now.getTime() + 10 * 60 * 1000),
        reminderNotified: false,
        assignee: { id: "user-2", email: null, name: "No Email" },
        matter: {
          id: "matter-2",
          title: "",
          owner: { email: null },
        },
      },
    ]);
    prismaMocks.taskUpdate.mockResolvedValue({});

    const result = await scanAndSendTaskReminders(now);

    expect(mailerMock.sendMail).not.toHaveBeenCalled();
    expect(prismaMocks.taskUpdate).toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(getMetric("task_reminders_sent")).toBe(0);
  });
});
