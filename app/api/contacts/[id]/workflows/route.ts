/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

const createWorkflowSchema = z.object({
  templateId: z.string().cuid(),
});

/**
 * POST /api/contacts/[id]/workflows
 * Create a workflow instance for a contact (LEAD follow-up workflows)
 */
export const POST = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const resolvedParams = await params;
    const contactId = resolvedParams!.id;
    const userId = session!.user!.id;

    // Validate request body
    const body = await req.json();
    const { templateId } = createWorkflowSchema.parse(body);

    // Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Check if user has permission (ADMIN, LAWYER, PARALEGAL can create workflows for contacts)
    const userRole = session!.user!.role;
    if (!["ADMIN", "LAWYER", "PARALEGAL"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions to create workflows" },
        { status: 403 }
      );
    }

    // Get the template
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Workflow template not found" },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: "Workflow template is not active" },
        { status: 400 }
      );
    }

    // Create workflow instance for contact
    const instance = await prisma.$transaction(async (tx) => {
      // Create the workflow instance
      const newInstance = await tx.workflowInstance.create({
        data: {
          templateId: template.id,
          contactId, // Use contactId instead of matterId
          templateVersion: template.version,
          createdById: userId,
          status: "ACTIVE",
        } as any,
      });

      // Create workflow steps from template
      await Promise.all(
        template.steps.map(async (templateStep) => {
          await tx.workflowInstanceStep.create({
            data: {
              instanceId: newInstance.id,
              templateStepId: templateStep.id,
              order: templateStep.order,
              title: templateStep.title,
              actionType: templateStep.actionType,
              roleScope: templateStep.roleScope,
              required: templateStep.required,
              actionState: templateStep.order === 1 ? "READY" : "PENDING",
              actionData: (templateStep.actionConfig || {}) as any,
              // Auto-assign based on role if contact has an owner
              assignedToId:
                contact.ownerId && templateStep.roleScope === userRole
                  ? contact.ownerId
                  : null,
            },
          });
        })
      );

      return newInstance;
    });

    // Fetch complete instance with steps
    const completeInstance = await (prisma.workflowInstance.findUnique as any)({
      where: { id: instance.id },
      include: {
        template: true,
        contact: true,
        steps: {
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(completeInstance, { status: 201 });
  },
  { requireAuth: true }
);

/**
 * GET /api/contacts/[id]/workflows
 * Get all workflow instances for a contact
 */
export const GET = withApiHandler<{ id: string }>(
  async (_req, { params }) => {
    const resolvedParams = await params;
    const contactId = resolvedParams!.id;

    // Get workflows for the contact
    const workflows = await (prisma.workflowInstance.findMany as any)({
      where: { contactId },
      include: {
        template: true,
        contact: true,
        steps: {
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(workflows);
  },
  { requireAuth: true }
);
