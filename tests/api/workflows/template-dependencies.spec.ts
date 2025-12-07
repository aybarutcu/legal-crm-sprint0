import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/workflows/templates/route";
import { ActionType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock auth with ADMIN role
vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(() =>
    Promise.resolve({
      user: { id: "admin-1", email: "admin@test.com", role: Role.ADMIN },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  ),
}));

describe("POST /api/workflows/templates with dependencies", () => {
  let adminUser: { id: string };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create admin user for foreign key constraint
    adminUser = await prisma.user.upsert({
      where: { email: "admin@test.com" },
      create: {
        email: "admin@test.com",
        name: "Test Admin",
        role: Role.ADMIN,
      },
      update: {},
    });
    
    // Update mock to use real user ID
    vi.mocked((await import("@/lib/auth")).getAuthSession).mockResolvedValue({
      user: { id: adminUser.id, email: "admin@test.com", role: Role.ADMIN },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });
    
    // Clean up any existing templates
    await prisma.workflowTemplate.deleteMany({
      where: { name: { startsWith: "Dependency Test" } },
    });
  });

  it("should create template with sequential dependencies (implicit)", async () => {
    const payload = {
      name: "Dependency Test - Sequential",
      description: "Template with sequential steps (no explicit dependencies)",
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

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe(payload.name);
    expect(data.steps).toHaveLength(2);
    
    // Check that dependency fields have defaults
    expect(data.steps[0].dependsOn).toEqual([]);
    expect(data.steps[0].dependencyLogic).toBe("ALL");
    expect(data.steps[1].dependsOn).toEqual([]);
    expect(data.steps[1].dependencyLogic).toBe("ALL");
  });

  it("should create template with parallel dependencies", async () => {
    const payload = {
      name: "Dependency Test - Parallel",
      description: "Template with parallel execution",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Parent Task",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
          dependencyLogic: "ALL",
        },
        {
          id: "step-1",
          order: 1,
          title: "Branch 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0"], // Depends on step 0
          dependencyLogic: "ALL",
        },
        {
          id: "step-2",
          order: 2,
          title: "Branch 2",
          actionType: ActionType.REQUEST_DOC,
          roleScope: Role.CLIENT,
          dependsOn: ["step-0"], // Also depends on step 0 (parallel with step 1)
          dependencyLogic: "ALL",
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.steps).toHaveLength(3);
    
    // Verify parallel dependencies
    expect(data.steps[1].dependsOn).toEqual(["step-0"]);
    expect(data.steps[2].dependsOn).toEqual(["step-0"]);
    
    // Both steps 1 and 2 can execute in parallel after step 0 completes
  });

  it("should create template with fork-join pattern", async () => {
    const payload = {
      name: "Dependency Test - Fork-Join",
      description: "Template with fork-join pattern",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Start",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          id: "step-1",
          order: 1,
          title: "Fork Branch 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0"],
        },
        {
          id: "step-2",
          order: 2,
          title: "Fork Branch 2",
          actionType: ActionType.REQUEST_DOC,
          roleScope: Role.CLIENT,
          dependsOn: ["step-0"],
        },
        {
          id: "step-3",
          order: 3,
          title: "Join Point",
          actionType: ActionType.APPROVAL,
          roleScope: Role.LAWYER,
          dependsOn: ["step-1", "step-2"], // Waits for both branches
          dependencyLogic: "ALL",
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.steps).toHaveLength(4);
    
    // Verify fork-join structure
    expect(data.steps[0].dependsOn).toEqual([]);
    expect(data.steps[1].dependsOn).toEqual(["step-0"]);
    expect(data.steps[2].dependsOn).toEqual(["step-0"]);
    expect(data.steps[3].dependsOn).toEqual(["step-1", "step-2"]); // Join point
    expect(data.steps[3].dependencyLogic).toBe("ALL");
  });

  it("should create template with ANY dependency logic", async () => {
    const payload = {
      name: "Dependency Test - ANY Logic",
      description: "Template with ANY dependency logic (first-wins)",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Option 1",
          actionType: ActionType.REQUEST_DOC,
          roleScope: Role.CLIENT,
          dependsOn: [],
        },
        {
          id: "step-1",
          order: 1,
          title: "Option 2",
          actionType: ActionType.SIGNATURE,
          roleScope: Role.CLIENT,
          dependsOn: [],
        },
        {
          id: "step-2",
          order: 2,
          title: "Proceed when ANY complete",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0", "step-1"], // Waits for ANY of the two options
          dependencyLogic: "ANY",
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.steps).toHaveLength(3);
    
    // Verify ANY logic
    expect(data.steps[2].dependsOn).toEqual(["step-0", "step-1"]);
    expect(data.steps[2].dependencyLogic).toBe("ANY");
  });

  it("should reject template with duplicate dependsOn values", async () => {
    const payload = {
      name: "Dependency Test - Invalid Duplicates",
      description: "Template with duplicate dependencies",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          id: "step-1",
          order: 1,
          title: "Step 2",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0", "step-0"], // Duplicate!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(422); // Validation error
  });

  it("should reject template with invalid dependency references", async () => {
    const payload = {
      name: "Dependency Test - Invalid Reference",
      description: "Template with invalid dependency order",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: [],
        },
        {
          id: "step-1",
          order: 1,
          title: "Step 2",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0", "step-5"], // Step 5 doesn't exist!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(422); // Validation error
  });

  it("should reject template with self-dependency", async () => {
    const payload = {
      name: "Dependency Test - Self Dependency",
      description: "Template with step depending on itself",
      steps: [
        {
          id: "step-0",
          order: 0,
          title: "Step 1",
          actionType: ActionType.TASK,
          roleScope: Role.LAWYER,
          dependsOn: ["step-0"], // Depends on itself!
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(422); // Validation error
  });
});
