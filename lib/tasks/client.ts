import {
  type CreateChecklistPayload,
  type CreateLinkPayload,
  type CreateTaskPayload,
  type TaskChecklistItem,
  type TaskDetail,
  type TaskLinkItem,
  type TaskListResponse,
  type TaskQuery,
  type UpdateChecklistPayload,
  type UpdateTaskPayload,
} from "@/lib/tasks/types";

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return undefined as T;
}

async function request<T>(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<T> {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      if (typeof payload?.error === "string") {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parse errors
    }

    const error = new Error(message);
    // @ts-expect-error attach status for upstream handling
    error.status = response.status;
    throw error;
  }

  return parseResponse<T>(response);
}

function buildQueryString(query: TaskQuery = {}) {
  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);
  if (query.matterId) params.set("matterId", query.matterId);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.dueFrom) params.set("dueFrom", query.dueFrom.toISOString());
  if (query.dueTo) params.set("dueTo", query.dueTo.toISOString());
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));

  return params.toString();
}

export async function listTasks(query: TaskQuery = {}) {
  const qs = buildQueryString(query);
  return request<TaskListResponse>(`/api/tasks?${qs}`);
}

export async function getTask(taskId: string) {
  return request<TaskDetail>(`/api/tasks/${taskId}`);
}

export async function createTask(payload: CreateTaskPayload) {
  return request<TaskDetail>("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      dueAt: payload.dueAt ? payload.dueAt.toISOString() : null,
    }),
  });
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload) {
  return request<TaskDetail>(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      dueAt:
        payload.dueAt === undefined
          ? undefined
          : payload.dueAt
            ? payload.dueAt.toISOString()
            : null,
    }),
  });
}

export async function deleteTask(taskId: string) {
  await request<undefined>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function createChecklistItem(
  taskId: string,
  payload: CreateChecklistPayload,
) {
  return request<TaskChecklistItem>(`/api/tasks/${taskId}/checklists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateChecklistItem(
  checklistId: string,
  payload: UpdateChecklistPayload,
) {
  return request<TaskChecklistItem>(`/api/tasks/checklists/${checklistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createTaskLink(taskId: string, payload: CreateLinkPayload) {
  return request<TaskLinkItem>(`/api/tasks/${taskId}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteTaskLink(linkId: string) {
  await request<undefined>(`/api/tasks/links/${linkId}`, {
    method: "DELETE",
  });
}
