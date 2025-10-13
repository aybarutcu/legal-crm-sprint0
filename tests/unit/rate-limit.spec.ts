import { describe, expect, it, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rate limit helper", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  it("allows initial requests within limit", () => {
    const result = checkRateLimit("ip", 2, 60_000);
    expect(result.success).toBe(true);
    const second = checkRateLimit("ip", 2, 60_000);
    expect(second.success).toBe(true);
  });

  it("blocks when limit exceeded and provides retry-after", () => {
    checkRateLimit("ip", 1, 60_000);
    const blocked = checkRateLimit("ip", 1, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window elapses", () => {
    checkRateLimit("ip", 1, 60_000);
    vi.advanceTimersByTime(60_000);
    const after = checkRateLimit("ip", 1, 60_000);
    expect(after.success).toBe(true);
  });
});
