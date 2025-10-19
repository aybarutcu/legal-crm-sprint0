/**
 * P0.1 Conditional Workflow Logic - Simplified E2E Test
 * 
 * Tests basic conditional workflow functionality
 */

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test.describe("Conditional Workflow - Simple E2E", () => {
  let testContactId: string;
  let testMatterId: string;
  let lawyerUserId: string;

  test.beforeAll(async () => {
    // Find a lawyer user for testing
    const lawyer = await prisma.user.findFirst({
      where: { role: "LAWYER" },
    });
    
    if (!lawyer) {
      throw new Error("No lawyer user found. Run npm run db:seed first.");
    }
    
    lawyerUserId = lawyer.id;

    // Create test contact (LEAD - workflows can be assigned to LEADs)
    const contact = await prisma.contact.create({
      data: {
        firstName: "E2E",
        lastName: "Test Contact",
        email: `e2e-test-${Date.now()}@test.local`,
        type: "LEAD",
        source: "REFERRAL",
        ownerId: lawyerUserId,
      },
    });
    testContactId = contact.id;

    // Create test matter
    const matter = await prisma.matter.create({
      data: {
        title: "E2E Test Matter",
        type: "Civil Litigation",
        status: "IN_PROGRESS",
        clientId: testContactId, // Matter needs a client
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

  test("should create and validate conditional template", async () => {
    // Create a template with conditional logic
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Conditional Test ${Date.now()}`,
        description: "Template with IF_TRUE condition",
        version: 1,
        isActive: false, // Draft template
        createdById: lawyerUserId,
        steps: {
          create: [
            {
              order: 1,
              title: "Always Execute",
              actionType: "WRITE_TEXT",
              roleScope: "ADMIN",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: {
                title: "Basic Info",
                description: "Always runs",
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
                type: "simple",
                field: "contactType",
                operator: "==",
                value: "CORPORATE",
              },
              actionConfig: {
                requestText: "Corporate documents needed",
                documentNames: ["Articles of Incorporation"],
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

    // Verify template structure
    expect(template.steps).toHaveLength(3);
    expect(template.steps[0].conditionType).toBe("ALWAYS");
    expect(template.steps[1].conditionType).toBe("IF_TRUE");
    expect(template.steps[1].conditionConfig).toMatchObject({
      type: "simple",
      field: "contactType",
      operator: "==",
      value: "CORPORATE",
    });
    expect(template.steps[2].conditionType).toBe("ALWAYS");

    console.log(`✓ Created template: ${template.name}`);
    console.log(`✓ Template has ${template.steps.length} steps`);
    console.log(`✓ Step 2 has IF_TRUE condition on contactType`);

    // Cleanup
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should create workflow instance on LEAD contact", async () => {
    // Create simple template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Lead Workflow ${Date.now()}`,
        description: "Workflow for LEAD contacts",
        version: 1,
        isActive: true,
        createdById: lawyerUserId,
        steps: {
          create: [
            {
              order: 1,
              title: "Follow Up Task",
              actionType: "TASK",
              roleScope: "LAWYER",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: {
                description: "Contact the lead",
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

    // Create workflow instance on LEAD contact (no matter)
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: testContactId, // LEAD contact
        matterId: null, // No matter yet
        templateVersion: template.version,
        createdById: lawyerUserId,
        status: "ACTIVE",
        contextData: {
          contactType: "LEAD",
          source: "REFERRAL",
        },
        steps: {
          create: [
            {
              order: 1,
              title: template.steps[0].title,
              actionType: template.steps[0].actionType,
              roleScope: template.steps[0].roleScope,
              required: template.steps[0].required,
              conditionType: template.steps[0].conditionType,
              conditionConfig: template.steps[0].conditionConfig,
              actionState: "READY",
              actionData: {},
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

    // Verify instance on LEAD
    expect(instance.contactId).toBe(testContactId);
    expect(instance.matterId).toBeNull();
    expect(instance.steps).toHaveLength(1);
    expect(instance.steps[0].actionState).toBe("READY");

    console.log(`✓ Created workflow instance on LEAD contact`);
    console.log(`✓ Instance has contactId: ${instance.contactId}`);
    console.log(`✓ Instance has no matter (matterId: null)`);
    console.log(`✓ Step 1 is READY`);

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });

  test("should create workflow instance on matter", async () => {
    // Create simple template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Matter Workflow ${Date.now()}`,
        description: "Workflow for matters",
        version: 1,
        isActive: true,
        createdById: lawyerUserId,
        steps: {
          create: [
            {
              order: 1,
              title: "Document Collection",
              actionType: "REQUEST_DOC_CLIENT",
              roleScope: "CLIENT",
              required: true,
              conditionType: "ALWAYS",
              actionConfig: {
                requestText: "Please upload documents",
                documentNames: ["ID", "Proof of Address"],
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

    // Create workflow instance on matter
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        contactId: null,
        matterId: testMatterId, // Attached to matter
        templateVersion: template.version,
        createdById: lawyerUserId,
        status: "ACTIVE",
        contextData: {
          matterType: "Civil Litigation",
          matterStatus: "IN_PROGRESS",
        },
        steps: {
          create: [
            {
              order: 1,
              title: template.steps[0].title,
              actionType: template.steps[0].actionType,
              roleScope: template.steps[0].roleScope,
              required: template.steps[0].required,
              conditionType: template.steps[0].conditionType,
              conditionConfig: template.steps[0].conditionConfig,
              actionState: "READY",
              actionData: {},
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

    // Verify instance on matter
    expect(instance.matterId).toBe(testMatterId);
    expect(instance.contactId).toBeNull();
    expect(instance.steps).toHaveLength(1);

    console.log(`✓ Created workflow instance on matter`);
    console.log(`✓ Instance has matterId: ${instance.matterId}`);
    console.log(`✓ Instance has no contact (contactId: null)`);

    // Cleanup
    await prisma.workflowInstance.delete({ where: { id: instance.id } });
    await prisma.workflowTemplate.delete({ where: { id: template.id } });
  });
});
