import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { TaskStatus } from "@prisma/client";

type OverviewParams = { ownerId?: string };

export const GET = withApiHandler<OverviewParams>(
  async (req, { session }) => {
    const ownerIdParam = req.nextUrl.searchParams.get("ownerId");
    const ownerRole = session!.user!.role;
    const ownerId =
      ownerIdParam && ownerRole === "ADMIN"
        ? ownerIdParam
        : session!.user!.id;

    const now = new Date();
    const upcomingWindow = addDays(now, 7);

    const activeTaskWhere = {
      assigneeId: ownerId,
      status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
    };

    const [events, tasks, documents, openMatters, matters, upcomingTaskCount, overdueTaskCount] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizerId: ownerId,
          startAt: { gte: now, lte: upcomingWindow },
        },
        orderBy: { startAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          startAt: true,
          location: true,
        },
      }),
      prisma.task.findMany({
        where: {
          ...activeTaskWhere,
          dueAt: { not: null, gte: now, lte: upcomingWindow },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          dueAt: true,
          priority: true,
        },
      }),
      prisma.document.findMany({
        where: { uploaderId: ownerId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          filename: true,
          createdAt: true,
          matter: { select: { id: true, title: true } },
        },
      }),
      prisma.matter.count({
        where: {
          status: "OPEN",
          ownerId,
        },
      }),
      prisma.matter.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          ownerId,
        },
      }),
      prisma.task.count({
        where: {
          ...activeTaskWhere,
          dueAt: { not: null, gte: now, lte: upcomingWindow },
        },
      }),
      prisma.task.count({
        where: {
          ...activeTaskWhere,
          dueAt: { not: null, lt: now },
        },
      }),
    ]);

    return NextResponse.json({
      events,
      tasks,
      documents,
      openMatters,
      mattersOpenCount: matters,
      tasksDueSoon: upcomingTaskCount,
      tasksOverdue: overdueTaskCount,
    });
  },
);
