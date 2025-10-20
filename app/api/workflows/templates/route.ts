import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import {
  workflowTemplateCreateSchema,
  WorkflowStepInput,
} from "@/lib/validation/workflow";
import { requireAdmin } from "@/lib/authorization";

export const GET = withApiHandler(async (_req: NextRequest) => {
  const templates = await prisma.workflowTemplate.findMany({
    orderBy: [
      { isActive: "desc" },
      { updatedAt: "desc" },
    ],
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });
  
  return NextResponse.json(templates);
});

function mapStepInput(step: WorkflowStepInput, index: number) {
  return {
    title: step.title,
    actionType: step.actionType,
    roleScope: step.roleScope,
    required: step.required ?? true,
    actionConfig: step.actionConfig ?? {},
    order: step.order ?? index,
    // Conditional execution fields
    conditionType: step.conditionType ?? "ALWAYS",
    conditionConfig: step.conditionConfig ?? null,
    nextStepOnTrue: step.nextStepOnTrue ?? null,
    nextStepOnFalse: step.nextStepOnFalse ?? null,
    // Dependency fields (P0.2)
    dependsOn: step.dependsOn ?? [],
    dependencyLogic: step.dependencyLogic ?? "ALL",
    // Canvas position fields (P0.3)
    positionX: step.positionX ?? index * 300 + 50,
    positionY: step.positionY ?? 100,
  };
}

export const POST = withApiHandler(
  async (req: NextRequest, { session }) => {
    await requireAdmin(session);
    const payload = workflowTemplateCreateSchema.parse(await req.json());

    console.log('🔍 [API POST] Received payload steps:', payload.steps.map(s => ({
      title: s.title,
      positionX: s.positionX,
      positionY: s.positionY,
    })));

    const latestVersion = await prisma.workflowTemplate.aggregate({
      where: { name: payload.name },
      _max: { version: true },
    });

    const nextVersion = (latestVersion._max.version ?? 0) + 1;

    const data: Parameters<typeof prisma.workflowTemplate.create>[0]["data"] = {
      name: payload.name,
      description: payload.description,
      createdById: session!.user!.id,
      version: nextVersion,
    };

    if (payload.steps && payload.steps.length > 0) {
      const mappedSteps = payload.steps.map(mapStepInput);
      console.log('📝 [API POST] Mapped steps to DB:', mappedSteps.map(s => ({
        title: s.title,
        positionX: s.positionX,
        positionY: s.positionY,
      })));
      data.steps = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: mappedSteps as any,
      };
    }

    const template = await prisma.workflowTemplate.create({
      data,
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Debug: Log returned template positions
    // console.log('✅ [API POST] Created template:', template.steps);

    return NextResponse.json(template, { status: 201 });
  },
);
