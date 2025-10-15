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
        const template = await tx.workflowTemplate.create({
            data: {
                name: draft.name,
                description: draft.description,
                version: nextVersion,
                isActive: draft.isActive ?? false,
                steps: {
                    create: normalizedSteps.map(s => ({
                        order: s.order,
                        title: s.title,
                        actionType: s.actionType,
                        roleScope: s.roleScope,
                        required: s.required ?? true,
                        actionConfig: s.actionConfig ?? {},
                    }))
                }
            },
            include: { steps: true }
        });
        return template;
    });

    return NextResponse.json(created);
}