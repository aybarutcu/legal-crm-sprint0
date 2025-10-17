import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { QuestionnaireListClient } from "@/components/questionnaires/QuestionnaireListClient";
import type { QuestionnaireListItem } from "@/components/questionnaires/types";

const QUESTIONNAIRE_PAGE_SIZE = 20;

export default async function QuestionnairesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and LAWYER can manage questionnaires
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.LAWYER) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;

  const rawQuery = {
    q: Array.isArray(resolvedSearchParams.q)
      ? resolvedSearchParams.q[0]
      : resolvedSearchParams.q,
    isActive: Array.isArray(resolvedSearchParams.isActive)
      ? resolvedSearchParams.isActive[0]
      : resolvedSearchParams.isActive,
    page: Array.isArray(resolvedSearchParams.page)
      ? resolvedSearchParams.page[0]
      : resolvedSearchParams.page,
    pageSize: Array.isArray(resolvedSearchParams.pageSize)
      ? resolvedSearchParams.pageSize[0]
      : resolvedSearchParams.pageSize,
  };

  const page = parseInt(rawQuery.page ?? "1", 10);
  const pageSize = parseInt(rawQuery.pageSize ?? String(QUESTIONNAIRE_PAGE_SIZE), 10);
  const q = rawQuery.q ?? "";
  const isActive = rawQuery.isActive === "true" ? true : rawQuery.isActive === "false" ? false : undefined;

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  const skip = (page - 1) * pageSize;

  const [questionnaires, total] = await Promise.all([
    prisma.questionnaire.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    }),
    prisma.questionnaire.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const listItems: QuestionnaireListItem[] = questionnaires.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    isActive: q.isActive,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    createdBy: {
      id: q.createdBy.id,
      name: q.createdBy.name,
      email: q.createdBy.email,
    },
    _count: {
      questions: q._count.questions,
      responses: q._count.responses,
    },
  }));

  const pagination = {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };

  const filters = {
    q: q || undefined,
    isActive: isActive !== undefined ? String(isActive) : undefined,
  };

  return (
    <QuestionnaireListClient
      initialQuestionnaires={listItems}
      initialPagination={pagination}
      filters={filters}
    />
  );
}
