/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ActionState, Prisma } from "@prisma/client";
import { validateWorkflowDependencies, getReadySteps } from "@/lib/workflows/dependency-resolver";

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
      // Sort template steps by order
      const sortedSteps = template.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step, index) => ({ ...step, computedOrder: index }));

      // Create a map from order to temp ID for validation
      const orderToTempIdMap = new Map<number, string>();
      sortedSteps.forEach((step) => {
        orderToTempIdMap.set(step.computedOrder, `temp-${step.id}`);
      });

      // Validate dependencies before creation
      // Convert dependsOn from orders to temp IDs for validation
      const templateStepsForValidation = sortedSteps.map((step) => ({
        id: `temp-${step.id}`,
        order: step.computedOrder,
        dependsOn: (step.dependsOn ?? [])
          .map((order) => orderToTempIdMap.get(order))
          .filter((id): id is string => id !== undefined),
        dependencyLogic: step.dependencyLogic ?? "ALL",
        actionState: ActionState.PENDING,
      }));

      // Type assertion: validation only needs id, order, dependsOn, dependencyLogic, actionState
      const validation = validateWorkflowDependencies(templateStepsForValidation as any);

      if (!validation.valid) {
        throw new Error(`Invalid dependencies: ${validation.errors.join(", ")}`);
      }

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
              order: templateStep.computedOrder,
              title: templateStep.title,
              actionType: templateStep.actionType,
              roleScope: templateStep.roleScope,
              required: templateStep.required,
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

      // Map dependencies from template orders to instance step IDs
      const instanceSteps = await tx.workflowInstanceStep.findMany({
        where: { instanceId: newInstance.id },
        orderBy: { order: "asc" },
      });

      const orderToStepIdMap = new Map<number, string>();
      instanceSteps.forEach((step) => {
        orderToStepIdMap.set(step.order, step.id);
      });

      // Update steps with dependency information
      await Promise.all(
        sortedSteps.map(async (templateStep, index) => {
          const instanceStep = instanceSteps[index];
          const dependsOnOrders = templateStep.dependsOn ?? [];
          const dependsOnStepIds = dependsOnOrders
            .map((order) => orderToStepIdMap.get(order))
            .filter((id): id is string => id !== undefined);

          await tx.workflowInstanceStep.update({
            where: { id: instanceStep.id },
            data: {
              dependsOn: dependsOnStepIds,
              dependencyLogic: templateStep.dependencyLogic ?? "ALL",
            },
          });
        })
      );

      // Reload instance with updated dependencies
      const instanceWithDeps = await tx.workflowInstance.findUnique({
        where: { id: newInstance.id },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!instanceWithDeps) {
        throw new Error("Instance not found after creation");
      }

      // Determine which steps are READY based on dependencies
      const readySteps = getReadySteps(instanceWithDeps.steps);

      // Update READY steps in database
      if (readySteps.length > 0) {
        await Promise.all(
          readySteps.map((step) =>
            tx.workflowInstanceStep.update({
              where: { id: step.id },
              data: { actionState: ActionState.READY },
            })
          )
        );
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
