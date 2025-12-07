import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { responseCreateSchema } from "@/lib/validation/questionnaire";

// POST /api/questionnaire-responses - Start a new response
export const POST = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;

  const body = await req.json();
  const validated = responseCreateSchema.parse(body);

  // Verify questionnaire exists and is active
  const questionnaire = await prisma.questionnaire.findUnique({
    where: {
      id: validated.questionnaireId,
      deletedAt: null,
      isActive: true,
    },
  });

  if (!questionnaire) {
    return NextResponse.json(
      { error: "Questionnaire not found or inactive" },
      { status: 404 }
    );
  }

  // If matterId provided, verify user has access to matter
  if (validated.matterId) {
    const matter = await prisma.matter.findFirst({
      where: {
        id: validated.matterId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          { client: { userId: user.id } },
          { teamMembers: { some: { userId: user.id } } },
        ],
      },
    });

    if (!matter) {
      return NextResponse.json(
        { error: "Matter not found or access denied" },
        { status: 403 }
      );
    }
  }

  // Create response
  const response = await prisma.questionnaireResponse.create({
    data: {
      questionnaireId: validated.questionnaireId,
      workflowStepId: validated.workflowStepId,
      matterId: validated.matterId,
      respondentId: user.id,
      status: "IN_PROGRESS",
    },
    include: {
      questionnaire: {
        include: {
          questions: true,
        },
      },
    },
  });

  return NextResponse.json({ response }, { status: 201 });
});
