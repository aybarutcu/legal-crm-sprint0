import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthSession = vi.fn();
const recordAuditLog = vi.fn();
const checkRateLimit = vi.fn(() => ({ success: true, retryAfter: 60, remaining: 59 }));

const prismaMock = {
  contact: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMIT_DEFAULT: { limit: 60, windowMs: 60_000 },
}));

const routeModulePromise = import("../../app/api/contacts/route");

function nextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init);
  return new NextRequest(request);
}

beforeEach(() => {
  getAuthSession.mockReset();
  recordAuditLog.mockReset();
  prismaMock.contact.findMany.mockReset();
  prismaMock.contact.count.mockReset();
  prismaMock.contact.create.mockReset();
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ success: true, retryAfter: 60, remaining: 59 });
});

describe("/api/contacts GET", () => {
  it("returns 401 when session missing", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce(null);

    const response = await GET(nextRequest("http://localhost/api/contacts"));
    expect(response.status).toBe(401);
  });

  it("returns paginated list", async () => {
    const { GET } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    prismaMock.contact.findMany.mockResolvedValueOnce([
      { id: "c1", firstName: "Jane", lastName: "Doe", email: "" },
    ]);
    prismaMock.contact.count.mockResolvedValueOnce(1);

    const response = await GET(
      nextRequest("http://localhost/api/contacts?page=1&pageSize=50"),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.pagination.total).toBe(1);
  });
});

describe("/api/contacts POST", () => {
  it("returns 401 when session missing", async () => {
    const { POST } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce(null);

    const response = await POST(
      nextRequest("http://localhost/api/contacts", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 for invalid payload", async () => {
    const { POST } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const response = await POST(
      nextRequest("http://localhost/api/contacts", {
        method: "POST",
        body: JSON.stringify({ lastName: "Doe" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(422);
  });

  it("creates a contact with default owner", async () => {
    const { POST } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    prismaMock.contact.create.mockResolvedValueOnce({
      id: "c1",
      firstName: "Jane",
      lastName: "Doe",
      ownerId: "user-1",
      tags: [],
    });

    const response = await POST(
      nextRequest("http://localhost/api/contacts", {
        method: "POST",
        body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: "user-1" }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "contact.create",
      }),
    );
  });

  it("returns 429 when rate limit exceeded", async () => {
    const { POST } = await routeModulePromise;
    getAuthSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 10, remaining: 0 });

    const response = await POST(
      nextRequest("http://localhost/api/contacts", {
        method: "POST",
        body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
  });
});
