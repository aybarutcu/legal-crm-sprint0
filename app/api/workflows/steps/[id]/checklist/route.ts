import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { z } from "zod";

const updateChecklistSchema = z.object({
  checkedItems: z.array(z.string()),
});

export const PATCH = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id: stepId } = await params;
    const body = await req.json();
    const { checkedItems } = updateChecklistSchema.parse(body);

    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: stepId },
      include: {
        instance: {
          select: {
            matterId: true,
            contactId: true,
          },
        },
      },
    });

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    // Get existing actionData
    const actionData = (step.actionData as Record<string, unknown>) || {};
    
    // Update the checkedItems in actionData
    const updatedActionData = {
      ...actionData,
      checkedItems,
    };

    // Update the step
    const updated = await prisma.workflowInstanceStep.update({
      where: { id: stepId },
      data: {
        actionData: updatedActionData,
      },
    });

    return NextResponse.json({ success: true, step: updated });
  },
  { requireAuth: true }
);
