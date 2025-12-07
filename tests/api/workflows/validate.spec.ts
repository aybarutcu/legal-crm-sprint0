import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/workflows/validate/route";
import { ActionType, Role } from "@prisma/client";
import { NextRequest } from "next/server";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-1", email: "admin@test.com", role: Role.ADMIN },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  ),
}));

describe("POST /api/workflows/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate workflow with no dependencies (sequential)", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
        },
        {
          order: 1,
          title: "Step 2",
          actionType: ActionType.APPROVAL,
          roleScope: Role.LAWYER,
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.message).toContain("valid");
  });

  it("should validate workflow with parallel dependencies", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Parent Task",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          order: 1,
          title: "Branch 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0], // Both depend on step 0
        },
        {
          order: 2,
          title: "Branch 2",
          actionType: ActionType.TASK,
          roleScope: Role.PARALEGAL,
          dependsOn: [0], // Can execute in parallel with step 1
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it("should validate workflow with fork-join pattern", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Start",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          order: 1,
          title: "Fork Branch 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0],
        },
        {
          order: 2,
          title: "Fork Branch 2",
          actionType: ActionType.TASK,
          roleScope: Role.PARALEGAL,
          dependsOn: [0],
        },
        {
          order: 3,
          title: "Join Point",
          actionType: ActionType.APPROVAL,
          roleScope: Role.LAWYER,
          dependsOn: [1, 2], // Waits for both branches
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it("should reject workflow with circular dependency (2-cycle)", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [1], // Depends on step 1
        },
        {
          order: 1,
          title: "Step 2",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0], // Depends on step 0 → circular!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.valid).toBe(false);
    expect(data.errors).toBeDefined();
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors[0]).toContain("Circular dependency");
  });

  it("should reject workflow with circular dependency (3-cycle)", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [2], // → step 2
        },
        {
          order: 1,
          title: "Step 2",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0], // → step 0
        },
        {
          order: 2,
          title: "Step 3",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [1], // → step 1 → circular!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.valid).toBe(false);
    expect(data.errors[0]).toContain("Circular dependency");
  });

  it("should reject workflow with invalid dependency reference", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          order: 1,
          title: "Step 2",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0, 5], // Step 5 doesn't exist!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.valid).toBe(false);
    expect(data.errors[0]).toContain("invalid dependencies");
  });

  it("should reject workflow with self-dependency", async () => {
    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [0], // Depends on itself!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.valid).toBe(false);
    expect(data.errors[0]).toContain("Circular dependency");
  });

  it("should require authentication", async () => {
    // Mock no session
    vi.mocked((await import("@/lib/auth")).getAuthSession).mockResolvedValueOnce(null);

    const payload = {
      steps: [
        {
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
  });
});
