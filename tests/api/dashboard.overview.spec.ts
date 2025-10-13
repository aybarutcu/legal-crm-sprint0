import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getAuthSession = vi.fn();
const checkRateLimit = vi.fn(() => ({ success: true, retryAfter: 60, remaining: 59 }));
const prismaMock = {
  event: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  matter: { count: vi.fn() },
};

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addDays: (date: Date, amount: number) => new Date(date.getTime() + amount * 24 * 60 * 60 * 1000),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMIT_DEFAULT: { limit: 60, windowMs: 60_000 },
}));

const routeModulePromise = import("../../app/api/dashboard/overview/route");

beforeEach(() => {
  getAuthSession.mockReset();
  prismaMock.event.findMany.mockReset();
  prismaMock.task.findMany.mockReset();
  prismaMock.document.findMany.mockReset();
  prismaMock.matter.count.mockReset();
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ success: true, retryAfter: 60, remaining: 59 });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/dashboard/overview", () => {
  it("returns 401 if user is not authenticated", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("http://localhost/api/dashboard/overview"));
    expect(response.status).toBe(401);
  });

  it("returns aggregated overview for the current user", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1", role: "LAWYER" } });

    prismaMock.event.findMany.mockResolvedValueOnce([
      { id: "event-1", title: "Toplantı", startAt: new Date().toISOString(), location: "Ofis" },
    ]);
    prismaMock.task.findMany.mockResolvedValueOnce([
      { id: "task-1", title: "Hazırlık", dueAt: new Date().toISOString(), priority: "HIGH" },
    ]);
    prismaMock.document.findMany.mockResolvedValueOnce([
      {
        id: "doc-1",
        filename: "dokuman.pdf",
        createdAt: new Date().toISOString(),
        matter: { id: "matter-1", title: "Dosya" },
      },
    ]);
    prismaMock.matter.count
      .mockResolvedValueOnce(3) // open matters
      .mockResolvedValueOnce(5); // open + in progress

    const response = await GET(new NextRequest("http://localhost/api/dashboard/overview"));
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.openMatters).toBe(3);
    expect(json.mattersOpenCount).toBe(5);
    expect(json.events).toHaveLength(1);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizerId: "user-1" }) }),
    );
  });

  it("allows admin to request another owner", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });

    prismaMock.event.findMany.mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValueOnce([]);
    prismaMock.document.findMany.mockResolvedValueOnce([]);
    prismaMock.matter.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await GET(new NextRequest("http://localhost/api/dashboard/overview?ownerId=user-2"));

    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizerId: "user-2" }) }),
    );
  });

  it("returns 429 when rate limited", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1", role: "LAWYER" } });
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 15, remaining: 0 });

    const response = await GET(new NextRequest("http://localhost/api/dashboard/overview"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("15");
  });
});
