export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export type TaskAssignee = {
  id: string;
  name: string | null;
  email: string | null;
};

export type TaskMatter = {
  id: string;
  title: string;
  ownerId: string | null;
};

export type TaskCounts = {
  checklists: number;
  links: number;
};

export type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  reminderNotified: boolean;
  reminderNotifiedAt: string | null;
  assigneeId: string | null;
  matterId: string | null;
  assignee: TaskAssignee | null;
  matter: TaskMatter | null;
  _count: TaskCounts;
};

export type TaskChecklistItem = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskLinkItem = {
  id: string;
  taskId: string;
  documentId: string | null;
  eventId: string | null;
  url: string | null;
  createdAt: string;
};

export type TaskDetail = TaskListItem & {
  checklists: TaskChecklistItem[];
  links: TaskLinkItem[];
};

export type TaskListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: TaskListItem[];
};

export type TaskFilters = {
  q?: string;
  matterId?: string;
  assigneeId?: string;
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  dueFrom?: Date;
  dueTo?: Date;
};

export type TaskQuery = TaskFilters & {
  page?: number;
  pageSize?: number;
};

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  matterId?: string | null;
  assigneeId?: string | null;
  dueAt?: Date | null;
  priority?: TaskPriorityValue;
  status?: TaskStatusValue;
};

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

export type CreateChecklistPayload = {
  title: string;
};

export type UpdateChecklistPayload = Partial<{
  title: string;
  done: boolean;
  order: number;
}>;

export type CreateLinkPayload = {
  documentId?: string;
  eventId?: string;
  url?: string;
};
