import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import {
  taskCreateSchema,
  taskQuerySchema,
  type TaskCreateInput,
  type TaskQueryInput,
} from "@/lib/validation/task";
import type { SessionUser } from "@/app/api/tasks/_helpers";

function buildAccessFilter(user: SessionUser): Prisma.TaskWhereInput | undefined {
  if (!user.role || user.role === "ADMIN") {
    return undefined;
  }

  return {
    OR: [
      { assigneeId: user.id },
      { matter: { ownerId: user.id } },
    ],
  };
}

function buildTaskFilters(
  filters: Omit<TaskQueryInput, "page" | "pageSize">,
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.matterId) {
    where.matterId = filters.matterId;
  }

  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.dueFrom || filters.dueTo) {
    where.dueAt = {};
    if (filters.dueFrom) {
      where.dueAt.gte = filters.dueFrom;
    }
    if (filters.dueTo) {
      where.dueAt.lte = filters.dueTo;
    }
  }

  return where;
}

async function ensureCanCreateTask(
  user: SessionUser,
  input: Pick<TaskCreateInput, "assigneeId" | "matterId">,
) {
  if (!user.role) {
    const error = new Error("Forbidden");
    // @ts-expect-error augment status in centralized handler
    error.status = 403;
    throw error;
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (!input.assigneeId || input.assigneeId === user.id) {
    return;
  }

  if (input.matterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: input.matterId },
      select: { ownerId: true },
    });

    if (matter?.ownerId === user.id) {
      return;
    }
  }

  const error = new Error("Forbidden");
  // @ts-expect-error align with central handler
  error.status = 403;
  throw error;
}

type LegacyTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  createdAt: Date;
  matterId: string | null;
  assigneeId: string | null;
  matterTitle: string | null;
  matterOwnerId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

const LEGACY_BASE_FROM = Prisma.sql`
  FROM "Task"
  LEFT JOIN "Matter" ON "Task"."matterId" = "Matter"."id"
  LEFT JOIN "User" AS "Assignee" ON "Task"."assigneeId" = "Assignee"."id"
`;

const LEGACY_SELECT_COLUMNS = Prisma.sql`
  SELECT
    "Task"."id",
    "Task"."title",
    "Task"."description",
    "Task"."status",
    "Task"."priority",
    "Task"."dueAt",
    "Task"."createdAt",
    "Task"."matterId",
    "Task"."assigneeId",
    "Matter"."title" AS "matterTitle",
    "Matter"."ownerId" AS "matterOwnerId",
    "Assignee"."name" AS "assigneeName",
    "Assignee"."email" AS "assigneeEmail"
`;

function mapLegacyTaskRow(row: LegacyTaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
    reminderNotified: false,
    reminderNotifiedAt: null,
    matterId: row.matterId,
    assigneeId: row.assigneeId,
    assignee: row.assigneeId
      ? {
          id: row.assigneeId,
          name: row.assigneeName,
          email: row.assigneeEmail,
        }
      : null,
    matter: row.matterId
      ? {
          id: row.matterId,
          title: row.matterTitle ?? "",
          ownerId: row.matterOwnerId,
        }
      : null,
    _count: {
      checklists: 0,
      links: 0,
    },
  };
}

async function fetchLegacyTasks({
  user,
  filters,
  pageSize,
  skip,
}: {
  user: SessionUser;
  filters: Omit<TaskQueryInput, "page" | "pageSize">;
  pageSize: number;
  skip: number;
}) {
  const conditions: Prisma.Sql[] = [];

  if (!user.role || user.role !== "ADMIN") {
    conditions.push(
      Prisma.sql`("Task"."assigneeId" = ${user.id} OR "Matter"."ownerId" = ${user.id})`,
    );
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(
      Prisma.sql`(("Task"."title" ILIKE ${like}) OR ("Task"."description" ILIKE ${like}))`,
    );
  }

  if (filters.matterId) {
    conditions.push(Prisma.sql`"Task"."matterId" = ${filters.matterId}`);
  }

  if (filters.assigneeId) {
    conditions.push(Prisma.sql`"Task"."assigneeId" = ${filters.assigneeId}`);
  }

  if (filters.status) {
    conditions.push(Prisma.sql`"Task"."status" = ${filters.status}`);
  }

  if (filters.priority) {
    conditions.push(Prisma.sql`"Task"."priority" = ${filters.priority}`);
  }

  if (filters.dueFrom) {
    conditions.push(Prisma.sql`"Task"."dueAt" >= ${filters.dueFrom}`);
  }

  if (filters.dueTo) {
    conditions.push(Prisma.sql`"Task"."dueAt" <= ${filters.dueTo}`);
  }

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.sql``;

  const rows = await prisma.$queryRaw<LegacyTaskRow[]>(
    Prisma.sql`
      ${LEGACY_SELECT_COLUMNS}
      ${LEGACY_BASE_FROM}
      ${whereClause}
      ORDER BY "Task"."dueAt" ASC NULLS LAST, "Task"."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `,
  );

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      ${LEGACY_BASE_FROM}
      ${whereClause}
    `,
  );

  const items = rows.map(mapLegacyTaskRow);

  return {
    items,
    total: Number(count),
    fallback: true,
  };
}

async function createLegacyTask(
  user: SessionUser,
  payload: TaskCreateInput,
) {
  const id = randomUUID();
  const now = new Date();
  const assigneeId = payload.assigneeId ?? user.id;
  const matterId = payload.matterId ?? null;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "Task" (
        "id",
        "matterId",
        "assigneeId",
        "title",
        "description",
        "dueAt",
        "priority",
        "status",
        "createdAt"
      )
      VALUES (
        ${id},
        ${matterId},
        ${assigneeId ?? null},
        ${payload.title},
        ${payload.description ?? null},
        ${payload.dueAt ?? null},
        ${payload.priority ?? "MEDIUM"},
        ${payload.status ?? "OPEN"},
        ${now}
      )
    `,
  );

  const [row] = await prisma.$queryRaw<LegacyTaskRow[]>(
    Prisma.sql`
      ${LEGACY_SELECT_COLUMNS}
      ${LEGACY_BASE_FROM}
      WHERE "Task"."id" = ${id}
      LIMIT 1
    `,
  );

  if (!row) {
    throw new Error("Failed to load legacy task after insert");
  }

  return mapLegacyTaskRow(row);
}

export const GET = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;
  const rawQuery = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { page, pageSize, ...filters } = taskQuerySchema.parse(rawQuery);
  const skip = (page - 1) * pageSize;

  const whereClauses = [
    buildAccessFilter(user),
    buildTaskFilters(filters),
  ].filter(Boolean) as Prisma.TaskWhereInput[];

  const where: Prisma.TaskWhereInput =
    whereClauses.length > 1
      ? { AND: whereClauses }
      : whereClauses[0] ?? {};

  try {
    const [items, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          updatedAt: true,
          reminderNotified: true,
          reminderNotifiedAt: true,
          assigneeId: true,
          matterId: true,
          assignee: { select: { id: true, name: true, email: true } },
          matter: { select: { id: true, title: true, ownerId: true } },
          _count: {
            select: {
              checklists: true,
              links: true,
            },
          },
        },
        orderBy: [
          { dueAt: "asc" },
          { createdAt: "desc" },
        ],
        take: pageSize,
        skip,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      page,
      pageSize,
      total,
      items,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      const legacy = await fetchLegacyTasks({
        user,
        filters,
        pageSize,
        skip,
      });

      return NextResponse.json({
        page,
        pageSize,
        total: legacy.total,
        items: legacy.items,
        meta: { legacy: true },
      });
    }

    throw error;
  }
});

export const POST = withApiHandler(
  async (req: NextRequest, { session }) => {
    const user = session!.user!;
    const payload = taskCreateSchema.parse(await req.json());

    await ensureCanCreateTask(user, payload);

    let task:
      | Awaited<ReturnType<typeof prisma.task.create>>
      | ReturnType<typeof mapLegacyTaskRow>;

    try {
      task = await prisma.task.create({
        data: {
          title: payload.title,
          description: payload.description,
          matterId: payload.matterId ?? undefined,
          assigneeId: payload.assigneeId ?? user.id,
          dueAt: payload.dueAt ?? undefined,
          priority: payload.priority,
          status: payload.status,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        task = await createLegacyTask(user, payload);
      } else {
        throw error;
      }
    }

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      metadata: {
        title: task.title,
        matterId: task.matterId,
        assigneeId: task.assigneeId,
        priority: task.priority,
        status: task.status,
      },
    });

    return NextResponse.json(task, { status: 201 });
  },
  { requireAuth: true },
);
