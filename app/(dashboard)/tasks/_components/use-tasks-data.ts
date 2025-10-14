"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import addDays from "date-fns/addDays";
import {
  createChecklistItem,
  createTask,
  createTaskLink,
  deleteTask,
  deleteTaskLink,
  listUnifiedTasks as listTasks,
  updateChecklistItem,
  updateTask,
} from "@/lib/tasks/client";
import { incrementMetric } from "@/lib/metrics";
import type {
  CreateChecklistPayload,
  CreateLinkPayload,
  CreateTaskPayload,
  TaskListItem,
  TaskListResponse,
  TaskPriorityValue,
  TaskQuery,
  TaskStatusValue,
  UpdateChecklistPayload,
  UpdateTaskPayload,
} from "@/lib/tasks/types";

export type TaskTab = "all" | "mine" | "overdue" | "upcoming";

export type TaskFilterState = {
  q?: string;
  matterId?: string;
  assigneeId?: string;
  status?: TaskStatusValue | "ALL";
  priority?: TaskPriorityValue | "ALL";
  dueFrom?: string | null;
  dueTo?: string | null;
};

export type TaskQueryState = {
  tab: TaskTab;
  page: number;
  pageSize: number;
  filters: TaskFilterState;
};

export type UseTasksOptions = {
  state: TaskQueryState;
  currentUserId?: string;
};

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function deriveQuery({
  state,
  currentUserId,
}: UseTasksOptions): TaskQuery {
  const base: TaskQuery = {
    page: state.page,
    pageSize: state.pageSize,
  };
  const { filters } = state;

  if (filters.q) base.q = filters.q;
  if (filters.matterId) base.matterId = filters.matterId;
  if (filters.assigneeId) base.assigneeId = filters.assigneeId;
  if (filters.status && filters.status !== "ALL") base.status = filters.status;
  if (filters.priority && filters.priority !== "ALL") {
    base.priority = filters.priority;
  }

  const dueFrom = parseDate(filters.dueFrom);
  const dueTo = parseDate(filters.dueTo);
  if (dueFrom) base.dueFrom = dueFrom;
  if (dueTo) base.dueTo = dueTo;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (state.tab) {
    case "mine": {
      base.assigneeId = filters.assigneeId || currentUserId;
      break;
    }
    case "overdue": {
      base.dueTo = dueTo ?? now;
      break;
    }
    case "upcoming": {
      const upcomingFrom = dueFrom ?? now;
      const upcomingTo = dueTo ?? addDays(upcomingFrom, 7);
      base.dueFrom = upcomingFrom;
      base.dueTo = upcomingTo;
      break;
    }
    default:
      break;
  }

  return base;
}

export function useTasksData({ state, currentUserId }: UseTasksOptions) {
  const { tab, page, pageSize, filters } = state;
  const query = useMemo(
    () =>
      deriveQuery({
        state: {
          tab,
          page,
          pageSize,
          filters,
        },
        currentUserId,
      }),
    [currentUserId, filters, page, pageSize, tab],
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    TaskListResponse,
    Error,
    [string, TaskQuery]
  >(
    ["tasks/unified", query],
    ([, params]) => listTasks(params),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  const handleCreate = useCallback(
    async (payload: CreateTaskPayload) => {
      const result = await createTask(payload);
      await mutate();
      return result;
    },
    [mutate],
  );

  const handleUpdate = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      const result = await updateTask(taskId, payload);
      if (payload.status) {
        incrementMetric("task_kanban_moves");
      }
      await mutate();
      return result;
    },
    [mutate],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId);
      await mutate();
    },
    [mutate],
  );

  const handleChecklistCreate = useCallback(
    async (taskId: string, payload: CreateChecklistPayload) => {
      const result = await createChecklistItem(taskId, payload);
      await mutate();
      return result;
    },
    [mutate],
  );

  const handleChecklistUpdate = useCallback(
    async (checklistId: string, payload: UpdateChecklistPayload) => {
      const result = await updateChecklistItem(checklistId, payload);
      await mutate();
      return result;
    },
    [mutate],
  );

  const handleLinkCreate = useCallback(
    async (taskId: string, payload: CreateLinkPayload) => {
      const result = await createTaskLink(taskId, payload);
      await mutate();
      return result;
    },
    [mutate],
  );

  const handleLinkDelete = useCallback(
    async (linkId: string) => {
      await deleteTaskLink(linkId);
      await mutate();
    },
    [mutate],
  );

  return {
    data: data?.items ?? [],
    meta: {
      page: data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
      total: data?.total ?? 0,
    },
    isLoading,
    isValidating,
    error,
    refresh,
    mutate,
    createTask: handleCreate,
    updateTask: handleUpdate,
    deleteTask: handleDelete,
    createChecklist: handleChecklistCreate,
    updateChecklist: handleChecklistUpdate,
    createLink: handleLinkCreate,
    deleteLink: handleLinkDelete,
  };
}

export type UseTasksResult = ReturnType<typeof useTasksData> & {
  data: TaskListItem[];
};