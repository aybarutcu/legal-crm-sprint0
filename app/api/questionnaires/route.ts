import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { questionnaireCreateSchema } from "@/lib/validation/questionnaire";
import { Role } from "@prisma/client";

// GET /api/questionnaires - List questionnaires with filters
export const GET = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;

  // Only ADMIN/LAWYER can manage questionnaires
  if (![Role.ADMIN, Role.LAWYER].includes(user.role!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const isActiveParam = searchParams.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  const where = {
    deletedAt: null,
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [questionnaires, total] = await Promise.all([
    prisma.questionnaire.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { questions: true, responses: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.questionnaire.count({ where }),
  ]);

  return NextResponse.json({
    questionnaires,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// POST /api/questionnaires - Create new questionnaire
export const POST = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;

  // Only ADMIN/LAWYER can create questionnaires
  if (![Role.ADMIN, Role.LAWYER].includes(user.role!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const validated = questionnaireCreateSchema.parse(body);

  const questionnaire = await prisma.questionnaire.create({
    data: {
      title: validated.title,
      description: validated.description,
      createdById: user.id,
      questions: {
        create: validated.questions.map((q, idx) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          order: idx,
          required: q.required ?? true,
          placeholder: q.placeholder,
          helpText: q.helpText,
          options: q.options ? JSON.stringify(q.options) : undefined,
          validation: q.validation ? JSON.stringify(q.validation) : undefined,
        })),
      },
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ questionnaire }, { status: 201 });
});
