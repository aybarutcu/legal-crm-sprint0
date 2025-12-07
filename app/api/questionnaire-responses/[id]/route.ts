import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { responseSubmitSchema } from "@/lib/validation/questionnaire";
import { Role } from "@prisma/client";

type RouteContext = { id: string };

// GET /api/questionnaire-responses/[id] - Get response with answers
export const GET = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    const response = await prisma.questionnaireResponse.findUnique({
      where: { id: params!.id },
      include: {
        questionnaire: {
          include: {
            questions: true,
          },
        },
        respondent: {
          select: { id: true, name: true, email: true },
        },
        matter: {
          select: { id: true, title: true },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Authorization: User must be respondent, or have access to the matter, or be admin/lawyer
    const canAccess =
      response.respondentId === user.id ||
      [Role.ADMIN, Role.LAWYER].includes((user.role!) as "ADMIN" | "LAWYER") ||
      (response.matterId &&
        (await prisma.matter.findFirst({
          where: {
            id: response.matterId,
            deletedAt: null,
            OR: [
              { ownerId: user.id },
              { client: { userId: user.id } },
              { teamMembers: { some: { userId: user.id } } },
            ],
          },
        })));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ response });
  }
);

// PATCH /api/questionnaire-responses/[id] - Update answers (save progress)
export const PATCH = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    const response = await prisma.questionnaireResponse.findUnique({
      where: { id: params!.id },
      include: {
        questionnaire: {
          include: { questions: true },
        },
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Only the respondent can update their response
    if (response.respondentId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Can't update completed responses
    if (response.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot update completed response" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = responseSubmitSchema.parse(body);

    // Validate all question IDs belong to this questionnaire
    const questionIds = response.questionnaire.questions.map((q) => q.id);
    for (const answer of validated.answers) {
      if (!questionIds.includes(answer.questionId)) {
        return NextResponse.json(
          { error: `Invalid question ID: ${answer.questionId}` },
          { status: 400 }
        );
      }
    }

    // Update answers using transaction
    await prisma.$transaction(async (tx) => {
      for (const answer of validated.answers) {
        await tx.questionnaireResponseAnswer.upsert({
          where: {
            responseId_questionId: {
              responseId: params!.id,
              questionId: answer.questionId,
            },
          },
          create: {
            responseId: params!.id,
            questionId: answer.questionId,
            answerText: answer.answerText,
            answerJson: answer.answerJson as any,
          },
          update: {
            answerText: answer.answerText,
            answerJson: answer.answerJson as any,
          },
        });
      }
    });

    // Fetch updated response
    const updated = await prisma.questionnaireResponse.findUnique({
      where: { id: params!.id },
      include: {
        answers: {
          include: { question: true },
        },
      },
    });

    return NextResponse.json({ response: updated });
  }
);
