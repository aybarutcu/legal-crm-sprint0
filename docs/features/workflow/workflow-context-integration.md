# Workflow Context Integration Guide

## Current Architecture

### Context Flow
```
┌────────────────────────────────────────────────────────────┐
│  WorkflowInstance                                          │
│  ├─ contextData: { key: value, ... }   (Instance-level)   │
│  └─ template.contextSchema: { ... }    (Template-level)   │
└────────────────────────────────────────────────────────────┘
         ↓ Passed to handlers
┌────────────────────────────────────────────────────────────┐
│  WorkflowRuntimeContext                                    │
│  ├─ context: Record<string, unknown>   (READ-ONLY)        │
│  ├─ data: TData                         (Step-level)       │
│  └─ config: TConfig                     (Step config)      │
└────────────────────────────────────────────────────────────┘
```

### Problem: Context Mutations Not Persisted

**Current behavior**: Handlers can READ `ctx.context` but changes are NOT saved to DB.

```typescript
async complete(ctx: WorkflowRuntimeContext<...>) {
  // ❌ This does NOT persist to database
  ctx.context.approverName = "John Doe";
  ctx.context.documentCount = 42;
  
  return ActionState.COMPLETED;
}
```

**Why?** The `persistStepUpdate()` function only saves:
- `step.actionState` (state transition)
- `step.actionData` (step-specific data)
- Timestamps

It does **NOT** update `instance.contextData`.

---

## Solution: Add Context Persistence

### Option 1: Extend Runtime Context (Recommended)

Add a method to persist context changes:

**1. Update `WorkflowRuntimeContext` type:**

```typescript
// lib/workflows/types.ts
export type WorkflowRuntimeContext<TConfig = unknown, TData = unknown> = {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor?: WorkflowActor;
  config: TConfig;
  data: TData;
  now: Date;
  context: Record<string, unknown>;
  
  // NEW: Method to update context
  updateContext: (updates: Record<string, unknown>) => void;
};
```

**2. Update `buildContext()` in `runtime.ts`:**

```typescript
// lib/workflows/runtime.ts
function buildContext<TConfig, TData>(
  step: WorkflowInstanceStepWithTemplate,
  instance: WorkflowInstance,
  tx: PrismaClient | Prisma.TransactionClient,
  actor: WorkflowActor | undefined,
  now: Date,
): WorkflowRuntimeContext<TConfig, TData> {
  const config = extractConfig<TConfig>(step);
  const data = ensureActionData(step) as unknown as TData;
  const contextData = isJsonObject(instance.contextData) 
    ? instance.contextData as Record<string, unknown> 
    : {};
  
  // Track context mutations
  const contextUpdates: Record<string, unknown> = {};
  
  return {
    tx,
    instance,
    step,
    actor,
    config,
    data,
    now,
    context: contextData,
    
    // NEW: Method to queue context updates
    updateContext: (updates: Record<string, unknown>) => {
      Object.assign(contextUpdates, updates);
      Object.assign(contextData, updates); // Also update local copy
    },
    
    // Internal: Get pending updates
    _getContextUpdates: () => contextUpdates,
  };
}
```

**3. Update `persistStepUpdate()` to save context:**

```typescript
// lib/workflows/runtime.ts
async function persistStepUpdate(
  tx: PrismaClient | Prisma.TransactionClient,
  step: WorkflowInstanceStepWithTemplate,
  data: JsonObject,
  targetState: ActionState,
  contextUpdates: Record<string, unknown>, // NEW parameter
  now: Date,
): Promise<void> {
  // Update step state
  await tx.workflowInstanceStep.update({
    where: { id: step.id },
    data: {
      actionState: targetState,
      actionData: data as JsonValue,
      startedAt: step.startedAt ?? now,
      completedAt: targetState === ActionState.COMPLETED ? now : step.completedAt,
      updatedAt: now,
    },
  });
  
  // Update instance context if there are changes
  if (Object.keys(contextUpdates).length > 0) {
    const existingContext = isJsonObject(step.instance.contextData)
      ? step.instance.contextData as Record<string, unknown>
      : {};
    
    const mergedContext = {
      ...existingContext,
      ...contextUpdates,
    };
    
    await tx.workflowInstance.update({
      where: { id: step.instance.id },
      data: {
        contextData: mergedContext as JsonValue,
        updatedAt: now,
      },
    });
  }
}
```

**4. Update all runtime function calls:**

```typescript
// lib/workflows/runtime.ts
export async function completeWorkflowStep({...}): Promise<ActionState> {
  ensureCanMutate(step, actor);

  const handler = actionRegistry.get(step.actionType);
  const context = buildContext(step, instance, tx, actor, now);
  handler.validateConfig(context.config);

  const resultState = (await handler.complete(context, payload)) ?? ActionState.COMPLETED;
  assertTransition(step.actionState, resultState, { actor });

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor?.id,
    event: resultState === ActionState.COMPLETED ? "COMPLETED" : `STATE_${resultState}`,
    payload,
  });

  // NEW: Get context updates from handler
  const contextUpdates = context._getContextUpdates();
  
  await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
  return resultState;
}

// Repeat for startWorkflowStep, failWorkflowStep, applyEventToWorkflowStep
```

**5. Now handlers can update context:**

```typescript
// lib/workflows/handlers/approval-lawyer.ts
async complete(
  ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>,
  payload?: unknown,
): Promise<ActionState> {
  const parsed = completionSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new ActionHandlerError("Invalid approval payload", "INVALID_PAYLOAD");
  }

  // Save to step data (existing)
  ctx.data.decision = {
    ...parsed.data,
    decidedAt: ctx.now.toISOString(),
    decidedBy: ctx.actor?.id,
  };
  
  // NEW: Update workflow context (persisted to instance)
  ctx.updateContext({
    lastApproval: {
      approved: parsed.data.approved,
      approvedBy: ctx.actor?.id,
      approvedAt: ctx.now.toISOString(),
    },
    approvalCount: (ctx.context.approvalCount as number || 0) + 1,
  });

  return ActionState.COMPLETED;
}
```

---

### Option 2: Return Context Updates (Simpler)

Handlers can return context updates alongside state:

**1. Change handler return type:**

```typescript
// lib/workflows/types.ts
export interface IActionHandler<TConfig = unknown, TData = unknown> {
  complete(
    ctx: WorkflowRuntimeContext<TConfig, TData>, 
    payload?: unknown
  ): Promise<ActionState | { state: ActionState; contextUpdates?: Record<string, unknown> }>;
}
```

**2. Update handlers:**

```typescript
// lib/workflows/handlers/approval-lawyer.ts
async complete(ctx, payload) {
  // ... validation ...
  
  ctx.data.decision = { ... };
  
  return {
    state: ActionState.COMPLETED,
    contextUpdates: {
      lastApproval: { ... },
      approvalCount: (ctx.context.approvalCount as number || 0) + 1,
    },
  };
}
```

**3. Update runtime to handle returned updates:**

```typescript
// lib/workflows/runtime.ts
const result = await handler.complete(context, payload);
const resultState = typeof result === 'object' && 'state' in result 
  ? result.state 
  : (result ?? ActionState.COMPLETED);
const contextUpdates = typeof result === 'object' && 'contextUpdates' in result
  ? result.contextUpdates || {}
  : {};

await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
```

---

## Example Use Cases

### 1. Approval Handler Populates Context

```typescript
// lib/workflows/handlers/approval-lawyer.ts
async complete(ctx, payload) {
  const { approved, comment } = completionSchema.parse(payload);
  
  ctx.data.decision = { approved, comment, decidedAt: ctx.now.toISOString() };
  
  // Update shared context
  ctx.updateContext({
    clientApproved: approved,
    approverName: ctx.actor?.id,
    approvalDate: ctx.now.toISOString(),
  });
  
  return ActionState.COMPLETED;
}
```

### 2. Document Request Handler

```typescript
// lib/workflows/handlers/request-doc-client.ts
async complete(ctx, payload) {
  const { uploadedFiles } = payload;
  
  // Update context with uploaded document IDs
  ctx.updateContext({
    uploadedDocuments: uploadedFiles,
    documentCount: uploadedFiles.length,
    uploadedAt: ctx.now.toISOString(),
  });
  
  return ActionState.COMPLETED;
}
```

### 3. Payment Handler

```typescript
// lib/workflows/handlers/payment-client.ts
async complete(ctx, payload) {
  const { transactionId, amount } = payload;
  
  // Update context with payment info
  ctx.updateContext({
    paymentReceived: true,
    paymentAmount: amount,
    paymentTransactionId: transactionId,
    paidAt: ctx.now.toISOString(),
  });
  
  return ActionState.COMPLETED;
}
```

### 4. Checklist Handler

```typescript
// lib/workflows/handlers/checklist.ts
async complete(ctx, payload) {
  const { completedItems } = payload;
  
  ctx.data.completedItems = completedItems;
  
  // Update context
  ctx.updateContext({
    checklistCompleted: true,
    totalItemsCompleted: completedItems.length,
    completedBy: ctx.actor?.id,
  });
  
  return ActionState.COMPLETED;
}
```

---

## Context Schema Integration

With schema validation, handlers should respect field types:

```typescript
// Example: Validation before updating context
async complete(ctx, payload) {
  const { approved } = completionSchema.parse(payload);
  
  // Get schema from template
  const schema = ctx.instance.template?.contextSchema;
  
  // Prepare updates
  const updates = {
    clientApproved: approved,
    documentCount: 42,
  };
  
  // Validate against schema (if available)
  if (schema) {
    const validation = validateContext(updates, schema);
    if (!validation.valid) {
      throw new ActionHandlerError(
        `Context validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        'INVALID_CONTEXT'
      );
    }
  }
  
  // Update context
  ctx.updateContext(updates);
  
  return ActionState.COMPLETED;
}
```

---

## Recommended Implementation Plan

1. **Phase 1**: Add `updateContext()` method to runtime context ✅
2. **Phase 2**: Update `persistStepUpdate()` to save context ✅
3. **Phase 3**: Update all runtime functions to pass context updates ✅
4. **Phase 4**: Update existing handlers to populate context ✅
5. **Phase 5**: Add schema validation to context updates ✅
6. **Phase 6**: Add audit logging for context changes 🔄
7. **Phase 7**: Add UI to show "context populated by step X" 🔄

---

## Migration Path

### Existing Workflows

Context population is **opt-in** for handlers:
- Handlers that don't call `updateContext()` continue to work
- Context can still be manually updated via UI/API
- No breaking changes

### New Workflows

- Define context schema in template
- Handlers populate expected fields on completion
- Schema validation ensures data integrity

---

## Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `lib/workflows/types.ts` | Add `updateContext` to context type | ~5 |
| `lib/workflows/runtime.ts` | Update `buildContext`, `persistStepUpdate`, all runtime functions | ~50 |
| `lib/workflows/handlers/approval-lawyer.ts` | Add context updates | ~10 |
| `lib/workflows/handlers/checklist.ts` | Add context updates | ~10 |
| `lib/workflows/handlers/signature-client.ts` | Add context updates | ~10 |
| `lib/workflows/handlers/request-doc-client.ts` | Add context updates | ~10 |
| `lib/workflows/handlers/payment-client.ts` | Add context updates | ~10 |

**Total**: ~105 lines of code

**Estimated Time**: 2-3 hours

---

## Testing

```typescript
// Test context updates in workflow
it("should persist context updates from handler", async () => {
  const instance = await createWorkflowInstance({
    templateId: "...",
    matterId: "...",
  });
  
  // Complete approval step
  await completeWorkflowStep({
    tx,
    instance,
    step: instance.steps[0],
    actor: { id: "user-1", role: Role.LAWYER },
    payload: { approved: true, comment: "Looks good" },
  });
  
  // Check context was updated
  const updated = await prisma.workflowInstance.findUnique({
    where: { id: instance.id },
  });
  
  expect(updated.contextData).toEqual({
    clientApproved: true,
    approverName: "user-1",
    approvalDate: expect.any(String),
  });
});
```

---

## Summary

**Current State**: ❌ Context is read-only in handlers, manual population only

**Recommended**: ✅ Add `updateContext()` method, persist to instance on step completion

**Benefits**:
- Automatic context population by workflow steps
- Schema validation on context updates
- Better data flow between steps
- Audit trail of context changes
- Backward compatible

Would you like me to implement this enhancement?
