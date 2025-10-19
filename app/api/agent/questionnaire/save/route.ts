// app/api/agent/questionnaire/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const QuestionType = z.enum(["FREE_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"]);

const QuestionDraft = z.object({
  order: z.number().int().nonnegative(),
  questionText: z.string().min(1),
  questionType: QuestionType,
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z.record(z.any()).optional(),
});

const QuestionnaireDraft = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(false),
  questions: z.array(QuestionDraft).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = QuestionnaireDraft.parse(body);

  // Create questionnaire with questions in a transaction
  const questionnaire = await prisma.$transaction(async (tx) => {
    const created = await tx.questionnaire.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        isActive: parsed.isActive,
        createdById: session.user.id,
      },
    });

    // Create questions
    await tx.questionnaireQuestion.createMany({
      data: parsed.questions.map((q) => ({
        questionnaireId: created.id,
        questionText: q.questionText,
        questionType: q.questionType,
        order: q.order,
        required: q.required,
        placeholder: q.placeholder ?? undefined,
        helpText: q.helpText ?? undefined,
        options: q.options ?? undefined,
        validation: q.validation ?? undefined,
      })),
    });

    return created;
  });

  return NextResponse.json({
    id: questionnaire.id,
    title: questionnaire.title,
  });
}
