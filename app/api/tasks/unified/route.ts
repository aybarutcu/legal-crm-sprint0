import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { TaskQuery, TaskStatusValue, TASK_STATUSES } from "@/lib/tasks/types";
import { Role } from "@prisma/client";

async function getTasks(query: TaskQuery) {
  const where: any = {};
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.matterId) where.matterId = query.matterId;
  if (query.assigneeId) where.assigneeId = query.assigneeId;
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.dueFrom) where.dueAt = { ...where.dueAt, gte: query.dueFrom };
  if (query.dueTo) where.dueAt = { ...where.dueAt, lte: query.dueTo };

  const [total, items] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        matter: { select: { id: true, title: true } },
        _count: { select: { checklists: true, links: true } },
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: items.map(t => ({...t, itemType: 'TASK'})), total };
}

async function getWorkflowSteps(query: TaskQuery) {
  const where: any = {};
  if (query.q) {
    where.title = { contains: query.q, mode: "insensitive" };
  }
  if (query.matterId) where.instance = { matterId: query.matterId };
  if (query.assigneeId) where.assignedToId = query.assigneeId;
  if (query.status) {
    const stateMap: Record<TaskStatusValue, any> = {
      "OPEN": ["READY", "PENDING"],
      "IN_PROGRESS": ["IN_PROGRESS"],
      "DONE": ["COMPLETED"],
      "CANCELED": ["SKIPPED", "FAILED"],
    };
    where.actionState = { in: stateMap[query.status] };
  }

  const [total, items] = await prisma.$transaction([
    prisma.workflowInstanceStep.count({ where }),
    prisma.workflowInstanceStep.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        instance: { include: { matter: { select: { id: true, title: true } } } },
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const transformedItems = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: `Workflow Action: ${item.actionType}`,
    dueAt: item.createdAt.toISOString(), // Or some other date logic
    priority: "MEDIUM",
    status: (Object.entries({
      "OPEN": ["READY", "PENDING"],
      "IN_PROGRESS": ["IN_PROGRESS"],
      "DONE": ["COMPLETED"],
      "CANCELED": ["SKIPPED", "FAILED"],
    }).find(([, states]) => states.includes(item.actionState))?.[0] || "OPEN") as TaskStatusValue,
    assignee: item.assignedTo,
    matter: item.instance.matter,
    _count: { checklists: 0, links: 0 },
    itemType: 'WORKFLOW_STEP',
    actionType: item.actionType,
    roleScope: item.roleScope,
  }));

  return { items: transformedItems, total };
}

export const GET = withApiHandler(async (req) => {
  const url = new URL(req.url);
  const query: TaskQuery = {
    page: parseInt(url.searchParams.get("page") || "1"),
    pageSize: parseInt(url.searchParams.get("pageSize") || "20"),
    q: url.searchParams.get("q") || undefined,
    matterId: url.searchParams.get("matterId") || undefined,
    assigneeId: url.searchParams.get("assigneeId") || undefined,
    status: url.searchParams.get("status") as TaskStatusValue || undefined,
    priority: url.searchParams.get("priority") as any || undefined,
    dueFrom: url.searchParams.get("dueFrom") ? new Date(url.searchParams.get("dueFrom")!) : undefined,
    dueTo: url.searchParams.get("dueTo") ? new Date(url.searchParams.get("dueTo")!) : undefined,
  };

  const [tasksResult, workflowsResult] = await Promise.all([
    getTasks(query),
    getWorkflowSteps(query),
  ]);

  const combinedItems = [...tasksResult.items, ...workflowsResult.items];
  const total = tasksResult.total + workflowsResult.total;

  return NextResponse.json({
    items: combinedItems,
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
});