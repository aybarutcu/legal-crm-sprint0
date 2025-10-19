import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ActionState, Prisma, WorkflowInstanceStatus } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { workflowInstantiateSchema } from "@/lib/validation/workflow";
import { buildMatterAccessFilter } from "@/lib/tasks/service";
import { WorkflowMetrics } from "@/lib/workflows/observability";
import { validateWorkflowDependencies, getReadySteps } from "@/lib/workflows/dependency-resolver";

export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;
    const resolvedParams = await params;
    if (!resolvedParams) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const payload = workflowInstantiateSchema.parse(await req.json());

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: resolvedParams.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: "Template is not published" }, { status: 409 });
    }

    if (template.steps.length === 0) {
      return NextResponse.json(
        { error: "Template has no steps" },
        { status: 400 },
      );
    }

    const matter = await prisma.matter.findFirst({
      where: {
        id: payload.matterId,
        ...buildMatterAccessFilter({ id: user.id, role: user.role }),
      },
      select: { id: true, ownerId: true, title: true },
    });

    if (!matter) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }

    const sortedSteps = template.steps
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((step, index) => ({
        ...step,
        computedOrder: step.order ?? index,
      }));

    // Validate dependencies before creating instance
    const templateStepsForValidation = sortedSteps.map((step) => ({
      id: `temp-${step.id}`,
      order: step.computedOrder,
      dependsOn: step.dependsOn ?? [],
      dependencyLogic: step.dependencyLogic ?? "ALL",
      actionState: ActionState.PENDING,
    }));

    // Type assertion: validation only needs id, order, dependsOn, dependencyLogic, actionState
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validation = validateWorkflowDependencies(templateStepsForValidation as any);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid workflow dependencies: ${validation.errors.join(", ")}` },
        { status: 400 },
      );
    }

    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        matterId: matter.id,
        templateVersion: template.version,
        createdById: user.id,
        status: WorkflowInstanceStatus.ACTIVE,
        steps: {
          create: sortedSteps.map((step) => ({
            templateStepId: step.id,
            order: step.computedOrder,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            // Note: dependsOn will be set after instance creation (need step IDs)
            // All steps start as PENDING - will be updated to READY based on dependencies
            actionState: ActionState.PENDING,
            actionData: {
              config: step.actionConfig ?? {},
              history: [],
            } satisfies Prisma.JsonObject,
          })),
        },
      },
      include: {
        template: { select: { id: true, name: true, version: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // After creation, map template dependencies (orders) to instance dependencies (step IDs)
    // and determine which steps are READY
    const orderToStepIdMap = new Map<number, string>();
    instance.steps.forEach((step) => {
      orderToStepIdMap.set(step.order, step.id);
    });

    // Update steps with dependency information
    await prisma.$transaction(
      sortedSteps.map((templateStep, index) => {
        const instanceStep = instance.steps[index];
        const dependsOnOrders = templateStep.dependsOn ?? [];
        const dependsOnStepIds = dependsOnOrders
          .map((order) => orderToStepIdMap.get(order))
          .filter((id): id is string => id !== undefined);

        return prisma.workflowInstanceStep.update({
          where: { id: instanceStep.id },
          data: {
            dependsOn: dependsOnStepIds,
            dependencyLogic: templateStep.dependencyLogic ?? "ALL",
          },
        });
      })
    );

    // Reload instance with updated dependency information
    const instanceWithDeps = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: { select: { id: true, name: true, version: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!instanceWithDeps) {
      return NextResponse.json({ error: "Instance not found after creation" }, { status: 500 });
    }

    // Determine which steps are READY based on dependencies
    const readySteps = getReadySteps(instanceWithDeps.steps);

    // Update READY steps in database
    if (readySteps.length > 0) {
      await prisma.$transaction(
        readySteps.map((step) =>
          prisma.workflowInstanceStep.update({
            where: { id: step.id },
            data: { actionState: ActionState.READY },
          })
        )
      );
    }

    // Record instance creation metric
    WorkflowMetrics.recordInstanceCreated(template.id);

    // Send notifications for all READY steps
    const { notifyStepReady } = await import("@/lib/workflows/notifications");
    for (const readyStep of readySteps) {
      await notifyStepReady(prisma, readyStep.id).catch((error) => {
        console.error("[Workflow Instantiate] Notification failed:", error);
        // Don't fail the request if notification fails
      });
    }

    // Reload final instance with READY steps
    const finalInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: { select: { id: true, name: true, version: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(finalInstance, { status: 201 });
  },
  { requireAuth: true }
);
