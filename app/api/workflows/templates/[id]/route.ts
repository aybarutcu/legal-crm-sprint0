import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import {
  workflowTemplateUpdateSchema,
} from "@/lib/validation/workflow";
import { requireAdmin } from "@/lib/authorization";
import type { Session } from "next-auth";

export const GET = withApiHandler(
  async (_req: NextRequest, { session, params }: { session?: Session | null; params?: { id: string } }) => {
    await requireAdmin(session);

    if (!params?.id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        steps: true,
        dependencies: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json(template);
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { session, params }: { session?: Session | null; params?: { id: string } }) => {
    await requireAdmin(session);

    if (!params?.id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const body = await req.json();
    const payload = workflowTemplateUpdateSchema.parse(body);

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    if (template.isActive && !(payload.isActive === false && Object.keys(payload).length === 1)) {
      return NextResponse.json(
        { error: "Template is active and cannot be modified" },
        { status: 409 },
      );
    }

    const data: Prisma.WorkflowTemplateUpdateInput = {
      name: payload.name ?? undefined,
      description:
        payload.description === undefined
          ? undefined
          : payload.description ?? null,
      isActive: payload.isActive ?? undefined,
    };

    // Use transaction to ensure proper ordering
    const updated = await prisma.$transaction(async (tx) => {
      // First, delete old dependencies (must come before deleting steps)
      if (payload.dependencies !== undefined || payload.steps) {
        await tx.workflowTemplateDependency.deleteMany({
          where: { templateId: params.id },
        });
      }

      // Then update template and handle steps
      if (payload.steps) {
        // Delete old steps
        await tx.workflowTemplateStep.deleteMany({
          where: { templateId: params.id },
        });

        // Create new steps
        await tx.workflowTemplateStep.createMany({
          data: payload.steps.map((step, index) => ({
            id: step.id,
            templateId: params.id,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required ?? true,
            actionConfig: step.actionConfig ?? {},
            notificationPolicies: step.notificationPolicies ?? [],
            positionX: step.positionX ?? index * 300 + 50,
            positionY: step.positionY ?? 100,
          })),
        });
      }

      // Create new dependencies (after steps exist)
      if (payload.dependencies !== undefined && payload.dependencies.length > 0) {
        await tx.workflowTemplateDependency.createMany({
          data: payload.dependencies.map(dep => ({
            templateId: params.id,
            sourceStepId: dep.sourceStepId,
            targetStepId: dep.targetStepId,
            dependencyType: dep.dependencyType,
            dependencyLogic: dep.dependencyLogic,
            conditionType: dep.conditionType,
            conditionConfig: dep.conditionConfig ?? undefined,
          })),
        });
      }

      // Finally, update template metadata
      const updatedTemplate = await tx.workflowTemplate.update({
        where: { id: params.id },
        data: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        },
        include: {
          steps: true,
          dependencies: true,
        },
      });

      return updatedTemplate;
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler(
  async (_req: NextRequest, { session, params }: { session?: Session | null; params?: { id: string } }) => {
    await requireAdmin(session);

    if (!params?.id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const existing = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Check for ACTIVE workflow instances
    const activeInstanceCount = await prisma.workflowInstance.count({
      where: { 
        templateId: params.id,
        status: {
          in: ['ACTIVE']
        }
      },
    });

    if (activeInstanceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete template: ${activeInstanceCount} active workflow${activeInstanceCount === 1 ? '' : 's'} in progress. Complete or cancel them first.` },
        { status: 409 },
      );
    }

    // Hard delete the template (cascade will handle dependencies and steps)
    await prisma.workflowTemplate.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  },
);
