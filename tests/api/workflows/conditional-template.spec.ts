import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/workflows/templates/route";
import { Role } from "@prisma/client";
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

describe("Conditional Workflow Template API", () => {
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
      where: { name: { startsWith: "API Test" } },
    });
  });

  it("should create template with simple conditional step", async () => {
    const payload = {
      name: `API Test Conditional ${Date.now()}`,
      description: "Template with conditional logic",
      steps: [
        {
          title: "Always Execute",
          actionType: "WRITE_TEXT",
          roleScope: "ADMIN",
          required: true,
          conditionType: "ALWAYS",
          actionConfig: {
            title: "Basic Info",
          },
        },
        {
          title: "Corporate Only",
          actionType: "REQUEST_DOC",
          roleScope: "CLIENT",
          required: false,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "contactType",
            operator: "==",
            value: "CORPORATE",
          },
          actionConfig: {
            requestText: "Corporate documents needed",
          },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(201);

    const template = await response.json();

    expect(template.name).toContain("API Test Conditional");
    expect(template.steps).toHaveLength(2);
    expect(template.steps[1].conditionType).toBe("IF_TRUE");
    expect(template.steps[1].conditionConfig).toMatchObject({
      field: "contactType",
      operator: "==",
      value: "CORPORATE",
    });
  });

  it("should create template with compound AND condition", async () => {
    const payload = {
      name: `API Compound Test ${Date.now()}`,
      description: "Template with compound condition",
      steps: [
        {
          title: "Payment Step",
          actionType: "PAYMENT",
          roleScope: "CLIENT",
          required: true,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "compound",
            logic: "AND",
            conditions: [
              {
                type: "simple",
                field: "approvalDecision",
                operator: "==",
                value: "APPROVED",
              },
              {
                type: "simple",
                field: "documentCount",
                operator: ">=",
                value: 3,
              },
            ],
          },
          actionConfig: {
            amount: 1000,
            currency: "USD",
          },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(201);

    const template = await response.json();
    expect(template.steps[0].conditionConfig).toMatchObject({
      type: "compound",
      logic: "AND",
      conditions: expect.arrayContaining([
        expect.objectContaining({ field: "approvalDecision" }),
        expect.objectContaining({ field: "documentCount" }),
      ]),
    });

    // Cleanup
    await prisma.workflowTemplate
      .delete({ where: { id: template.id } })
      .catch(() => {});
  });

  it("should create template with branching", async () => {
    const payload = {
      name: `API Branching Test ${Date.now()}`,
      description: "Template with branching logic",
      steps: [
        {
          title: "Check Pre-Approval",
          actionType: "WRITE_TEXT",
          roleScope: "ADMIN",
          required: true,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "isPreApproved",
            operator: "==",
            value: true,
          },
          branches: [
            {
              label: "Approved",
              targetStepId: "step-3",
            },
            {
              label: "Not Approved",
              targetStepId: "step-2",
            },
          ],
          actionConfig: {
            title: "Pre-approval check",
          },
        },
        {
          title: "Manual Approval",
          actionType: "APPROVAL",
          roleScope: "LAWYER",
          required: true,
          conditionType: "ALWAYS",
          actionConfig: {
            message: "Manual review",
          },
        },
        {
          title: "Payment",
          actionType: "PAYMENT",
          roleScope: "CLIENT",
          required: true,
          conditionType: "ALWAYS",
          actionConfig: {
            amount: 500,
            currency: "USD",
          },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(201);

    const template = await response.json();
    expect(template.steps[0].branches).toHaveLength(2);
    expect(template.steps[0].branches[0].label).toBe("Approved");
    expect(template.steps[0].branches[0].targetStepId).toBe("step-3");
    expect(template.steps[0].branches[1].label).toBe("Not Approved");
    expect(template.steps[0].branches[1].targetStepId).toBe("step-2");

    // Cleanup
    await prisma.workflowTemplate
      .delete({ where: { id: template.id } })
      .catch(() => {});
  });

  it("should reject invalid condition operator", async () => {
    const payload = {
      name: `Invalid Operator Test ${Date.now()}`,
      description: "Should fail validation",
      steps: [
        {
          title: "Invalid Step",
          actionType: "WRITE_TEXT",
          roleScope: "ADMIN",
          required: true,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "status",
            operator: "INVALID_OP", // Invalid operator
            value: "test",
          },
          actionConfig: { title: "Test" },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(422);
  });

  it("should reject IF_TRUE without conditionConfig", async () => {
    const payload = {
      name: `Missing Config Test ${Date.now()}`,
      description: "Should fail validation",
      steps: [
        {
          title: "Missing Config",
          actionType: "WRITE_TEXT",
          roleScope: "ADMIN",
          required: true,
          conditionType: "IF_TRUE",
          // Missing conditionConfig
          actionConfig: { title: "Test" },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(422);
  });

  it("should reject compound condition with < 2 sub-conditions", async () => {
    const payload = {
      name: `Invalid Compound Test ${Date.now()}`,
      description: "Should fail validation",
      steps: [
        {
          title: "Invalid Compound",
          actionType: "WRITE_TEXT",
          roleScope: "ADMIN",
          required: true,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "compound",
            logic: "AND",
            conditions: [
              {
                type: "simple",
                field: "status",
                operator: "==",
                value: "ACTIVE",
              },
              // Only one condition, should fail
            ],
          },
          actionConfig: { title: "Test" },
        },
      ],
    };

    const request = new NextRequest("http://localhost:3000/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(422);
  });
});
