import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

type RouteContext = { id: string };

// POST /api/questionnaire-responses/[id]/complete - Mark response as completed
export const POST = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    const response = await prisma.questionnaireResponse.findUnique({
      where: { id: params!.id },
      include: {
        questionnaire: {
          include: { questions: true },
        },
        answers: true,
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Only the respondent can complete their response
    if (response.respondentId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Already completed
    if (response.status === "COMPLETED") {
      return NextResponse.json({ response });
    }

    // Validate all required questions are answered
    const requiredQuestions = response.questionnaire.questions.filter((q) => q.required);
    const answeredQuestionIds = new Set(response.answers.map((a) => a.questionId));

    const missingRequiredQuestions = requiredQuestions.filter(
      (q) => !answeredQuestionIds.has(q.id)
    );

    if (missingRequiredQuestions.length > 0) {
      return NextResponse.json(
        {
          error: "All required questions must be answered",
          missingQuestions: missingRequiredQuestions.map((q) => ({
            id: q.id,
            text: q.questionText,
          })),
        },
        { status: 400 }
      );
    }

    // Mark as completed
    const completed = await prisma.questionnaireResponse.update({
      where: { id: params!.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        questionnaire: true,
        answers: {
          include: { question: true },
        },
      },
    });

    return NextResponse.json({ response: completed });
  }
);
