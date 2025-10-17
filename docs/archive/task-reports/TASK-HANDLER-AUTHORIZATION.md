# Workflow Task Handler Authorization System

## Overview

The Legal CRM workflow engine implements a sophisticated role-based access control (RBAC) system that ensures workflow tasks can only be performed by authorized users. This document explains how task handlers enforce permissions, how required steps work, and how administrators can skip optional steps.

## Table of Contents

1. [Role-Based Task Execution](#role-based-task-execution)
2. [Required Field Enforcement](#required-field-enforcement)
3. [Skip Logic](#skip-logic)
4. [Action Handler Implementation](#action-handler-implementation)
5. [API Endpoints](#api-endpoints)
6. [UI Integration](#ui-integration)
7. [Testing](#testing)

---

## Role-Based Task Execution

### Core Concept

Each workflow step has a `roleScope` field that determines which roles can perform the action:

- **ADMIN**: System administrators (can perform any action)
- **LAWYER**: Lawyers assigned to the matter
- **PARALEGAL**: Paralegals assigned to the matter
- **CLIENT**: The client associated with the matter

### Authorization Flow

```
User attempts to perform action
    ↓
API validates session & authentication
    ↓
ensureActorCanPerform() checks permissions
    ↓
Handler's canStart() validates role match
    ↓
Action executes or throws permission error
```

### Permission Layers

The system has **three layers** of permission checking:

#### 1. API-Level Authorization (`ensureActorCanPerform`)

Location: `lib/workflows/service.ts`

```typescript
export async function ensureActorCanPerform(
  tx: PrismaClientOrTransaction,
  step: WorkflowInstanceStepWithTemplate,
  actor: WorkflowActor,
): Promise<WorkflowActorSnapshot> {
  const snapshot = await loadWorkflowActorSnapshot(tx, step.instance.matterId);
  const allowed = canPerformAction({ actor, step, snapshot });
  
  if (!allowed.canPerform) {
    throw new WorkflowPermissionError(
      allowed.reason ?? "Actor cannot perform this action"
    );
  }
  
  return snapshot;
}
```

This function:
- Loads the matter's actor snapshot (eligible lawyers, paralegals, clients)
- Checks if the actor's ID is in the eligible list for the step's roleScope
- Admins always pass this check

#### 2. Handler-Level Validation (`canStart`)

Each action handler implements `canStart()` to validate role-specific business logic.

**Example: APPROVAL_LAWYER Handler**

```typescript
canStart(ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>): boolean {
  if (!ctx.actor) {
    return false;
  }

  // Admins can always perform any action
  if (ctx.actor.role === Role.ADMIN) {
    return true;
  }

  // For APPROVAL_LAWYER, only lawyers can approve
  if (ctx.step.roleScope === RoleScope.LAWYER && ctx.actor.role === Role.LAWYER) {
    return true;
  }

  return false;
}
```

**Example: SIGNATURE_CLIENT Handler**

```typescript
canStart(ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>): boolean {
  if (!ctx.actor) {
    return false;
  }

  // Admins can test/complete any signature action
  if (ctx.actor.role === Role.ADMIN) {
    return true;
  }

  // Only clients can complete signature requests
  if (ctx.step.roleScope === RoleScope.CLIENT && ctx.actor.role === Role.CLIENT) {
    return true;
  }

  // Lawyers and paralegals cannot complete client signatures
  return false;
}
```

#### 3. Step Claiming

Once a user starts a step, it's assigned to them via `assignedToId`. Other users cannot perform actions on claimed steps (except admins).

---

## Required Field Enforcement

### Database Schema

`WorkflowTemplateStep` table includes:

```prisma
model WorkflowTemplateStep {
  id           String     @id @default(cuid())
  templateId   String
  order        Int
  title        String
  actionType   ActionType
  actionConfig Json
  roleScope    RoleScope
  required     Boolean    @default(true)  // ← Required field
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  template      WorkflowTemplate       @relation(...)
  instanceSteps WorkflowInstanceStep[]
}
```

**Default Value**: `true` (all steps are required by default)

### Skip Validation

The `canSkipStep()` function enforces required field logic:

```typescript
export function canSkipStep(
  step: WorkflowInstanceStepWithTemplate,
  actor?: { id: string; role: Role },
): { canSkip: boolean; reason?: string } {
  // Only admins can skip steps
  if (!actor || actor.role !== Role.ADMIN) {
    return {
      canSkip: false,
      reason: "Only administrators can skip workflow steps",
    };
  }

  // Check if the step is marked as required
  const isRequired = step.templateStep?.required ?? true;
  
  if (isRequired) {
    return {
      canSkip: false,
      reason: "This step is marked as required and cannot be skipped",
    };
  }

  return { canSkip: true };
}
```

### Business Rules

1. **Required steps CANNOT be skipped** - even by admins
2. **Optional steps CAN be skipped** - but only by admins
3. **Default behavior**: Steps are required unless explicitly marked optional
4. **Use case for required steps**:
   - Client signature on critical documents
   - Payment collection
   - Lawyer approval for legal decisions
   - Document upload (KYC, contracts, etc.)

5. **Use case for optional steps**:
   - Internal checklist items
   - Optional notifications
   - Non-critical documentation
   - Process improvement steps

---

## Skip Logic

### Skip Workflow Step Function

Location: `lib/workflows/runtime.ts`

```typescript
export async function skipWorkflowStep({
  tx,
  instance,
  step,
  actor,
  reason,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor: WorkflowActor; // Required - must be admin
  reason?: string;
  now?: Date;
}): Promise<ActionState> {
  // Check if the step can be skipped
  const skipCheck = canSkipStep(step, actor);
  if (!skipCheck.canSkip) {
    throw new ActionHandlerError(
      skipCheck.reason ?? "This step cannot be skipped",
      "SKIP_NOT_ALLOWED",
    );
  }

  // Verify the actor has admin role
  if (actor.role !== Role.ADMIN) {
    throw new ActionHandlerError(
      "Only administrators can skip workflow steps",
      "PERMISSION_DENIED"
    );
  }

  const resultState = ActionState.SKIPPED;
  assertTransition(step.actionState, resultState, { actor });

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor.id,
    event: "SKIPPED",
    payload: { reason: reason ?? "Step skipped by administrator" },
  });

  await persistStepUpdate(tx, step, data, resultState, {}, now);
  return resultState;
}
```

### Allowed State Transitions for SKIPPED

From the state machine (`lib/workflows/state-machine.ts`):

```typescript
const NEXT_STATE_MAP: Record<ActionState, readonly ActionState[]> = {
  [ActionState.READY]: [ActionState.IN_PROGRESS, ActionState.SKIPPED],
  [ActionState.IN_PROGRESS]: [
    ActionState.COMPLETED,
    ActionState.FAILED,
    ActionState.BLOCKED,
    ActionState.SKIPPED,
  ],
  [ActionState.BLOCKED]: [ActionState.READY, ActionState.SKIPPED],
  // Once SKIPPED, cannot transition to any other state
  [ActionState.SKIPPED]: [],
};
```

**Key Points**:
- Steps can be skipped from READY, IN_PROGRESS, or BLOCKED states
- Skipped steps are terminal (cannot be un-skipped)
- Skipped steps are treated as "complete" for workflow progression

---

## Action Handler Implementation

### Handler Interface

```typescript
export interface IActionHandler<TConfig = unknown, TData = unknown> {
  type: ActionType;
  validateConfig(config: TConfig): void;
  canStart(ctx: WorkflowRuntimeContext<TConfig, TData>): boolean;
  start(ctx: WorkflowRuntimeContext<TConfig, TData>): Promise<ActionState | void>;
  complete(ctx: WorkflowRuntimeContext<TConfig, TData>, payload?: unknown): Promise<ActionState | void>;
  fail(ctx: WorkflowRuntimeContext<TConfig, TData>, reason: string): Promise<ActionState | void>;
  getNextStateOnEvent(ctx: WorkflowRuntimeContext<TConfig, TData>, event: ActionEvent): ActionState | null;
}
```

### Role-Based Handler Matrix

| Handler | Action Type | Allowed Roles | RoleScope | Purpose |
|---------|-------------|---------------|-----------|---------|
| **ApprovalActionHandler** | APPROVAL_LAWYER | ADMIN, LAWYER | LAWYER | Lawyer must approve legal decisions |
| **SignatureActionHandler** | SIGNATURE_CLIENT | ADMIN, CLIENT | CLIENT | Client must sign documents |
| **RequestDocActionHandler** | REQUEST_DOC_CLIENT | ADMIN, CLIENT | CLIENT | Client must upload requested documents |
| **PaymentActionHandler** | PAYMENT_CLIENT | ADMIN, CLIENT | CLIENT | Client must complete payment |
| **ChecklistActionHandler** | CHECKLIST | Any (based on roleScope) | Any | Generic checklist for any role |

### Implementation Guidelines

When creating a new action handler:

1. **Always check for actor existence**:
   ```typescript
   if (!ctx.actor) {
     return false;
   }
   ```

2. **Allow admin override**:
   ```typescript
   if (ctx.actor.role === Role.ADMIN) {
     return true;
   }
   ```

3. **Validate role matches roleScope**:
   ```typescript
   if (ctx.step.roleScope === RoleScope.CLIENT && ctx.actor.role === Role.CLIENT) {
     return true;
   }
   ```

4. **Return false for unauthorized roles**:
   ```typescript
   return false;
   ```

---

## API Endpoints

### Skip Step Endpoint

**POST** `/api/workflows/steps/[id]/skip`

**Authorization**: Admin only

**Request Body**:
```json
{
  "reason": "Optional reason for skipping"
}
```

**Success Response** (200):
```json
{
  "id": "step-123",
  "actionState": "SKIPPED",
  "actionData": {
    "history": [
      {
        "at": "2024-01-15T10:00:00.000Z",
        "by": "admin-1",
        "event": "SKIPPED",
        "payload": {
          "reason": "Step skipped by administrator"
        }
      }
    ]
  },
  ...
}
```

**Error Responses**:

- **403 Forbidden** (Non-admin user):
  ```json
  {
    "error": "Only administrators can skip workflow steps"
  }
  ```

- **400 Bad Request** (Required step):
  ```json
  {
    "error": "This step is marked as required and cannot be skipped"
  }
  ```

### Complete Step Endpoint

**POST** `/api/workflows/steps/[id]/complete`

**Authorization**: Based on roleScope

**Request Body**:
```json
{
  "payload": {} // Action-specific payload
}
```

**Permission Validation**:
1. `ensureActorCanPerform()` checks if user is in eligible list
2. Handler's `canStart()` validates role-specific logic
3. Step claiming prevents concurrent modification

---

## UI Integration

### Skip Button Display Logic

Location: `components/matters/MatterDetailClient.tsx`

```tsx
{/* Skip button: Only show for admins, non-required steps, and incomplete steps */}
{currentUserRole === "ADMIN" &&
  !step.required &&
  step.actionState !== "COMPLETED" &&
  step.actionState !== "SKIPPED" && (
    <button
      type="button"
      onClick={() => {
        const reason = window.prompt(
          "Bu adımı atlamak istediğinizden emin misiniz? Sebep (opsiyonel):",
        );
        if (reason !== null) {
          void runStepAction(step.id, "skip", { reason: reason || undefined });
        }
      }}
      className="rounded border border-yellow-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-yellow-700 hover:bg-yellow-50 disabled:opacity-60"
      disabled={actionLoading === `${step.id}:skip`}
    >
      {actionLoading === `${step.id}:skip` ? "Atlanıyor..." : "Atla"}
    </button>
  )}
```

**Conditions for displaying skip button**:
1. User must be ADMIN
2. Step must NOT be required (`!step.required`)
3. Step must not already be COMPLETED or SKIPPED

### Required Badge Display

```tsx
<span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
  {step.required ? "Required" : "Optional"}
</span>
```

---

## Testing

### Unit Tests

Location: `tests/unit/workflow-handler-rbac.spec.ts`

#### Test Coverage

**For each handler**:
- ✅ ADMIN can perform action
- ✅ Authorized role can perform action (based on roleScope)
- ✅ Unauthorized roles CANNOT perform action
- ✅ Missing actor prevents action

**Example Test**:
```typescript
it("should NOT allow CLIENT to start lawyer approval", () => {
  const ctx: WorkflowRuntimeContext = {
    // ... setup context with CLIENT actor
    actor: { id: "client-1", role: Role.CLIENT },
    step: { roleScope: RoleScope.LAWYER, ... },
  };

  const canStart = handler.canStart(ctx);
  expect(canStart).toBe(false);
});
```

### Integration Tests

**Test Scenarios**:
1. **Lawyer approval workflow**:
   - Lawyer can approve ✅
   - Client cannot approve ❌
   - Paralegal cannot approve ❌

2. **Client signature workflow**:
   - Client can sign ✅
   - Lawyer cannot sign (on behalf of client) ❌

3. **Required step enforcement**:
   - Admin cannot skip required payment step ❌
   - Admin can skip optional notification step ✅

4. **Step claiming**:
   - First user claims step ✅
   - Second user cannot modify claimed step ❌
   - Admin can override claim ✅

---

## Error Handling

### Common Errors

1. **WorkflowPermissionError**: Thrown when actor lacks permission
   ```typescript
   throw new WorkflowPermissionError("Actor cannot perform this action");
   ```

2. **ActionHandlerError**: Thrown by handlers for business logic violations
   ```typescript
   throw new ActionHandlerError("Cannot start: prerequisites not met", "PRECONDITION_FAILED");
   ```

3. **WorkflowTransitionError**: Thrown for invalid state transitions
   ```typescript
   throw new WorkflowTransitionError("Cannot skip required step");
   ```

### Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `PERMISSION_DENIED` | User lacks required role | Assign correct role or use admin account |
| `SKIP_NOT_ALLOWED` | Step is required or user is not admin | Mark step as optional or contact admin |
| `INVALID_STATE` | Step in wrong state for action | Check workflow progression |
| `PRECONDITION_FAILED` | Handler denies action | Review action-specific requirements |

---

## Best Practices

### For Workflow Template Designers

1. **Mark critical steps as required**:
   - Client signatures
   - Payments
   - Legal approvals
   - KYC document collection

2. **Mark process steps as optional**:
   - Internal checklists
   - Optional notifications
   - Quality assurance reviews
   - Process improvement tasks

3. **Set appropriate roleScope**:
   - `LAWYER`: Legal decisions, approvals, reviews
   - `CLIENT`: Signatures, payments, document uploads
   - `PARALEGAL`: Data entry, document preparation
   - `ADMIN`: System configuration, overrides

### For Developers

1. **Always implement canStart()**:
   - Check for actor existence
   - Allow admin override
   - Validate role matches

2. **Use type-safe configs**:
   - Define Zod schemas for action configs
   - Validate in `validateConfig()`

3. **Log all actions**:
   - Actions are automatically logged to `actionData.history`
   - Include actor ID and timestamp

4. **Handle errors gracefully**:
   - Use specific error types
   - Provide helpful error messages
   - Return appropriate HTTP status codes

---

## Summary

The workflow task handler authorization system provides:

✅ **Three-layer permission checking** (API → Handler → Claiming)
✅ **Role-based access control** (ADMIN, LAWYER, PARALEGAL, CLIENT)
✅ **Required field enforcement** (Cannot skip required steps)
✅ **Admin override capabilities** (Can skip optional steps)
✅ **Audit trail** (All actions logged with actor and timestamp)
✅ **Type-safe implementation** (TypeScript + Zod validation)

This ensures workflows execute securely, with appropriate authorization at every step.
