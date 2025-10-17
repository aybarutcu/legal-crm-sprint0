import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { questionnaireUpdateSchema } from "@/lib/validation/questionnaire";
import { Role } from "@prisma/client";

type RouteContext = {
  params: { id: string };
};

// GET /api/questionnaires/[id] - Get single questionnaire
export const GET = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    // Only ADMIN/LAWYER can view questionnaires
    if (![Role.ADMIN, Role.LAWYER].includes(user.role!)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionnaire = await prisma.questionnaire.findUnique({
      where: {
        id: params!.id,
        deletedAt: null,
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    return NextResponse.json({ questionnaire });
  }
);

// PATCH /api/questionnaires/[id] - Update questionnaire
export const PATCH = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    // Only ADMIN/LAWYER can update questionnaires
    if (![Role.ADMIN, Role.LAWYER].includes(user.role!)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if questionnaire exists
    const existing = await prisma.questionnaire.findUnique({
      where: {
        id: params!.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = questionnaireUpdateSchema.parse(body);

    // Use transaction to update questionnaire and questions atomically
    const questionnaire = await prisma.$transaction(async (tx) => {
      // Update questionnaire basic info
      const updated = await tx.questionnaire.update({
        where: { id: params!.id },
        data: {
          title: validated.title,
          description: validated.description,
          isActive: validated.isActive,
        },
      });

      // If questions are provided, update them intelligently
      if (validated.questions) {
        // Get existing questions with answer counts
        const existingQuestions = await tx.questionnaireQuestion.findMany({
          where: { questionnaireId: params!.id },
          include: {
            _count: {
              select: { answers: true },
            },
          },
        });

        // Map incoming questions by ID (if they have one)
        const incomingQuestionsMap = new Map<string, typeof validated.questions[0]>();
        validated.questions.forEach((q) => {
          if (q.id && !q.id.startsWith("temp-")) {
            incomingQuestionsMap.set(q.id, q);
          }
        });

        // Check if any questions being removed have responses
        const questionsBeingRemoved = existingQuestions.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (eq: any) => !incomingQuestionsMap.has(eq.id)
        );
        
        const questionsWithResponses = questionsBeingRemoved.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (eq: any) => eq._count.answers > 0
        );

        if (questionsWithResponses.length > 0) {
          return NextResponse.json(
            {
              error: "Cannot delete questions that have responses",
              details: `${questionsWithResponses.length} question(s) have existing responses and cannot be deleted. You can only modify their placeholder or help text.`,
            },
            { status: 400 }
          );
        }

        // Delete questions with no responses
        const questionsToDelete = questionsBeingRemoved.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (eq: any) => eq._count.answers === 0
        );
        
        if (questionsToDelete.length > 0) {
          await tx.questionnaireQuestion.deleteMany({
            where: {
              id: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                in: questionsToDelete.map((q: any) => q.id),
              },
            },
          });
        }

        // Update or create each question
        for (let i = 0; i < validated.questions.length; i++) {
          const q = validated.questions[i];
          const questionData = {
            questionnaireId: params!.id,
            questionText: q.questionText,
            questionType: q.questionType,
            order: i,
            required: q.required ?? true,
            placeholder: q.placeholder ?? null,
            helpText: q.helpText ?? null,
            options: q.options ? q.options : null,
            validation: q.validation ? q.validation : null,
          };

          if (q.id && !q.id.startsWith("temp-")) {
            // Update existing question
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingQuestion = existingQuestions.find((eq: any) => eq.id === q.id);
            if (existingQuestion) {
              // Check if question has responses
              if (existingQuestion._count.answers > 0) {
                // Only allow updating certain fields if question has responses
                await tx.questionnaireQuestion.update({
                  where: { id: q.id },
                  data: {
                    order: i,
                    placeholder: q.placeholder ?? null,
                    helpText: q.helpText ?? null,
                    // Don't allow changing questionText, questionType, required, or options
                    // to preserve data integrity with existing responses
                  },
                });
              } else {
                // No responses, allow full update
                await tx.questionnaireQuestion.update({
                  where: { id: q.id },
                  data: questionData,
                });
              }
            }
          } else {
            // Create new question
            await tx.questionnaireQuestion.create({
              data: questionData,
            });
          }
        }
      }

      // Fetch and return complete questionnaire
      return await tx.questionnaire.findUnique({
        where: { id: params!.id },
        include: {
          questions: {
            orderBy: { order: "asc" },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    return NextResponse.json({ questionnaire });
  }
);

// DELETE /api/questionnaires/[id] - Soft delete questionnaire
export const DELETE = withApiHandler<RouteContext>(
  async (req: NextRequest, { session, params }) => {
    const user = session!.user!;

    // Only ADMIN/LAWYER can delete questionnaires
    if (![Role.ADMIN, Role.LAWYER].includes(user.role!)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionnaire = await prisma.questionnaire.findUnique({
      where: {
        id: params!.id,
        deletedAt: null,
      },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    // Soft delete
    await prisma.questionnaire.update({
      where: { id: params!.id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
        isActive: false, // Also deactivate
      },
    });

    return NextResponse.json({ success: true });
  }
);
