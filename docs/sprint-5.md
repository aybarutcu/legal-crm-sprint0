# Sprint 5 – Tasks, Checklists & Workflows (v1)

## Goal & Outcomes
- Robust task management with full CRUD, assignments, priorities, due dates, and status transitions surfaced through API + UI.
- Dual task views (Kanban + List) supporting filters, bulk actions, quick edits, and drag & drop.
- Reminder engine with email notifications (optionally extendable to in‑app bell feed).
- Nested checklists and task attachments for documents/events/URLs.
- Workflow templates that generate reusable task/checklist trees per matter and persist their instances.
- RBAC-aware audit trails and dashboard widgets showing my tasks + overdue counts.

## Data Model Extensions
- `task_checklists`: `{ id, taskId, title, done:boolean, order:int }`
- `task_links`: `{ id, taskId, documentId?, eventId?, url? }` (optional for Sprint 5)
- `workflow_templates`: `{ id, name, description? }`
- `workflow_steps`: `{ id, templateId, title, description?, order:int, type:'task'|'checklist' }`
- `workflow_instances`: `{ id, templateId, matterId, createdBy }`
- `workflow_instance_steps`: `{ id, instanceId, stepId, taskId? }`
- Consider lean alternative: store template steps as JSON, map to tasks on instantiation.

## API Surface
- `GET    /api/tasks` with filters: `q, matterId, assigneeId, status, priority, dueFrom, dueTo, page, pageSize`
- `POST   /api/tasks` create task payload
- `GET    /api/tasks/[id]`
- `PATCH  /api/tasks/[id]` status transitions, reassignment, due date, priority, metadata updates
- `DELETE /api/tasks/[id]`
- `POST   /api/tasks/[id]/checklists` add checklist item
- `PATCH  /api/tasks/checklists/[checkId]` update/toggle/order checklist item
- `POST   /api/tasks/[id]/links` create attachment link
- `DELETE /api/tasks/links/[linkId]`

Workflow template APIs:
- `GET    /api/workflows/templates`
- `POST   /api/workflows/templates` create/update step arrays
- `PATCH  /api/workflows/templates/[id]`
- `DELETE /api/workflows/templates/[id]`
- `POST   /api/workflows/templates/[id]/instantiate { matterId }` → returns workflow instance + generated tasks
- `GET    /api/workflows/instances?matterId=`
- `GET    /api/workflows/instances/[id]`

## UI Deliverables
- `/tasks` page with tabs `All | My Tasks | Overdue | Upcoming`.
- Filter panel: matter, assignee, status, priority, due range, free text `q`.
- Views: Kanban (columns `OPEN | IN_PROGRESS | DONE | CANCELED`, drag & drop) and List (inline edits for status/assignee/due date).
- Dialogs: Create/Edit Task, Add Checklist Item, Link Document/Event.
- Bulk actions: mass reassignment, status change, due date updates.
- `/workflows/templates` list + editor with step rows and drag ordering.
- Matter detail: “Add Workflow” dialog to instantiate templates; tasks tab groups items by workflow instance.
- Dashboard tiles for My Tasks (due ≤7 days) and Overdue counts; quick-create affordance.

## Reminders, RBAC & Audit
- Scheduler scans every minute for tasks where `dueAt - now ≤ DEFAULT_REMINDER_MINUTES` and `notified=false`; sends email via SMTP and flips flag (ensure locking/throttling).
- Optional in-app notification bell showing latest 20 task events.
- RBAC: Admin = full read/write; Lawyer = limited by team/matter; Paralegal = assigned tasks or matter team.
- Write operations allowed for assignee, matter owner, Admin.
- Audit log entries for every create/update/delete capturing changed fields and actor.

## Acceptance Criteria
- Task creation/update validates input; invalid payloads return 422 with error details.
- Kanban drag & drop persists status on server and reflects in UI after drop.
- Checklist toggles respond instantly; order is maintained when reordering.
- Workflow instantiation generates tasks in defined order under selected matter.
- Reminder emails send once per task when threshold met; no duplicates.
- Dashboard counts for My Tasks and Overdue reflect API filters accurately.

## Testing & Performance
- **Unit:** Zod schemas, status transition rules, checklist ordering helpers.
- **API:** CRUD, filters, pagination, auth (401/403), validation (422).
- **E2E:** Task creation visible in List/Kanban, inline edits, checklist toggle, workflow instantiation, overdue/upcoming filters.
- **Performance:** `/api/tasks` P95 < 500 ms with 10k tasks; ensure indexed columns.

## Risks & Mitigations
- Over-notification → throttle reminders and mark `notified=true` within transactional lock.
- Kanban drag & drop race conditions → optimistic UI + server reconciliation safeguards.
- Workflow template drift → lock template revision after instantiation; plan for versioning later.

## Backlog Breakdown
1. `TASK-001` Zod schemas for Task & Checklist (validation + shared types).
2. `TASK-002` Task CRUD endpoints, filters, audit logging.
3. `TASK-003` Checklist & Link endpoints.
4. `TASK-004` Tasks List UI with filters + inline edit.
5. `TASK-005` Tasks Kanban UI with drag & drop.
6. `WF-001` Workflow template CRUD (API + editor UI).
7. `WF-002` Template instantiation → generate tasks for matter.
8. `REM-001` Reminder worker (email delivery + dedupe).
9. `DASH-003` Dashboard cards for task metrics.
10. `TEST-003` Unit/API/E2E coverage for tasks & workflows.
11. `OBS-003` Metrics for reminders and Kanban moves.
