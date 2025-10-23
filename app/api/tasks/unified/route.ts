import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { TaskQuery, TaskStatusValue } from "@/lib/tasks/types";

/**
 * GET /api/tasks/unified
 * 
 * Fetches tasks assigned to the current user from TWO sources:
 * 
 * 1. STANDALONE TASKS (Task model):
 *    - Tasks directly assigned to user
 *    - Tasks in matters where user is owner or team member
 * 
 * 2. WORKFLOW STEPS (WorkflowInstanceStep model):
 *    - Steps matching user's role in matter teams
 *    - Steps from contacts owned by user
 *    - Steps directly assigned/claimed by user
 * 
 * Both are combined, sorted, and paginated together.
 */
export const GET = withApiHandler(async (req, { session }) => {
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  if (!userId || !userRole) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  
  const query: TaskQuery = {
    page,
    pageSize,
    q: url.searchParams.get("q") || undefined,
    matterId: url.searchParams.get("matterId") || undefined,
    assigneeId: url.searchParams.get("assigneeId") || undefined,
    status: url.searchParams.get("status") as TaskStatusValue || undefined,
    priority: url.searchParams.get("priority") as TaskQuery["priority"] || undefined,
    dueFrom: url.searchParams.get("dueFrom") ? new Date(url.searchParams.get("dueFrom")!) : undefined,
    dueTo: url.searchParams.get("dueTo") ? new Date(url.searchParams.get("dueTo")!) : undefined,
  };

  // Find all matters where the user is a team member or owner
  const matterTeamMemberships = await prisma.matterTeamMember.findMany({
    where: { userId },
    select: { matterId: true, role: true },
  });
  const matterIds = matterTeamMemberships.map(m => m.matterId);

  // Find all contacts owned by the user
  const ownedContacts = await prisma.contact.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const contactIds = ownedContacts.map(c => c.id);

  // ===================================================================
  // PART 1: Fetch STANDALONE TASKS (Task model)
  // ===================================================================
  
  let taskWhere: Record<string, unknown>;

  if (userRole === "ADMIN") {
    // ADMIN sees ALL tasks (no filtering)
    taskWhere = {};
  } else {
    // Non-admin users see tasks they're involved with
    taskWhere = {
      OR: [
        // Tasks assigned to user
        { assigneeId: userId },
        // Tasks in matters owned by user
        { matter: { ownerId: userId } },
        // Tasks in matters where user is team member
        ...(matterIds.length > 0 ? [{ matterId: { in: matterIds } }] : []),
      ],
    };
  }

  if (query.q) {
    taskWhere.AND = [
      ...(taskWhere.AND as [] || []),
      {
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (query.matterId) {
    taskWhere.matterId = query.matterId;
  }

  if (query.assigneeId) {
    taskWhere.assigneeId = query.assigneeId;
  }

  if (query.status) {
    taskWhere.status = query.status;
  }

  if (query.priority) {
    taskWhere.priority = query.priority;
  }

  if (query.dueFrom || query.dueTo) {
    const dueAt: Record<string, unknown> = {};
    if (query.dueFrom) dueAt.gte = query.dueFrom;
    if (query.dueTo) dueAt.lte = query.dueTo;
    taskWhere.dueAt = dueAt;
  }

  const standaloneTasks = await prisma.task.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: taskWhere as any,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      matter: { select: { id: true, title: true } },
    },
    orderBy: [
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
  });

  // ===================================================================
  // PART 2: Fetch WORKFLOW STEPS (WorkflowInstanceStep model)
  // ===================================================================

  let stepWhere: Record<string, unknown>;

  if (userRole === "ADMIN") {
    // ADMIN sees ALL workflow steps (no filtering by role or assignment)
    stepWhere = {};
  } else {
    // Non-admin users see steps based on role, assignment, or contact ownership
    stepWhere = {
      OR: [
        // Steps from matter teams matching role scope
        ...(matterIds.length > 0 ? [{
          instance: {
            matterId: { in: matterIds },
          },
          roleScope: { in: [userRole] },
        }] : []),
        // Steps from contacts owned by user (LEAD workflows)
        ...(contactIds.length > 0 ? [{
          instance: {
            contactId: { in: contactIds },
          },
        }] : []),
        // Steps directly assigned to user (claimed tasks)
        {
          assignedToId: userId,
        },
      ],
    };
  }

  // Add filters that apply to the OR conditions above
  const stepFilters: Record<string, unknown>[] = [];

  if (query.q) {
    stepFilters.push({
      title: { contains: query.q, mode: "insensitive" }
    });
  }

  if (query.matterId) {
    stepFilters.push({
      instance: { matterId: query.matterId }
    });
  }

  if (query.assigneeId) {
    stepFilters.push({
      assignedToId: query.assigneeId
    });
  }

  // Filter by action state (map from task status)
  if (query.status) {
    const stateMap: Record<TaskStatusValue, string[]> = {
      "OPEN": ["READY", "PENDING"],
      "IN_PROGRESS": ["IN_PROGRESS"],
      "DONE": ["COMPLETED"],
      "CANCELED": ["SKIPPED", "FAILED"],
    };
    stepFilters.push({
      actionState: { in: stateMap[query.status] }
    });
  }

  if (query.priority) {
    stepFilters.push({
      priority: query.priority
    });
  }

  if (query.dueFrom || query.dueTo) {
    const dueDate: Record<string, unknown> = {};
    if (query.dueFrom) dueDate.gte = query.dueFrom;
    if (query.dueTo) dueDate.lte = query.dueTo;
    stepFilters.push({
      dueDate: dueDate
    });
  }

  // Combine base OR conditions with AND filters
  if (stepFilters.length > 0) {
    stepWhere.AND = stepFilters;
  }

  const workflowSteps = await prisma.workflowInstanceStep.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: stepWhere as any,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      instance: {
        include: {
          matter: { select: { id: true, title: true } },
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - contact relation exists
          contact: { select: { id: true, firstName: true, lastName: true, type: true } },
          template: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { dueDate: "asc" },
      { createdAt: "asc" },
    ],
  });

  // ===================================================================
  // PART 3: Transform and combine both sources
  // ===================================================================

  // Transform standalone tasks
  const transformedTasks = standaloneTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description || "",
    dueAt: task.dueAt?.toISOString() || null,
    priority: task.priority || "MEDIUM",
    status: task.status,
    assignee: task.assignee,
    matter: task.matter,
    contact: null,
    _count: { checklists: 0, links: 0 },
    itemType: 'TASK' as const,
    createdAt: task.createdAt,
  }));

  // Transform workflow steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformedSteps = workflowSteps.map((item: any) => {
    // Map actionState to task status
    let status: TaskStatusValue = "OPEN";
    if (["READY", "PENDING"].includes(item.actionState)) status = "OPEN";
    else if (item.actionState === "IN_PROGRESS") status = "IN_PROGRESS";
    else if (item.actionState === "COMPLETED") status = "DONE";
    else if (["SKIPPED", "FAILED"].includes(item.actionState)) status = "CANCELED";

    // Build title based on workflow type
    let contextTitle = "";
    if (item.instance.contact) {
      const contact = item.instance.contact;
      contextTitle = `${contact.firstName} ${contact.lastName} (${contact.type})`;
    } else if (item.instance.matter) {
      contextTitle = item.instance.matter.title;
    }

    return {
      id: item.id,
      title: item.title,
      description: item.notes || null,
      dueAt: item.dueDate?.toISOString() || null,
      priority: item.priority || "MEDIUM",
      status,
      assignee: item.assignedTo, // Map assignedTo to assignee for consistency
      assigneeId: item.assignedToId, // Include assigneeId for list view
      matter: item.instance.matter,
      contact: item.instance.contact,
      _count: { checklists: 0, links: 0 },
      itemType: 'WORKFLOW_STEP' as const,
      actionType: item.actionType,
      roleScope: item.roleScope,
      actionState: item.actionState,
      workflowName: item.instance.template?.name || "Ad-hoc Workflow",
      contextTitle,
      instanceId: item.instance.id,
      createdAt: item.createdAt,
    };
  });

  // Combine and sort
  const allItems = [...transformedTasks, ...transformedSteps].sort((a, b) => {
    // Sort by due date (nulls last), then by created date desc
    const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    
    if (aDate !== bDate) {
      return aDate - bDate;
    }
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Paginate
  const total = allItems.length;
  const skip = (page - 1) * pageSize;
  const paginatedItems = allItems.slice(skip, skip + pageSize);

  return NextResponse.json({
    items: paginatedItems,
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
}, { requireAuth: true });
