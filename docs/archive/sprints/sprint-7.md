# Sprint 7 – Workflow Engine Foundations

## Goal & Outcomes
- Deliver a workflow engine that models templates, instantiates matter-level workflows, and tracks typed actions end to end.
- Provide pluggable action handlers with consistent state transitions, audit logging, and metrics to support future automation.
- Expose CRUD + execution APIs guarded by role-aware permissions, with UI flows for template authoring and instance management.
- Ship documentation, OpenAPI updates, and a demo workflow that proves template → instance → execution across action types.

## Architecture & Scope
- Introduce workflow template/instance tables with versioning, role scopes, and step state tracking; migrate via Prisma.
- Build a domain layer (`lib/workflows/*`) housing enums, action registry, handlers, and transition guards emitting metrics/events.
- Expose REST routes under `/api/workflows/**` for templates, instances, steps, and execution hooks; add webhooks for future providers.
- Provide internal UI for template builder and matter-level workflow runner, plus READY-state notifications using existing queues.
- All state mutations (DB, API, UI) must record audit entries, respect RBAC, and surface in OpenAPI + ADR documentation.

## Data Model & Persistence (EPIC A)
- Prisma migration creating:
  - `workflow_templates(id, name, description, version, isActive, createdById, createdAt)`
  - `workflow_template_steps(id, templateId, order, title, actionType, actionConfig JSONB, roleScope ENUM, required BOOLEAN DEFAULT true)`
  - `workflow_instances(id, templateId, matterId, templateVersion, createdById, status, createdAt)`
  - `workflow_instance_steps(id, instanceId, templateStepId, order, title, actionType, roleScope, actionState, actionData JSONB, assignedToId?, startedAt?, completedAt?, updatedAt)`
- Enums:
  - `actionType ∈ { APPROVAL, SIGNATURE, REQUEST_DOC, PAYMENT, CHECKLIST }`
  - `roleScope ∈ { ADMIN, LAWYER, PARALEGAL, CLIENT }`
  - `workflow_instances.status ∈ { DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELED }`
  - `workflow_instance_steps.actionState ∈ { PENDING, READY, IN_PROGRESS, BLOCKED, COMPLETED, FAILED, SKIPPED }`
- Constraints & indexes:
  - Unique `(templateId, order)` on template steps.
  - Index `workflow_instance_steps(instanceId, actionState)`.
  - Index `workflow_instances(matterId, status)`.
- Seed script inserts a demo template spanning all action types to validate migrations and handler wiring.

## Domain & Execution Abstractions (EPIC B)
- ✅ Define enums and runtime types in `lib/workflows/types.ts`; export `ActionType`, `ActionState`, `WorkflowStatus`, role scopes.
- ✅ Action handler contract and registry:

```ts
export interface IActionHandler<TConfig = unknown, TData = unknown> {
  type: ActionType;
  validateConfig(config: TConfig): void;
  canStart(ctx: ActionContext<TConfig, TData>): boolean;
  start(ctx: ActionContext<TConfig, TData>): Promise<void>;
  complete(ctx: ActionContext<TConfig, TData>, payload?: unknown): Promise<void>;
  fail(ctx: ActionContext<TConfig, TData>, reason: string): Promise<void>;
  getNextStateOnEvent(ctx: ActionContext<TConfig, TData>, event: ActionEvent): ActionState;
}
```
- ✅ `ActionRegistry` supports `register(type, handler)` and runtime `getHandler(type)` lookups; default handlers registered via `registerDefaultWorkflowHandlers()`.
- ✅ Build state machine utilities enforcing transitions:
  - `PENDING → READY` when prerequisites satisfied.
  - `READY → IN_PROGRESS` when eligible performer claims.
  - `IN_PROGRESS → COMPLETED | FAILED | BLOCKED`.
  - `READY|IN_PROGRESS → SKIPPED` (admin only).
- ✅ Runtime helpers in `lib/workflows/runtime.ts` apply transitions, append history, and invoke handlers consistently.
- Central guard functions wrap handler calls, emit domain events, log audits, and push metrics counters/timers.

## API Surface (EPIC C)
- Templates CRUD:
  - `GET /api/workflows/templates?q=...`
  - `POST /api/workflows/templates`
  - `GET /api/workflows/templates/:id`
  - `PATCH /api/workflows/templates/:id`
  - `POST /api/workflows/templates/:id/publish`
- ✅ Instantiate to matter:
  - `POST /api/workflows/templates/:id/instantiate { matterId }`
  - First eligible steps become `READY`, remaining set to `PENDING`.
- ✅ Instance management:
  - `GET /api/workflows/instances?matterId=...`
  - `GET /api/workflows/instances/:id`
  - `PATCH /api/workflows/instances/:id` (rename, pause, cancel)
  - `POST /api/workflows/instances/:id/steps`
  - `PATCH /api/workflows/instances/:id/steps/:stepId`
  - `DELETE /api/workflows/instances/:id/steps/:stepId`
- ✅ Step execution endpoints:
  - `POST /api/workflows/steps/:id/claim`
  - `POST /api/workflows/steps/:id/start`
  - `POST /api/workflows/steps/:id/complete`
  - `POST /api/workflows/steps/:id/fail`
  - `POST /api/workflows/steps/:id/skip`
  - `POST /api/workflows/instances/:id/advance`
- Webhooks (stubs):
  - `POST /api/webhooks/esign/*`
  - `POST /api/webhooks/payments/*`
  - `POST /api/webhooks/uploads/*`
- All routes validated with Zod schemas, enforce RBAC, and record audit entries.

## Permissions & Role Resolution (EPIC D)
- ✅ Implement `resolveEligibleActors(instanceId, step)` mapping:
  - `ADMIN` → org admins.
  - `LAWYER` → matter owner + assigned lawyers.
  - `PARALEGAL` → paralegals on matter.
  - `CLIENT` → assigned client.
- Cache eligible actors per instance to limit repeated lookups; invalidate on assignment change.
- ✅ `canPerform(step, user)` utility used across claim/start/complete routes.
- Add RBAC middleware that checks session role, matter association, and step eligibility before allowing mutations.
- All step transitions append audit log events: actor, action, from→to state, metadata payload.

## UI Deliverables (EPIC E)
- ✅ `/workflows/templates` list with search, publish controls, and “Create Template” CTA.
- ✅ Template builder UI:
  - Step rows editable for title, action type, role scope, required flag.
  - Dynamic config inspector per action type (forms stubbed as needed).
  - Drag-and-drop ordering; preview panel showing resulting instance layout.
- Matter detail “Workflows” tab:
  - List workflow instances and allow creation from templates.
  - Instance editor (admin/owner lawyer): edit title/role/config, add/remove/reorder steps.
  - Run view for performers showing steps grouped by `READY`, `IN_PROGRESS`, `COMPLETED`.
  - Inline completion flow for `CHECKLIST`; placeholder UI for typed actions with proper messaging.
- Notifications: email/in-app triggered when a step enters `READY` for a user; respect feature flag and throttle.

## Action Handlers (EPIC F)
- ✅ Implement handler skeletons under `lib/workflows/handlers/*`:
  - **APPROVAL** – config `{ approverRole?, message? }`; complete payload `{ approved: boolean, comment?: string }`.
  - **SIGNATURE** – config `{ documentId, provider? }`; start generates mock signature session ID.
  - **REQUEST_DOC** – config `{ requestText, acceptedTypes? }`; start opens doc request stub.
  - **PAYMENT** – config `{ amount, currency, provider? }`; start creates mock payment intent.
  - **CHECKLIST** – minimal config; immediate start/complete path.
- ✅ Each handler validates config (Zod), updates step state/data, and maintains step history; external integrations mocked for now.

## Documentation & Observability (EPIC G)
- Update `docs/openapi.yaml` with new routes, request/response schemas, and examples.
- Author ADR: `docs/adr/xxxx-workflow-engine-architecture.md` covering action registry, state machine, and pluggable handlers.
- Dev guide: “Adding a new workflow action type” outlining required schema, handler, UI, and docs updates.
- Metrics:
  - Counters: steps completed/failed/skipped by `actionType`.
  - Histogram: cycle time per `actionType`.
  - Tracing spans wrapping step transitions and handler execution paths.

## Testing & QA (EPIC H)
- Unit tests:
  - Handler config validation and state transitions.
  - Transition guard functions ensure invalid moves rejected.
  - `canPerform` respects role + matter assignments.
- API tests:
  - Template create/publish/version flows.
  - Instantiate template → steps seeded with correct states.
  - Instance editing by admin/owner succeeds; others receive 403.
  - Checklist execution transitions next step to `READY`.
- E2E smoke (Playwright):
  - Create template with 3 steps → instantiate → run through CHECKLIST → APPROVAL → REQUEST_DOC (simulate upload stub).
  - Verify audit trail entries and notifications triggered.

## Milestones & Timeline
- **Day 2:** Prisma migration + seed template merged; migrations applied to staging.
- **Day 5:** Action engine, registry, handler skeletons, and state machine utilities with unit tests passing in CI.
- **Day 8:** Workflow APIs + RBAC + audit logging merged; OpenAPI regenerated.
- **Day 11:** UI flows (template builder + matter workflows) functional; READY notifications behind flag.
- **Day 12:** E2E smoke scenario green; ADR and metrics dashboards published.

## Risks & Mitigations
- Handler payload drift with UI/API contracts → schedule schema alignment review by Day 4.
- RBAC gaps blocking execution → prototype `canPerform` with fixtures early and validate with QA.
- Migration collisions with other DB work → coordinate merge window in #infra before landing migration PR.
- Notification load increase → gate behind feature flag and add throttling/backoff controls.
- Future provider integrations → encapsulate external calls, mock via adapters, and document extension points.

## Backlog Breakdown
- [x] `WF-101` Prisma migration for templates/instances/steps (+indexes)
- [x] `WF-102` ActionRegistry & `IActionHandler` interface + enums
- [x] `WF-103` Handler skeletons: Approval, Signature, RequestDoc, Payment, Checklist
- [x] `WF-104` State machine & transition guards + unit tests
- [x] `WF-105` Templates API (CRUD + publish/version)
- [x] `WF-106` Instantiate API (template→instance) with initial state resolver
- [x] `WF-107` Instance editing API (add/edit/remove/reorder steps) with RBAC
- [x] `WF-108` Step execution API (claim/start/complete/fail/skip/advance)
- [x] `WF-109` UI: Template Builder (list + editor + reorder)
- [x] `WF-110` UI: Matter → Workflow tab (runner + instance editor)
- [ ] `WF-111` Notifications on READY steps (email/in-app minimal)
- [ ] `WF-112` OpenAPI documentation update
- [ ] `WF-113` Observability: metrics + tracing for step transitions
- [ ] `WF-114` E2E smoke: 3-step demo workflow through completion
