import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { QuestionnaireEditor } from "@/components/questionnaires/QuestionnaireEditor";
import type { QuestionnaireDetail } from "@/components/questionnaires/types";

type QuestionnaireDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuestionnaireDetailPage({
  params,
}: QuestionnaireDetailPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and LAWYER can edit questionnaires
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.LAWYER) {
    redirect("/questionnaires");
  }

  const { id } = await params;

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id, deletedAt: null },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      questions: true,
      _count: {
        select: {
          responses: true,
        },
      },
    },
  });

  if (!questionnaire) {
    notFound();
  }

  const questionnaireDetail: QuestionnaireDetail = {
    id: questionnaire.id,
    title: questionnaire.title,
    description: questionnaire.description,
    isActive: questionnaire.isActive,
    createdAt: questionnaire.createdAt.toISOString(),
    updatedAt: questionnaire.updatedAt.toISOString(),
    createdBy: {
      id: questionnaire.createdBy.id,
      name: questionnaire.createdBy.name,
      email: questionnaire.createdBy.email,
    },
    questions: questionnaire.questions.map((q) => ({
      id: q.id,
      questionnaireId: q.questionnaireId,
      questionText: q.questionText,
      questionType: q.questionType,
      order: q.order,
      required: q.required,
      placeholder: q.placeholder,
      helpText: q.helpText,
      options: Array.isArray(q.options) ? q.options as string[] : null,
      validation: q.validation as Record<string, unknown> | null,
    })),
    _count: {
      responses: questionnaire._count.responses,
    },
  };

  return <QuestionnaireEditor questionnaire={questionnaireDetail} />;
}
