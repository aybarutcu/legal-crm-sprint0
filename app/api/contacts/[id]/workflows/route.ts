/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ActionState, Prisma } from "@prisma/client";

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
    if (!["ADMIN", "LAWYER", "PARALEGAL"].includes(userRole ?? "CLIENT")) {
      return NextResponse.json(
        { error: "Insufficient permissions to create workflows" },
        { status: 403 }
      );
    }

    // Get the template
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        steps: true,
        dependencies: true,
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
      // Sort template steps by some criteria (using index for now)
      const sortedSteps = template.steps
        .slice()
        .map((step, index) => ({ ...step, computedOrder: index }));

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

      // Create workflow steps from template (all initially PENDING)
      await Promise.all(
        sortedSteps.map(async (templateStep) => {
          await tx.workflowInstanceStep.create({
            data: {
              instanceId: newInstance.id,
              templateStepId: templateStep.id,
              title: templateStep.title,
              actionType: templateStep.actionType,
              roleScope: templateStep.roleScope,
              required: templateStep.required,
              positionX:
                typeof templateStep.positionX === "number"
                  ? templateStep.positionX
                  : templateStep.computedOrder * 300 + 50,
              positionY: typeof templateStep.positionY === "number" ? templateStep.positionY : 100,
              actionState: ActionState.PENDING, // Start as PENDING, will update READY steps after
              actionData: ({
                config: templateStep.actionConfig ?? {},
                history: [],
              } satisfies Prisma.JsonObject) as any,
              // Auto-assign based on role if contact has an owner
              assignedToId:
                contact.ownerId && templateStep.roleScope === userRole
                  ? contact.ownerId
                  : null,
            },
          });
        })
      );

      // Get instance with steps to create dependencies
      const instanceWithSteps = await tx.workflowInstance.findUnique({
        where: { id: newInstance.id },
        include: {
          steps: true,
        },
      });

      if (!instanceWithSteps) {
        throw new Error("Instance not found after creation");
      }

      // Create instance dependencies from template dependencies
      const templateToInstanceId = new Map<string, string>();
      instanceWithSteps.steps.forEach((step) => {
        if (step.templateStepId) {
          templateToInstanceId.set(step.templateStepId, step.id);
        }
      });

      if ((template.dependencies || []).length > 0) {
        await tx.workflowInstanceDependency.createMany({
          data: (template.dependencies || []).map(dep => ({
            instanceId: newInstance.id,
            sourceStepId: templateToInstanceId.get(dep.sourceStepId)!,
            targetStepId: templateToInstanceId.get(dep.targetStepId)!,
            dependencyType: dep.dependencyType,
            dependencyLogic: dep.dependencyLogic,
            conditionType: dep.conditionType,
            conditionConfig: dep.conditionConfig ?? undefined,
          })),
        });
      }

      // Determine which steps are READY based on dependencies
      // For now, mark the first step as READY (no dependencies)
      // TODO: Implement proper dependency resolution from template
      if (instanceWithSteps.steps.length > 0) {
        await tx.workflowInstanceStep.update({
          where: { id: instanceWithSteps.steps[0].id },
          data: { actionState: ActionState.READY },
        });
      }

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
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(workflows);
  },
  { requireAuth: true }
);
