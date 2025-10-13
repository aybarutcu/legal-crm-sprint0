import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthSession = vi.fn();
const checkRateLimit = vi.fn(() => ({ success: true, retryAfter: 60, remaining: 59 }));
const prismaMock = {
  matter: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMIT_DEFAULT: { limit: 60, windowMs: 60_000 },
}));

const mattersRoutePromise = import("../../app/api/matters/route");
const matterIdRoutePromise = import("../../app/api/matters/[id]/route");

function nextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init);
  return new NextRequest(request);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T09:00:00Z"));
  getAuthSession.mockReset();
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ success: true, retryAfter: 60, remaining: 59 });
  prismaMock.matter.create.mockReset();
  prismaMock.matter.findMany.mockReset();
  prismaMock.matter.findUnique.mockReset();
  prismaMock.matter.update.mockReset();
  prismaMock.matter.delete.mockReset();
  prismaMock.matter.count.mockReset();
});

describe("Matter CRUD flow", () => {
  it("create -> fetch -> update -> delete -> 404", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "user-1", role: "LAWYER" } });

    prismaMock.matter.create.mockResolvedValueOnce({
      id: "matter-1",
      title: "Dava",
      type: "CIVIL",
      status: "OPEN",
      jurisdiction: null,
      court: null,
      openedAt: new Date("2025-01-01T09:00:00Z"),
      nextHearingAt: null,
      ownerId: "user-1",
      client: { id: "client-1", firstName: "Jane", lastName: "Doe" },
    });

    const { POST } = await mattersRoutePromise;
    const context = { params: undefined } as Parameters<typeof POST>[1];
    const createResponse = await POST(
      nextRequest("http://localhost/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Dava", type: "CIVIL", clientId: "client-1" }),
      }),
      context,
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.id).toBe("matter-1");

    prismaMock.matter.findUnique.mockResolvedValueOnce({
      id: "matter-1",
      title: "Dava",
      type: "CIVIL",
      status: "OPEN",
      jurisdiction: null,
      court: null,
      openedAt: new Date("2025-01-01T09:00:00Z"),
      nextHearingAt: null,
      client: { id: "client-1", firstName: "Jane", lastName: "Doe", email: null },
      owner: { id: "user-1", name: "Lawyer", email: "lawyer@example.com" },
      parties: [],
    });

    const { GET } = await matterIdRoutePromise;
    const fetchResponse = await GET(nextRequest("http://localhost/api/matters/matter-1"), {
      params: { id: "matter-1" },
      session: { user: { id: "user-1", role: "LAWYER" } },
    });
    expect(fetchResponse.status).toBe(200);

    prismaMock.matter.findUnique.mockResolvedValueOnce({
      id: "matter-1",
      ownerId: "user-1",
    });
    prismaMock.matter.update.mockResolvedValueOnce({
      id: "matter-1",
      title: "Dava",
      type: "CIVIL",
      status: "IN_PROGRESS",
      jurisdiction: null,
      court: null,
      openedAt: new Date("2025-01-01T09:00:00Z"),
      nextHearingAt: null,
    });

    const updateResponse = await (await matterIdRoutePromise).PATCH(
      nextRequest("http://localhost/api/matters/matter-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      }),
      {
        params: { id: "matter-1" },
        session: { user: { id: "user-1", role: "LAWYER" } },
      },
    );
    expect(updateResponse.status).toBe(200);

    prismaMock.matter.findUnique.mockResolvedValueOnce({
      id: "matter-1",
      ownerId: "user-1",
    });

    const deleteResponse = await (await matterIdRoutePromise).DELETE(
      nextRequest("http://localhost/api/matters/matter-1", { method: "DELETE" }),
      {
        params: { id: "matter-1" },
        session: { user: { id: "user-1", role: "LAWYER" } },
      },
    );
    expect(deleteResponse.status).toBe(204);

    prismaMock.matter.findUnique.mockResolvedValueOnce(null);
    const notFoundResponse = await GET(nextRequest("http://localhost/api/matters/matter-1"), {
      params: { id: "matter-1" },
      session: { user: { id: "user-1", role: "LAWYER" } },
    });
    expect(notFoundResponse.status).toBe(404);
  });
});
