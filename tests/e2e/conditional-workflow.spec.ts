/**
 * P0.1 Conditional Workflow Logic - E2E Tests
 * 
 * Tests the complete conditional workflow lifecycle:
 * 1. Create template with conditional steps
 * 2. Instantiate and execute workflow
 * 3. Verify branching logic works correctly
 * 4. Verify steps are skipped based on conditions
 * 5. Verify context persistence across steps
 */

import { test, expect } from "@playwright/test";
import { PrismaClient, Prisma } from "@prisma/client";
import { determineNextSteps } from "@/lib/workflows/runtime";

const prisma = new PrismaClient();
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test.describe("Conditional Workflow E2E", () => {
  let testContactId: string;
  let testMatterId: string;
  let lawyerUserId: string;

  test.beforeAll(async () => {
    // Find a lawyer user for testing
    const lawyer = await prisma.user.findFirst({
      where: { role: "LAWYER" },
    });
    
    if (!lawyer) {
      throw new Error("No lawyer user found for testing");
    }
    
    lawyerUserId = lawyer.id;

    // Create test contact
    const contact = await prisma.contact.create({
      data: {
        firstName: "E2E",
        lastName: "Conditional Test",
        email: `e2e-conditional-${Date.now()}@test.local`,
        type: "LEAD",
        source: "REFERRAL",
      },
    });
    testContactId = contact.id;

    // Create test matter
    const matter = await prisma.matter.create({
      data: {
        title: "E2E Conditional Workflow Test",
        matterType: "Civil Litigation",
        status: "ACTIVE",
        ownerId: lawyerUserId,
      },
    });
    testMatterId = matter.id;
  });

  test.afterAll(async () => {
    // Cleanup
    if (testContactId) {
      await prisma.contact.delete({ where: { id: testContactId } }).catch(() => {});
    }
    if (testMatterId) {
      await prisma.matter.delete({ where: { id: testMatterId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("should create template with simple conditional step", async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `E2E Conditional Template ${Date.now()}`,
        description: "Template with simple IF_TRUE condition",
        version: 1,
        isActive: true,
        steps: {
          create: [
            {
              order: 1,
              title: "Collect Info",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: {
                title: "Basic Information",
                description: "Enter contact information",
              },
            },
            {
              order: 2,
              title: "Request Corporate Docs",
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
                requestText: "Please upload corporate documents",
                documentNames: ["Articles of Incorporation", "Operating Agreement"],
              },
            },
            {
              order: 3,
              title: "Final Review",
              actionType: "APPROVAL_LAWYER",
              roleScope: "LAWYER",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: {
                message: "Review all documents",
              },
            },
          ],
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    expect(template.steps).toHaveLength(3);
    expect(template.steps[1].conditionType).toBe("IF_TRUE");
    expect(template.steps[1].conditionConfig).toMatchObject({
      field: "contactType",
      operator: "==",
      value: "CORPORATE",
    });

    // Cleanup
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should skip conditional step when condition is FALSE", async () => {
    // Create template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Conditional Skip Test ${Date.now()}`,
        description: "Tests step skipping based on condition",
        version: 1,
        isActive: true,
        steps: {
          create: [
            {
              order: 1,
              title: "Step 1",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { title: "Step 1" },
            },
            {
              order: 2,
              title: "Corporate Only Step",
              actionType: "TASK",
              roleScope: "ADMIN",
              required: false,
              conditionType: "IF_TRUE",
              conditionConfig: {
                field: "contactType",
                operator: "==",
                value: "CORPORATE",
              },
              actionConfig: { description: "Corporate-specific task" },
            },
            {
              order: 3,
              title: "Step 3",
              actionType: "APPROVAL_LAWYER",
              roleScope: "LAWYER",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { message: "Final approval" },
            },
          ],
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Create instance with LEAD contact (not CORPORATE)
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: testContactId,
        matterId: testMatterId,
        status: "ACTIVE",
        context: {
          contactType: "LEAD", // Not CORPORATE
        },
        steps: {
          create: template.steps.map((step) => ({
            templateStepId: step.id,
            order: step.order,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            conditionType: step.conditionType,
            conditionConfig: step.conditionConfig,
            actionConfig: step.actionConfig,
            actionState: step.order === 1 ? "READY" : "PENDING",
            actionData: {},
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Complete Step 1
    const step1 = instance.steps[0];
    await prisma.workflowInstanceStep.update({
      where: { id: step1.id },
      data: {
        actionState: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Trigger runtime to determine next steps
    const { determineNextSteps } = await import("@/lib/workflows/runtime");
    const nextStepIds = await determineNextSteps(instance.id, step1.id);

    // Should skip step 2 (corporate only) and activate step 3
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    expect(updatedInstance!.steps[1].actionState).toBe("SKIPPED");
    expect(updatedInstance!.steps[2].actionState).toBe("READY");

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should execute conditional step when condition is TRUE", async () => {
    // Create template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Conditional Execute Test ${Date.now()}`,
        description: "Tests step execution based on condition",
        version: 1,
        isActive: true,
        steps: {
          create: [
            {
              order: 1,
              title: "Step 1",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { title: "Step 1" },
            },
            {
              order: 2,
              title: "Corporate Step",
              actionType: "TASK",
              roleScope: "ADMIN",
              required: false,
              conditionType: "IF_TRUE",
              conditionConfig: {
                field: "contactType",
                operator: "==",
                value: "CORPORATE",
              },
              actionConfig: { description: "Corporate task" },
            },
          ],
        },
      },
    });

    // Create instance with CORPORATE contact
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: testContactId,
        matterId: testMatterId,
        status: "ACTIVE",
        context: {
          contactType: "CORPORATE", // Matches condition
        },
        steps: {
          create: template.steps.map((step) => ({
            templateStepId: step.id,
            order: step.order,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            conditionType: step.conditionType,
            conditionConfig: step.conditionConfig,
            actionConfig: step.actionConfig,
            actionState: step.order === 1 ? "READY" : "PENDING",
            actionData: {},
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Complete Step 1
    const step1 = instance.steps[0];
    await prisma.workflowInstanceStep.update({
      where: { id: step1.id },
      data: {
        actionState: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Trigger runtime
    const { determineNextSteps } = await import("@/lib/workflows/runtime");
    await determineNextSteps(instance.id, step1.id);

    // Should activate step 2 (condition is TRUE)
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    expect(updatedInstance!.steps[1].actionState).toBe("READY");

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should handle compound AND condition correctly", async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Compound AND Test ${Date.now()}`,
        description: "Tests compound AND condition",
        version: 1,
        isActive: true,
        steps: {
          create: [
            {
              order: 1,
              title: "Setup",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { title: "Setup" },
            },
            {
              order: 2,
              title: "Payment Collection",
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
              actionConfig: { amount: 1000, currency: "USD" },
            },
          ],
        },
      },
    });

    // Create instance with both conditions TRUE
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: testContactId,
        matterId: testMatterId,
        status: "ACTIVE",
        context: {
          approvalDecision: "APPROVED",
          documentCount: 5,
        },
        steps: {
          create: template.steps.map((step) => ({
            templateStepId: step.id,
            order: step.order,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            conditionType: step.conditionType,
            conditionConfig: step.conditionConfig,
            actionConfig: step.actionConfig,
            actionState: step.order === 1 ? "READY" : "PENDING",
            actionData: {},
          })),
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    // Complete step 1
    await prisma.workflowInstanceStep.update({
      where: { id: instance.steps[0].id },
      data: { actionState: "COMPLETED", completedAt: new Date() },
    });

    // Trigger runtime
    const { determineNextSteps } = await import("@/lib/workflows/runtime");
    await determineNextSteps(instance.id, instance.steps[0].id);

    // Step 2 should be READY (both AND conditions are TRUE)
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    expect(updatedInstance!.steps[1].actionState).toBe("READY");

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should handle branching with nextStepOnTrue", async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Branching Test ${Date.now()}`,
        description: "Tests workflow branching",
        version: 1,
        isActive: true,
        steps: {
          create: [
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
              nextStepOnTrue: 4, // Skip to payment if pre-approved
              nextStepOnFalse: null, // Go to next step (manual approval)
              actionConfig: { title: "Pre-approval check" },
            },
            {
              order: 2,
              title: "Manual Approval",
              actionType: "APPROVAL_LAWYER",
              roleScope: "LAWYER",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { message: "Manual review required" },
            },
            {
              order: 3,
              title: "Additional Verification",
              actionType: "TASK",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { description: "Verify documents" },
            },
            {
              order: 4,
              title: "Payment",
              actionType: "PAYMENT_CLIENT",
              roleScope: "CLIENT",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: { amount: 500, currency: "USD" },
            },
          ],
        },
      },
    });

    // Create instance with pre-approved contact
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: testContactId,
        matterId: testMatterId,
        status: "ACTIVE",
        context: {
          isPreApproved: true,
        },
        steps: {
          create: template.steps.map((step) => ({
            templateStepId: step.id,
            order: step.order,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            conditionType: step.conditionType,
            conditionConfig: step.conditionConfig,
            nextStepOnTrue: step.nextStepOnTrue,
            nextStepOnFalse: step.nextStepOnFalse,
            actionConfig: step.actionConfig,
            actionState: step.order === 1 ? "READY" : "PENDING",
            actionData: {},
          })),
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    // Complete step 1 (pre-approval check)
    await prisma.workflowInstanceStep.update({
      where: { id: instance.steps[0].id },
      data: { actionState: "COMPLETED", completedAt: new Date() },
    });

    // Trigger runtime
    const { determineNextSteps } = await import("@/lib/workflows/runtime");
    await determineNextSteps(instance.id, instance.steps[0].id);

    // Should skip steps 2-3 and jump to step 4 (payment)
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    expect(updatedInstance!.steps[1].actionState).toBe("SKIPPED");
    expect(updatedInstance!.steps[2].actionState).toBe("SKIPPED");
    expect(updatedInstance!.steps[3].actionState).toBe("READY");

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });
});
