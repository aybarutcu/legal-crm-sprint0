// app/api/workflow/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WorkflowTemplateDraft } from "@/lib/workflows/schema";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const draft = WorkflowTemplateDraft.parse(body); // güvenli

    // --- Normalize checklist items to [{ title: string }] ---
    const normalizedSteps = draft.steps.map((s) => {
        const isChecklist = s.actionType === "CHECKLIST";
        let actionConfig: any = s.actionConfig ?? {};

        if (isChecklist) {
            const raw = Array.isArray(actionConfig.items) ? actionConfig.items : [];
            const items = raw
                .map((it: any) => (typeof it === "string" ? { title: it } : it))
                .filter((it: any) => it && typeof it.title === "string" && it.title.trim().length > 0);
            actionConfig = { ...actionConfig, items };
        }

        return { ...s, actionConfig };
    });

    // Aynı isim için versiyon belirle (max + 1)
    const max = await prisma.workflowTemplate.aggregate({
        _max: { version: true },
        where: { name: draft.name },
    });
    const nextVersion = (max._max.version ?? 0) + 1;

    const created = await prisma.$transaction(async (tx) => {
        // Create the template with steps
        const template = await tx.workflowTemplate.create({
            data: {
                name: draft.name,
                description: draft.description,
                version: nextVersion,
                isActive: draft.isActive ?? false,
                steps: {
                    create: normalizedSteps.map((s, index) => ({
                        // Don't set id here - let Prisma generate it
                        title: s.title,
                        actionType: s.actionType,
                        roleScope: s.roleScope,
                        required: s.required ?? true,
                        actionConfig: s.actionConfig ?? {},
                        notificationPolicies: s.notificationPolicies ?? [],
                        positionX: s.positionX ?? index * 350 + 50,
                        positionY: s.positionY ?? 100,
                    }))
                }
            },
            include: { steps: true }
        });

        // Create ID mapping from AI-generated IDs to database IDs
        const stepIdMap = new Map<string, string>();
        normalizedSteps.forEach((draftStep, index) => {
            const dbStep = template.steps[index];
            if (draftStep.id && dbStep) {
                stepIdMap.set(draftStep.id, dbStep.id);
            }
        });

        // Create dependencies with mapped IDs
        if (draft.dependencies && draft.dependencies.length > 0) {
            const mappedDependencies = draft.dependencies
                .map(dep => {
                    const mappedSourceId = stepIdMap.get(dep.sourceStepId);
                    const mappedTargetId = stepIdMap.get(dep.targetStepId);
                    
                    // Only create dependency if both IDs are found
                    if (!mappedSourceId || !mappedTargetId) {
                        console.warn(`Skipping dependency: source=${dep.sourceStepId} -> target=${dep.targetStepId} (mapping failed)`);
                        return null;
                    }
                    
                    return {
                        templateId: template.id,
                        sourceStepId: mappedSourceId,
                        targetStepId: mappedTargetId,
                        dependencyType: dep.dependencyType,
                        dependencyLogic: dep.dependencyLogic,
                        conditionType: dep.conditionType,
                        conditionConfig: dep.conditionConfig ?? undefined,
                    };
                })
                .filter(dep => dep !== null);

            if (mappedDependencies.length > 0) {
                await tx.workflowTemplateDependency.createMany({
                    data: mappedDependencies as any[],
                });
            }
        }

        return template;
    });

    return NextResponse.json(created);
}
