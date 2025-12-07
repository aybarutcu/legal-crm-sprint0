# Sprint Plan – Workflow Automation Tasks

## Goal
Enable predefined workflow steps to execute automatically (e.g., send emails, fire webhooks, run scheduled tasks) without manual intervention, while preserving observability and control within the existing workflow system.

## Scope
- Extend action types (AUTOMATION_WEBHOOK + optional automated step types) for system-to-system work.
- Introduce a step-level notification policy that can emit email/SMS/push events via a shared bus.
- Stand up an event bus + worker path for automation jobs and notification fan-out (immediate and scheduled).
- Surface automation and notification status/logs in UI/API + provide manual override controls.

## Timeline (2 Weeks)

### Week 1 – Foundation
1. **Discovery & Design**
   - Review workflow runtime lifecycle hooks (`READY`, `STARTED`, `COMPLETED`, etc.).
   - Finalize automation surface: keep `AUTOMATION_WEBHOOK` for system integrations and add a step-level `notifications` config supporting multiple channels.
   - Define `actionConfig` schema for automation steps plus `notificationPolicies` schema.
2. **Schema & API Prep**
   - Add new action type(s) to Prisma enum + migrations.
   - Extend validation schemas, OpenAPI specs, and seed data to include sample automation steps.
3. **Event Bus Skeleton**
   - Evaluate tooling (BullMQ/Redis vs. custom Node worker). For simplicity, start with BullMQ on existing Redis.
   - Implement a minimal queue producer abstraction inside workflow runtime.

### Week 2 – Execution & UX
4. **Automation Handler Implementation**
   - Worker process consumes automation jobs, executes configured action (e.g., email via existing notification service, webhook via fetch).
   - Persist execution logs, status, retries to `WorkflowInstanceStep`.
5. **Scheduling Support**
   - Allow `actionConfig` to specify `runAt` or recurrence.
   - Integrate with queue delayed jobs; emit events when prerequisite steps complete to schedule automation steps.
6. **UI & Observability**
   - Update Timeline/Detail views to show automation + notification metadata (queued, running, failed, retry).
   - Provide manual retry/skip controls and expose notification delivery logs.
7. **Testing & Rollout**
   - Add unit tests for new handlers, integration tests covering queue flow, and e2e scenario validating automated email.
   - Document operational runbooks (monitoring queue depth, retry policies).

## Risks & Mitigations
- **Queue reliability**: start with simple Redis/BullMQ, but abstract producers to swap later if needed.
- **Idempotency**: include step-level execution tokens to avoid duplicate sends.
- **Security**: validate outbound email/webhook configs; restrict who can add automation steps.

## Deliverables
- Updated Prisma schema + migrations for automation action types.
- Worker service (can be Next.js route handler invoked via `node scripts/automation-worker.ts` initially).
- Enhanced UI/API reflecting automation state.
- Documentation: architecture overview, runbook for operators, and template author guidelines.

## High-Level Architecture

### Core Components
1. **Workflow Engine (Existing)**
   - Orchestrates `WorkflowInstanceStep` lifecycle, transitions states, and enforces dependencies.
2. **Automation Job Producer (New)**
   - Runs inside the workflow runtime/service.
   - Observes steps entering `READY` state; when action type is automation-capable, it enqueues a job with step metadata + config.
3. **Event Bus / Queues**
   - BullMQ (Redis) with two primary queues:
     - `workflow-automation` for automated step execution (webhooks, future system tasks).
     - `workflow-notifications` for channel fan-out triggered by lifecycle events.
4. **Automation Worker**
   - Separate Node process (or Next.js route invoked via `node scripts/automation-worker.ts`).
   - Consumes queue, loads step/action config, executes provider-specific handler (email, webhook, etc.).
   - Writes execution log entries, state transitions, and retry metadata back to DB via Prisma.
5. **Notification/Provider Services**
   - Work off the `workflow-notifications` queue; each job knows channel + template.
   - Email/SMS/push modules send messages, log results, and handle retries.
   - Webhook execution uses hardened fetch client with retry + signature options.
6. **Observability Layer**
   - `AutomationExecutionLog` / `NotificationDeliveryLog` (JSON on steps) capturing attempts, timestamps, payload metadata.
   - Metrics emitted per job (success/failure) for ops dashboards.

### Data Flow
1. Template author configures an automation step (action type `AUTOMATION_EMAIL`, etc.) with `actionConfig`.
2. Workflow engine activates instance; when prerequisites satisfied, step transitions to `READY`.
3. Automation producer enqueues job `{ stepId, instanceId, actionType, actionConfig, runAt }`.
4. Worker picks job (immediate or when delay expires), executes provider handler:
   - e.g., `EmailAutomationHandler` renders template, calls notification service.
5. Handler updates step:
   - On success: set `actionState=COMPLETED`, attach log entry.
   - On failure: increment retry count, optionally requeue with backoff; after max attempts, mark `FAILED` and notify humans.
6. UI/API surfaces state/logs; operators can retry or skip via existing mutation endpoints.

## Task Breakdown

1. **Architecture & Schema**
   - Finalize action type list (`AUTOMATION_WEBHOOK` for integrations; other system tasks TBD).
   - Introduce `notificationPolicies` JSON column on `WorkflowTemplateStep` + `WorkflowInstanceStep` mirroring schema `{ channel, template, trigger }`.
   - Extend Prisma `ActionType` enum, action config typings, and add migrations for new columns/log fields.

2. **Validation & API Surfaces**
   - Update Zod schemas, OpenAPI, and template validation to handle `notificationPolicies`.
   - Extend template/editor APIs to persist automation + notification config.
   - Add sample automation steps + notification policies in seeds.

3. **Queue Infrastructure**
   - Add BullMQ + Redis wiring (connection factory, env vars, retry/backoff policy).
   - Implement automation producer + notification emitter helpers with idempotency tokens.

4. **Automation Worker**
   - Create worker entrypoint(s) (`scripts/automation-worker.ts`, `scripts/notification-worker.ts`) with graceful shutdown, concurrency controls.
   - Implement handler registry for automation tasks (webhook) and notification channels.
   - Ensure errors bubble with structured logging and step updates.

5. **Scheduling & Event Hooks**
   - Support delayed jobs (`runAt`) for automation + notifications.
   - Emit automation jobs when prior steps complete; emit notification events on configured triggers (`ON_READY`, `ON_COMPLETED`, `ON_FAILED`).

6. **Observability & Control Plane**
   - Persist execution + notification logs on steps.
   - Expose logs via `/api/workflows/instances/:id` and UI detail panes.
   - Implement manual retry/skip endpoints plus ability to replay notifications.

7. **UI Enhancements**
   - Update Template Editor to configure automation + notification policies per step.
   - Update Timeline/Detail to show automation + notification status, log history, and manual controls.

8. **Testing & Docs**
   - Unit tests for automation + notification helpers, queue jobs, and handlers.
   - Integration test covering webhook automation + email notification end-to-end (with mocked providers).
   - Operational runbooks (running workers, monitoring queues).
   - Template authoring guide for configuring notification policies safely.

## Task List (Implementation Backlog)

1. **Schema & Migration**
   - Add `AUTOMATION_WEBHOOK` (already present) + ensure enum sync.
   - Introduce `notificationPolicies` JSON column(s) on template and instance steps.
   - Add JSON log fields for `automationLog` and `notificationLog`.

2. **Validation & TypeScript Models**
   - Expand Zod schemas, runtime types, and Prisma client typings to include notification policy objects.
   - Update OpenAPI + public schema docs with `notificationPolicies`.

3. **Template Builder / Editor**
   - Add notification configuration UI (channel selector, template pickers, trigger toggles) to `StepPropertyPanel`.
   - Persist policies via template APIs; ensure default states when omitted.

4. **Workflow Runtime Enhancements**
   - Emit notification events when steps hit configured triggers.
   - Create helpers that enqueue automation jobs (webhook) and notification jobs with idempotency keys.
   - Extend action handlers to record automation log entries.

5. **Queue Workers**
   - Implement `automation-worker` for webhook execution (with retries, exponential backoff, logging).
   - Implement `notification-worker` that reads channel config and invokes email/SMS/push adapters.

6. **UI & API Surfaces**
   - Show automation + notification status/logs within `WorkflowStepDetail`, Timeline nodes, and API responses.
   - Provide manual retry/skip + notification replay endpoints.

7. **Testing & Documentation**
   - Add unit/integration tests covering new schema, queue flows, and UI interactions.
   - Document architecture, runbooks, and template authoring guidelines.
