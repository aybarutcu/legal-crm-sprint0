import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Workflow Document Requests', () => {
  let testUserId: string;
  let testClientId: string;
  let testMatterId: string;
  let testWorkflowInstanceId: string;
  let testStepId: string;

  beforeAll(async () => {
    // Cleanup any existing test data first
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-workflow-docs-' } },
    });

    // Create test user with unique email
    const user = await prisma.user.create({
      data: {
        email: `test-workflow-docs-${Date.now()}@example.com`,
        name: 'Test Workflow User',
        role: 'LAWYER',
      },
    });
    testUserId = user.id;

    // Create test client contact
    const client = await prisma.contact.create({
      data: {
        firstName: 'Test',
        lastName: 'Workflow Client',
        type: 'CLIENT',
        email: `test-workflow-client-${Date.now()}@example.com`,
        ownerId: testUserId,
      },
    });
    testClientId = client.id;

    // Create test matter
    const matter = await prisma.matter.create({
      data: {
        title: 'Test Matter for Workflow Docs',
        type: 'GENERAL',
        status: 'OPEN',
        openedAt: new Date(),
        clientId: testClientId,
        ownerId: testUserId,
      },
    });
    testMatterId = matter.id;

    // Create workflow template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: 'Document Request Template',
        description: 'Test template for document requests',
        createdById: testUserId,
      },
    });

    // Create workflow instance
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        matterId: testMatterId,
        status: 'ACTIVE',
        createdById: testUserId,
      },
    });
    testWorkflowInstanceId = instance.id;

    // Create REQUEST_DOC step
    const step = await prisma.workflowInstanceStep.create({
      data: {
        instanceId: instance.id,
        title: 'Request Client Documents',
        actionType: 'REQUEST_DOC',
        actionState: 'IN_PROGRESS',
        order: 1,
        roleScope: 'CLIENT',
        actionData: {
          config: {
            requestText: 'Please upload the required documents',
            documentNames: ['ID Card', 'Proof of Address', 'Contract'],
          },
          status: 'IN_PROGRESS',
          documentsStatus: [
            {
              requestId: `${instance.id}-id-card`,
              documentName: 'ID Card',
              uploaded: false,
              version: 0,
            },
            {
              requestId: `${instance.id}-proof-of-address`,
              documentName: 'Proof of Address',
              uploaded: false,
              version: 0,
            },
            {
              requestId: `${instance.id}-contract`,
              documentName: 'Contract',
              uploaded: false,
              version: 0,
            },
          ],
          allDocumentsUploaded: false,
        },
      },
    });
    testStepId = step.id;
  });

  afterAll(async () => {
    // Cleanup with null checks
    if (testStepId) {
      await prisma.document.deleteMany({ where: { workflowStepId: testStepId } }).catch(() => {});
    }
    if (testWorkflowInstanceId) {
      await prisma.workflowInstanceStep.deleteMany({ where: { instanceId: testWorkflowInstanceId } }).catch(() => {});
      await prisma.workflowInstance.delete({ where: { id: testWorkflowInstanceId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.workflowTemplate.deleteMany({ where: { createdById: testUserId } }).catch(() => {});
    }
    if (testMatterId) {
      await prisma.matter.delete({ where: { id: testMatterId } }).catch(() => {});
    }
    if (testClientId) {
      await prisma.contact.delete({ where: { id: testClientId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should initialize documentsStatus with all requested documents', async () => {
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step?.actionData as any;
    expect(actionData.documentsStatus).toHaveLength(3);
    expect(actionData.documentsStatus[0].documentName).toBe('ID Card');
    expect(actionData.documentsStatus[0].uploaded).toBe(false);
  });

  it('should generate correct requestId format', async () => {
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step?.actionData as any;
    const status = actionData.documentsStatus[0];

    expect(status.requestId).toContain(testWorkflowInstanceId);
    expect(status.requestId).toMatch(/^[a-z0-9]+-[a-z0-9-]+$/);
  });

  it('should link uploaded document to workflow step', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'id-card.pdf',
        displayName: 'ID Card',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/test/id-card.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        workflowStepId: testStepId,
        tags: [`${testWorkflowInstanceId}-id-card`, 'ID Card'],
      },
    });

    expect(doc.workflowStepId).toBe(testStepId);
    expect(doc.tags).toContain('ID Card');
  });

  it('should update documentsStatus when document is uploaded', async () => {
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step?.actionData as any;
    const documentsStatus = actionData.documentsStatus;

    // Simulate document upload
    const updatedStatus = documentsStatus.map((status: any) =>
      status.documentName === 'ID Card'
        ? {
            ...status,
            uploaded: true,
            documentId: 'test-doc-id',
            uploadedAt: new Date().toISOString(),
            version: 1,
          }
        : status
    );

    await prisma.workflowInstanceStep.update({
      where: { id: testStepId },
      data: {
        actionData: {
          ...actionData,
          documentsStatus: updatedStatus,
        },
      },
    });

    const updatedStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const updatedActionData = updatedStep?.actionData as any;
    const uploadedDoc = updatedActionData.documentsStatus.find(
      (s: any) => s.documentName === 'ID Card'
    );

    expect(uploadedDoc.uploaded).toBe(true);
    expect(uploadedDoc.version).toBe(1);
  });

  it('should mark step as COMPLETED when all documents uploaded', async () => {
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step?.actionData as any;

    // Mark all documents as uploaded
    const allUploaded = actionData.documentsStatus.map((status: any) => ({
      ...status,
      uploaded: true,
      documentId: `doc-${status.documentName}`,
      uploadedAt: new Date().toISOString(),
      version: 1,
    }));

    await prisma.workflowInstanceStep.update({
      where: { id: testStepId },
      data: {
        actionData: {
          ...actionData,
          documentsStatus: allUploaded,
          allDocumentsUploaded: true,
          status: 'COMPLETED',
        },
        actionState: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const completedStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    expect(completedStep?.actionState).toBe('COMPLETED');
    const completedActionData = completedStep?.actionData as any;
    expect(completedActionData.allDocumentsUploaded).toBe(true);
  });

  it('should support document versioning in workflow', async () => {
    // Create initial document
    const v1 = await prisma.document.create({
      data: {
        filename: 'contract-v1.pdf',
        displayName: 'Contract',
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/test/v1/contract-v1.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        workflowStepId: testStepId,
        tags: [`${testWorkflowInstanceId}-contract`, 'Contract'],
      },
    });

    // Upload new version
    const v2 = await prisma.document.create({
      data: {
        filename: 'contract-v2.pdf',
        displayName: 'Contract',
        mime: 'application/pdf',
        size: 3072,
        storageKey: 'documents/test/v2/contract-v2.pdf',
        version: 2,
        parentDocumentId: v1.id,
        uploadedById: testUserId,
        matterId: testMatterId,
        workflowStepId: testStepId,
        tags: [`${testWorkflowInstanceId}-contract`, 'Contract'],
      },
    });

    expect(v2.parentDocumentId).toBe(v1.id);
    expect(v2.version).toBe(2);

    // Update workflow step version
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step?.actionData as any;
    const updatedStatus = actionData.documentsStatus.map((status: any) =>
      status.documentName === 'Contract'
        ? { ...status, version: 2, documentId: v2.id }
        : status
    );

    await prisma.workflowInstanceStep.update({
      where: { id: testStepId },
      data: {
        actionData: {
          ...actionData,
          documentsStatus: updatedStatus,
        },
      },
    });

    const updatedStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const updatedActionData = updatedStep?.actionData as any;
    const contractStatus = updatedActionData.documentsStatus.find(
      (s: any) => s.documentName === 'Contract'
    );

    expect(contractStatus.version).toBe(2);
  });

  it('should use displayName and tags for document identification', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'some-file-123.pdf',
        displayName: 'Proof of Address',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/test/proof.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        workflowStepId: testStepId,
        tags: [`${testWorkflowInstanceId}-proof-of-address`, 'Proof of Address'],
      },
    });

    expect(doc.displayName).toBe('Proof of Address');
    expect(doc.filename).not.toBe(doc.displayName);
    expect(doc.tags).toContain('Proof of Address');
  });
});
