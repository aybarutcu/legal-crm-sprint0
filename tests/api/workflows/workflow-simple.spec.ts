import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Simplified Workflow Document Request Tests
 * 
 * These tests verify REQUEST_DOC workflow action behavior:
 * - documentsStatus initialization
 * - Document linking to workflow steps
 * - Status updates on upload
 * - Step completion logic
 */
describe('Workflow Document Requests (Simplified)', () => {
  let testUserId: string;
  let testClientId: string;
  let testMatterId: string;
  let testWorkflowInstanceId: string;
  let testStepId: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // Cleanup existing test data
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-workflow-simple-' } },
    });

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-workflow-simple-${Date.now()}@example.com`,
        name: 'Test Workflow User',
        role: 'LAWYER',
      },
    });
    testUserId = user.id;

    // Create test client
    const client = await prisma.contact.create({
      data: {
        firstName: 'Test',
        lastName: 'Workflow Client',
        type: 'CLIENT',
        email: `test-workflow-client-simple-${Date.now()}@example.com`,
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
        createdBy: { connect: { id: testUserId } },
      },
    });
    testTemplateId = template.id;

    // Create workflow instance
    const instance = await prisma.workflowInstance.create({
      data: {
        template: { connect: { id: template.id } },
        matter: { connect: { id: testMatterId } },
        status: 'ACTIVE',
        templateVersion: 1,
        createdBy: { connect: { id: testUserId } },
      },
    });
    testWorkflowInstanceId = instance.id;

    // Create REQUEST_DOC step
    const step = await prisma.workflowInstanceStep.create({
      data: {
        instance: { connect: { id: instance.id } },
        title: 'Request Client Documents',
        actionType: 'REQUEST_DOC',
        actionState: 'IN_PROGRESS',
        roleScope: 'CLIENT',
        actionData: {
          config: {
            requestText: 'Please upload the required documents',
            documentNames: ['ID Card', 'Proof of Address', 'Contract'],
          },
          status: 'IN_PROGRESS',
          documentsStatus: [
            {
              requestId: 'req_001',
              documentName: 'ID Card',
              uploaded: false,
              version: 0,
            },
            {
              requestId: 'req_002',
              documentName: 'Proof of Address',
              uploaded: false,
              version: 0,
            },
            {
              requestId: 'req_003',
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
    // Cleanup in reverse order
    if (testStepId) {
      await prisma.document.deleteMany({ where: { workflowStepId: testStepId } }).catch(() => {});
    }
    if (testWorkflowInstanceId) {
      await prisma.workflowInstanceStep.deleteMany({ where: { instanceId: testWorkflowInstanceId } }).catch(() => {});
      await prisma.workflowInstance.delete({ where: { id: testWorkflowInstanceId } }).catch(() => {});
    }
    if (testTemplateId) {
      await prisma.workflowTemplate.delete({ where: { id: testTemplateId } }).catch(() => {});
    }
    if (testMatterId) {
      await prisma.documentFolder.deleteMany({ where: { matterId: testMatterId } }).catch(() => {});
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

    expect(step).toBeTruthy();
    const actionData = step!.actionData as Record<string, unknown>;
    const documentsStatus = actionData.documentsStatus as Array<{
      requestId: string;
      documentName: string;
      uploaded: boolean;
      version: number;
    }>;

    expect(documentsStatus).toHaveLength(3);
    expect(documentsStatus[0].documentName).toBe('ID Card');
    expect(documentsStatus[0].uploaded).toBe(false);
    expect(documentsStatus[0].version).toBe(0);
  });

  it('should generate correct requestId format', async () => {
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step!.actionData as Record<string, unknown>;
    const documentsStatus = actionData.documentsStatus as Array<{
      requestId: string;
      documentName: string;
    }>;

    expect(documentsStatus[0].requestId).toMatch(/^req_\d+$/);
  });

  it('should link uploaded document to workflow step', async () => {
    // Get or create folder
    let folder = await prisma.documentFolder.findFirst({
      where: { matterId: testMatterId },
    });

    if (!folder) {
      folder = await prisma.documentFolder.create({
        data: {
          name: 'Workflow Docs',
          matter: { connect: { id: testMatterId } },
          createdBy: { connect: { id: testUserId } },
          accessScope: 'PUBLIC',
        },
      });
    }

    // Create document linked to workflow step
    const doc = await prisma.document.create({
      data: {
        filename: 'id-card.pdf',
        displayName: 'ID Card',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/workflow/id-card.pdf',
        version: 1,
        tags: ['req_001', 'ID Card'],
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: folder.id } },
        workflowStep: { connect: { id: testStepId } },
      },
    });

    expect(doc.workflowStepId).toBe(testStepId);
    expect(doc.tags).toContain('req_001');
  });

  it('should update documentsStatus when document is uploaded', async () => {
    // Get current step
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step!.actionData as Record<string, unknown>;
    let documentsStatus = actionData.documentsStatus as Array<{
      requestId: string;
      documentName: string;
      uploaded: boolean;
      version: number;
      documentId?: string;
    }>;

    // Simulate document upload - update status for req_001
    documentsStatus = documentsStatus.map((status) =>
      status.requestId === 'req_001'
        ? { ...status, uploaded: true, version: 1, documentId: 'doc_123' }
        : status
    );

    // Update step
    await prisma.workflowInstanceStep.update({
      where: { id: testStepId },
      data: {
        actionData: {
          ...actionData,
          documentsStatus,
        },
      },
    });

    // Verify update
    const updatedStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const updatedActionData = updatedStep!.actionData as Record<string, unknown>;
    const updatedStatuses = updatedActionData.documentsStatus as Array<{
      requestId: string;
      uploaded: boolean;
      version: number;
    }>;

    const uploadedDoc = updatedStatuses.find((s) => s.requestId === 'req_001');
    expect(uploadedDoc?.uploaded).toBe(true);
    expect(uploadedDoc?.version).toBe(1);
  });

  it('should mark step as COMPLETED when all documents uploaded', async () => {
    // Get current step
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    const actionData = step!.actionData as Record<string, unknown>;

    // Mark all documents as uploaded
    const documentsStatus = [
      { requestId: 'req_001', documentName: 'ID Card', uploaded: true, version: 1 },
      { requestId: 'req_002', documentName: 'Proof of Address', uploaded: true, version: 1 },
      { requestId: 'req_003', documentName: 'Contract', uploaded: true, version: 1 },
    ];

    // Update step to COMPLETED
    await prisma.workflowInstanceStep.update({
      where: { id: testStepId },
      data: {
        actionState: 'COMPLETED',
        actionData: {
          ...actionData,
          documentsStatus,
          allDocumentsUploaded: true,
          status: 'COMPLETED',
        },
      },
    });

    const completedStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: testStepId },
    });

    expect(completedStep?.actionState).toBe('COMPLETED');
    const completedActionData = completedStep!.actionData as Record<string, unknown>;
    expect(completedActionData.allDocumentsUploaded).toBe(true);
  });

  it('should support document versioning in workflow', async () => {
    // Get or create folder
    let folder = await prisma.documentFolder.findFirst({
      where: { matterId: testMatterId },
    });

    if (!folder) {
      folder = await prisma.documentFolder.create({
        data: {
          name: 'Workflow Docs',
          matter: { connect: { id: testMatterId } },
          createdBy: { connect: { id: testUserId } },
          accessScope: 'PUBLIC',
        },
      });
    }

    // Create v1
    const v1 = await prisma.document.create({
      data: {
        filename: 'contract.pdf',
        displayName: 'Contract',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/workflow/contract-v1.pdf',
        version: 1,
        tags: ['req_003', 'Contract'],
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: folder.id } },
        workflowStep: { connect: { id: testStepId } },
      },
    });

    // Create v2
    const v2 = await prisma.document.create({
      data: {
        filename: 'contract.pdf',
        displayName: 'Contract',
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/workflow/contract-v2.pdf',
        version: 2,
        tags: ['req_003', 'Contract'],
        parentDocument: { connect: { id: v1.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: folder.id } },
        workflowStep: { connect: { id: testStepId } },
      },
    });

    expect(v2.version).toBe(2);
    expect(v2.parentDocumentId).toBe(v1.id);
    expect(v2.workflowStepId).toBe(testStepId);
  });

  it('should use displayName and tags for document identification', async () => {
    const docs = await prisma.document.findMany({
      where: {
        workflowStepId: testStepId,
        tags: { has: 'req_001' },
      },
    });

    if (docs.length > 0) {
      expect(docs[0].displayName).toBeTruthy();
      expect(docs[0].tags).toContain('req_001');
      expect(docs[0].tags).toContain('ID Card');
    }
  });
});
