import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ActionState, Prisma, WorkflowInstanceStatus } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { workflowInstantiateSchema } from "@/lib/validation/workflow";
import { buildMatterAccessFilter } from "@/lib/tasks/service";
import { WorkflowMetrics } from "@/lib/workflows/observability";
import { getReadySteps } from "@/lib/workflows/dependency-resolver";

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
        steps: true,
        dependencies: true, // Include template dependencies
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
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((step, index) => ({
        ...step,
        computedOrder: index,
      }));

    // TODO: Add template dependency validation before instantiation
    // const validation = validateWorkflowDependencies(...);
    // if (!validation.valid) {
    //   return NextResponse.json(
    //     { error: `Invalid workflow dependencies: ${validation.errors.join(", ")}` },
    //     { status: 400 },
    //   );
    // }

    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        matterId: matter.id,
        templateVersion: template.version,
        createdById: user.id,
        status: WorkflowInstanceStatus.ACTIVE,
      },
    });

    // Create workflow steps from template (all initially PENDING)
    await Promise.all(
      sortedSteps.map(async (step, index) => {
        await prisma.workflowInstanceStep.create({
          data: {
            instanceId: instance.id,
            templateStepId: step.id,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            positionX: typeof step.positionX === "number" ? step.positionX : index * 300 + 50,
            positionY: typeof step.positionY === "number" ? step.positionY : 100,
            // Note: dependsOn will be set after instance creation (need step IDs)
            // All steps start as PENDING - will be updated to READY based on dependencies
            actionState: ActionState.PENDING,
            actionData: {
              config: step.actionConfig ?? {},
              history: [],
            } satisfies Prisma.JsonObject,
          },
        });
      })
    );

    // Fetch the created instance with steps
    const fullInstance = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: { select: { id: true, name: true, version: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        steps: true,
      },
    });

    if (!fullInstance) {
      throw new Error("Failed to create workflow instance");
    }

    const templateToInstanceId = new Map<string, string>();
    fullInstance.steps.forEach((step) => {
      if (step.templateStepId) {
        templateToInstanceId.set(step.templateStepId, step.id);
      }
    });

    // Create instance dependencies from template dependencies
    if ((template.dependencies || []).length > 0) {
      await prisma.workflowInstanceDependency.createMany({
        data: (template.dependencies || []).map(dep => ({
          instanceId: instance.id,
          sourceStepId: templateToInstanceId.get(dep.sourceStepId)!,
          targetStepId: templateToInstanceId.get(dep.targetStepId)!,
          dependencyType: dep.dependencyType,
          dependencyLogic: dep.dependencyLogic,
          conditionType: dep.conditionType,
          conditionConfig: dep.conditionConfig ?? undefined,
        })),
      });
    }

    // Reload instance with updated dependency information
    const instanceWithDeps = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: { select: { id: true, name: true, version: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        steps: true,
        dependencies: true,
      },
    });

    if (!instanceWithDeps) {
      return NextResponse.json({ error: "Instance not found after creation" }, { status: 500 });
    }

    // Determine which steps are READY based on dependencies
    const readySteps = getReadySteps(instanceWithDeps.steps, instanceWithDeps.dependencies);

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
        steps: true,
        dependencies: true,
      },
    });

    return NextResponse.json(finalInstance, { status: 201 });
  },
  { requireAuth: true }
);
