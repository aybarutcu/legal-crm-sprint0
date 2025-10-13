import { describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";
import { NextRequest } from "next/server";

const getAuthSession = vi.fn();
const checkRateLimit = vi.fn(() => ({ success: true, retryAfter: 60, remaining: 59 }));
const prismaMock = {
  document: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMIT_DEFAULT: { limit: 60, windowMs: 60_000 },
}));

const documentsRoutePromise = import("../../app/api/documents/route");

function nextRequest(url: string) {
  return new NextRequest(new Request(url));
}

describe("Documents API performance", () => {
  it("responds under 500ms P95 locally", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);

    const { GET } = await documentsRoutePromise;

    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const start = performance.now();
      await GET(nextRequest("http://localhost/api/documents?page=1&pageSize=20"), {
        params: undefined,
      });
      durations.push(performance.now() - start);
    }

    durations.sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
    const p95 = durations[p95Index];

    expect(p95).toBeLessThan(500);
  });
});
