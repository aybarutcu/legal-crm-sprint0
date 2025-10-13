import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ActionState, Prisma, WorkflowInstanceStatus } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { workflowInstantiateSchema } from "@/lib/validation/workflow";
import { buildMatterAccessFilter } from "@/lib/tasks/service";

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (req: NextRequest, { session, params }: Params) => {
    const user = session!.user!;
    const payload = workflowInstantiateSchema.parse(await req.json());

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
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

    const minOrder = Math.min(...sortedSteps.map((step) => step.computedOrder));

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
            actionState:
              step.computedOrder === minOrder
                ? ActionState.READY
                : ActionState.PENDING,
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

    return NextResponse.json(instance, { status: 201 });
  },
);
