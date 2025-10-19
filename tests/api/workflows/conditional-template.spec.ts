/**
 * P0.1 Conditional Workflow Logic - API Integration Tests
 * 
 * Tests template creation/update APIs with conditional fields
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Conditional Workflow Template API", () => {
  let testTemplateId: string;

  beforeAll(async () => {
    // Get auth token (assuming you have a test user)
    const lawyer = await prisma.user.findFirst({
      where: { role: "LAWYER" },
    });

    if (!lawyer) {
      throw new Error("No lawyer user found for testing");
    }

    // In a real scenario, you'd generate a proper auth token
    // For now, we'll assume the API uses session-based auth
  });

  afterAll(async () => {
    // Cleanup test template
    if (testTemplateId) {
      await prisma.workflowTemplate
        .delete({ where: { id: testTemplateId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("should create template with simple conditional step", async () => {
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `API Test Conditional ${Date.now()}`,
        description: "Template with conditional logic",
        steps: [
          {
            order: 1,
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
            order: 2,
            title: "Corporate Only",
            actionType: "REQUEST_DOC_CLIENT",
            roleScope: "CLIENT",
            required: false,
            conditionType: "IF_TRUE",
            conditionConfig: {
              field: "contactType",
              operator: "==",
              value: "CORPORATE",
            },
            actionConfig: {
              requestText: "Corporate documents needed",
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(201);

    const template = await response.json();
    testTemplateId = template.id;

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
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `API Compound Test ${Date.now()}`,
        description: "Template with compound condition",
        steps: [
          {
            order: 1,
            title: "Payment Step",
            actionType: "PAYMENT_CLIENT",
            roleScope: "CLIENT",
            required: true,
            conditionType: "IF_TRUE",
            conditionConfig: {
              operator: "AND",
              conditions: [
                { field: "approvalDecision", operator: "==", value: "APPROVED" },
                { field: "documentCount", operator: ">=", value: 3 },
              ],
            },
            actionConfig: {
              amount: 1000,
              currency: "USD",
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(201);

    const template = await response.json();
    expect(template.steps[0].conditionConfig).toMatchObject({
      operator: "AND",
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

  it("should create template with branching (nextStepOnTrue)", async () => {
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `API Branching Test ${Date.now()}`,
        description: "Template with branching logic",
        steps: [
          {
            order: 1,
            title: "Check Pre-Approval",
            actionType: "WRITE_TEXT",
            roleScope: "ADMIN",
            required: true,
            conditionType: "IF_TRUE",
            conditionConfig: {
              field: "isPreApproved",
              operator: "==",
              value: true,
            },
            nextStepOnTrue: 3, // Skip to step 3 if pre-approved
            nextStepOnFalse: null, // Go to next step
            actionConfig: {
              title: "Pre-approval check",
            },
          },
          {
            order: 2,
            title: "Manual Approval",
            actionType: "APPROVAL_LAWYER",
            roleScope: "LAWYER",
            required: true,
            conditionType: "ALWAYS",
            actionConfig: {
              message: "Manual review",
            },
          },
          {
            order: 3,
            title: "Payment",
            actionType: "PAYMENT_CLIENT",
            roleScope: "CLIENT",
            required: true,
            conditionType: "ALWAYS",
            actionConfig: {
              amount: 500,
              currency: "USD",
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(201);

    const template = await response.json();
    expect(template.steps[0].nextStepOnTrue).toBe(3);
    expect(template.steps[0].nextStepOnFalse).toBeNull();

    // Cleanup
    await prisma.workflowTemplate
      .delete({ where: { id: template.id } })
      .catch(() => {});
  });

  it("should update template to add conditional logic", async () => {
    // First create a simple template
    const createResponse = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `API Update Test ${Date.now()}`,
        description: "Template to be updated",
        steps: [
          {
            order: 1,
            title: "Step 1",
            actionType: "WRITE_TEXT",
            roleScope: "ADMIN",
            required: true,
            conditionType: "ALWAYS",
            actionConfig: { title: "Step 1" },
          },
        ],
      }),
    });

    const template = await createResponse.json();

    // Update to add conditional logic
    const updateResponse = await fetch(
      `${BASE_URL}/api/workflows/templates/${template.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: template.name,
          description: "Updated with conditional logic",
          steps: [
            {
              order: 1,
              title: "Step 1",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "IF_TRUE",
              conditionConfig: {
                field: "status",
                operator: "==",
                value: "APPROVED",
              },
              actionConfig: { title: "Step 1" },
            },
          ],
        }),
      }
    );

    expect(updateResponse.status).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.description).toBe("Updated with conditional logic");
    expect(updated.steps[0].conditionType).toBe("IF_TRUE");

    // Cleanup
    await prisma.workflowTemplate
      .delete({ where: { id: template.id } })
      .catch(() => {});
  });

  it("should reject invalid condition operator", async () => {
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Invalid Operator Test ${Date.now()}`,
        description: "Should fail validation",
        steps: [
          {
            order: 1,
            title: "Invalid Step",
            actionType: "WRITE_TEXT",
            roleScope: "ADMIN",
            required: true,
            conditionType: "IF_TRUE",
            conditionConfig: {
              field: "status",
              operator: "INVALID_OP", // Invalid operator
              value: "test",
            },
            actionConfig: { title: "Test" },
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it("should reject IF_TRUE without conditionConfig", async () => {
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Missing Config Test ${Date.now()}`,
        description: "Should fail validation",
        steps: [
          {
            order: 1,
            title: "Missing Config",
            actionType: "WRITE_TEXT",
            roleScope: "ADMIN",
            required: true,
            conditionType: "IF_TRUE",
            // Missing conditionConfig
            actionConfig: { title: "Test" },
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });

  it("should reject compound condition with < 2 sub-conditions", async () => {
    const response = await fetch(`${BASE_URL}/api/workflows/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Invalid Compound Test ${Date.now()}`,
        description: "Should fail validation",
        steps: [
          {
            order: 1,
            title: "Invalid Compound",
            actionType: "WRITE_TEXT",
            roleScope: "ADMIN",
            required: true,
            conditionType: "IF_TRUE",
            conditionConfig: {
              operator: "AND",
              conditions: [
                { field: "status", operator: "==", value: "ACTIVE" },
                // Only 1 condition (need minimum 2)
              ],
            },
            actionConfig: { title: "Test" },
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
  });
});
