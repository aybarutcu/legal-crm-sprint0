import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/rbac";
import { z } from "zod";

/**
 * GET /api/workflows/instances/[id]/edit
 * Fetch workflow instance data for editing
 */
export const GET = withApiHandler(
  async (req, { session, params }) => {
    const { id } = params as { id: string };
    const user = session!.user!;

    // Only ADMIN and LAWYER can edit workflow instances
    assertRole({ userRole: user.role!, allowedRoles: ["ADMIN", "LAWYER"] });

    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        matter: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            teamMembers: {
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            type: true,
            ownerId: true,
          },
        },
        steps: {
          orderBy: { order: "asc" },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Workflow instance not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this matter/contact
    if (instance.matterId) {
      const hasAccess =
        user.role === "ADMIN" ||
        instance.matter!.ownerId === user.id ||
        instance.matter!.teamMembers.some((tm) => tm.userId === user.id);

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to this workflow" },
          { status: 403 }
        );
      }
    } else if (instance.contactId) {
      const hasAccess =
        user.role === "ADMIN" || instance.contact!.ownerId === user.id;

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to this workflow" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(instance);
  },
  { requireAuth: true }
);

/**
 * PATCH /api/workflows/instances/[id]/edit
 * Update workflow instance steps (metadata, reordering, etc.)
 */

const stepUpdateSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  actionType: z.string(),
  roleScope: z.string(),
  required: z.boolean(),
  actionData: z.unknown(),
  assignedToId: z.string().nullable(),
  dueDate: z.string().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  notes: z.string().nullable(),
  dependsOn: z.array(z.string()),
  dependencyLogic: z.string(),
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
  nextStepOnTrue: z.number().nullable().optional(),
  nextStepOnFalse: z.number().nullable().optional(),
});

const patchBodySchema = z.object({
  steps: z.array(stepUpdateSchema),
});

export const PATCH = withApiHandler(
  async (req, { session, params }) => {
    const { id } = params as { id: string };
    const user = session!.user!;

    // Only ADMIN and LAWYER can edit workflow instances
    assertRole({ userRole: user.role!, allowedRoles: ["ADMIN", "LAWYER"] });

    const body = await req.json();
    const { steps } = patchBodySchema.parse(body);

    // Fetch current instance with access control check
    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        matter: {
          select: {
            ownerId: true,
            teamMembers: { select: { userId: true } },
          },
        },
        contact: {
          select: { ownerId: true },
        },
        steps: { select: { id: true, actionState: true } },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Workflow instance not found" },
        { status: 404 }
      );
    }

    // Check access
    if (instance.matterId) {
      const hasAccess =
        user.role === "ADMIN" ||
        instance.matter!.ownerId === user.id ||
        instance.matter!.teamMembers.some((tm) => tm.userId === user.id);

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to edit this workflow" },
          { status: 403 }
        );
      }
    } else if (instance.contactId) {
      const hasAccess =
        user.role === "ADMIN" || instance.contact!.ownerId === user.id;

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to edit this workflow" },
          { status: 403 }
        );
      }
    }

    // Validate: cannot modify COMPLETED or IN_PROGRESS steps
    const currentSteps = instance.steps;
    const lockedStates = ["COMPLETED", "IN_PROGRESS"];

    for (const updatedStep of steps) {
      const currentStep = currentSteps.find((s) => s.id === updatedStep.id);
      if (currentStep && lockedStates.includes(currentStep.actionState)) {
        // Only allow metadata updates (assignedToId, dueDate, priority, notes)
        // Title and core config cannot be changed
        const existingData = await prisma.workflowInstanceStep.findUnique({
          where: { id: updatedStep.id },
          select: {
            title: true,
            actionType: true,
            roleScope: true,
            required: true,
            dependsOn: true,
            dependencyLogic: true,
          },
        });

        if (
          existingData &&
          (existingData.title !== updatedStep.title ||
            existingData.actionType !== updatedStep.actionType ||
            existingData.roleScope !== updatedStep.roleScope ||
            existingData.required !== updatedStep.required ||
            JSON.stringify(existingData.dependsOn) !==
              JSON.stringify(updatedStep.dependsOn) ||
            existingData.dependencyLogic !== updatedStep.dependencyLogic)
        ) {
          return NextResponse.json(
            {
              error: `Cannot modify core properties of ${currentStep.actionState.toLowerCase()} step: ${updatedStep.title}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update steps in transaction
    console.log("Updating workflow instance", {
      instanceId: id,
      stepIds: steps.map((step) => step.id),
    });

    await prisma.$transaction(
      steps.map((step) =>
        prisma.workflowInstanceStep.update({
          where: { id: step.id },
          data: {
            order: step.order,
            title: step.title,
            actionType: step.actionType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            roleScope: step.roleScope as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            required: step.required,
            actionData: step.actionData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            assignedToId: step.assignedToId,
            dueDate: step.dueDate ? new Date(step.dueDate) : null,
            priority: step.priority,
            notes: step.notes,
            dependsOn: step.dependsOn,
            dependencyLogic: step.dependencyLogic as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            positionX: typeof step.positionX === "number" ? step.positionX : 0,
            positionY: typeof step.positionY === "number" ? step.positionY : 100,
            nextStepOnTrue: typeof step.nextStepOnTrue === "number" ? step.nextStepOnTrue : null,
            nextStepOnFalse: typeof step.nextStepOnFalse === "number" ? step.nextStepOnFalse : null,
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: "Workflow updated successfully" });
  },
  { requireAuth: true }
);
