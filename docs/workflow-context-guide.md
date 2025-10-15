# Workflow Shared Context - Usage Guide

## Overview

Workflow shared context allows data to flow between workflow steps. All steps in a workflow instance can read and write to a shared `contextData` JSONB field on the `WorkflowInstance`.

## Use Cases

### 1. **Collect Data in Early Steps, Use in Later Steps**
```typescript
// Step 1: Collect client information
await updateWorkflowContext(instanceId, {
  clientName: "John Doe",
  caseNumber: "2025-CV-1234",
  filingDeadline: "2025-12-31"
});

// Step 2: Generate document using context
const context = await getWorkflowContext(instanceId);
await generateDocument({
  clientName: context.clientName,
  caseNumber: context.caseNumber
});

// Step 3: Check deadline
if (new Date() > new Date(context.filingDeadline)) {
  await failStep("Deadline passed");
}
```

### 2. **Track Workflow State**
```typescript
// Track approval chain
await appendToWorkflowContextArray(instanceId, "approvals", {
  approvedBy: "lawyer@example.com",
  approvedAt: new Date().toISOString(),
  comment: "Looks good"
});

// Check how many approvals we have
const context = await getWorkflowContext(instanceId);
const approvalCount = (context.approvals as any[])?.length ?? 0;

if (approvalCount >= 3) {
  // Move to next phase
}
```

### 3. **Conditional Logic Based on Context**
```typescript
// Set decision in one step
await setWorkflowContextValue(instanceId, "approved", true);
await setWorkflowContextValue(instanceId, "settlementAmount", 50000);

// Use in later step
const approved = await getWorkflowContextValue<boolean>(instanceId, "approved");

if (approved) {
  const amount = await getWorkflowContextValue<number>(instanceId, "settlementAmount");
  await processPayment(amount);
} else {
  await escalateToSeniorLawyer();
}
```

### 4. **Accumulate Data from Parallel Steps**
```typescript
// Paralegal collects documents
await mergeWorkflowContextObject(instanceId, "documents", {
  medicalRecords: "doc-123",
  policeReport: "doc-456"
});

// Lawyer adds legal briefs
await mergeWorkflowContextObject(instanceId, "documents", {
  legalBrief: "doc-789",
  caselaw: "doc-012"
});

// Final step uses all documents
const context = await getWorkflowContext(instanceId);
const allDocuments = context.documents;
// { medicalRecords: "doc-123", policeReport: "doc-456", legalBrief: "doc-789", caselaw: "doc-012" }
```

### 5. **Counter/Progress Tracking**
```typescript
// Track tasks completed
await incrementWorkflowContextValue(instanceId, "tasksCompleted");

// Check progress
const completed = await getWorkflowContextValue<number>(instanceId, "tasksCompleted");
const total = await getWorkflowContextValue<number>(instanceId, "totalTasks");

const progress = (completed / total) * 100;
console.log(`Progress: ${progress}%`);
```

## API Reference

### Helper Functions

#### Get Context
```typescript
// Get entire context
const context = await getWorkflowContext(instanceId);

// Get specific value
const clientName = await getWorkflowContextValue<string>(instanceId, "clientName");

// Get multiple values
const { clientName, caseNumber } = await getWorkflowContextValues(instanceId, ["clientName", "caseNumber"]);

// Check if key exists
const hasDeadline = await hasWorkflowContextValue(instanceId, "filingDeadline");
```

#### Set/Update Context
```typescript
// Set entire context (replaces existing)
await setWorkflowContext(instanceId, {
  clientName: "John Doe",
  caseNumber: "2025-CV-1234"
});

// Update specific values (merges)
await updateWorkflowContext(instanceId, {
  status: "approved",
  approvedAt: new Date().toISOString()
});

// Set single value
await setWorkflowContextValue(instanceId, "approved", true);

// Delete a key
await deleteWorkflowContextValue(instanceId, "tempData");

// Clear entire context
await clearWorkflowContext(instanceId);
```

#### Advanced Operations
```typescript
// Increment counter
const newCount = await incrementWorkflowContextValue(instanceId, "stepCount"); // +1
const custom = await incrementWorkflowContextValue(instanceId, "points", 10); // +10

// Append to array
await appendToWorkflowContextArray(instanceId, "logs", {
  message: "Step completed",
  timestamp: new Date().toISOString()
});

// Merge nested object
await mergeWorkflowContextObject(instanceId, "metadata", {
  processedBy: "system",
  version: "2.0"
});
```

### REST API Endpoints

#### GET `/api/workflows/instances/:id/context`
Get the entire context for a workflow instance.

**Response:**
```json
{
  "context": {
    "clientName": "John Doe",
    "caseNumber": "2025-CV-1234",
    "approved": true,
    "stepCount": 3
  }
}
```

#### PATCH `/api/workflows/instances/:id/context`
Update workflow context.

**Merge updates (default):**
```json
{
  "updates": {
    "status": "approved",
    "approvedAt": "2025-10-15T10:00:00Z"
  }
}
```

**Replace entire context:**
```json
{
  "context": {
    "newKey": "newValue"
  }
}
```

**Clear context:**
```json
{
  "clear": true
}
```

## Usage in Workflow Handlers

Handlers automatically receive context in the runtime context:

```typescript
export class MyActionHandler implements IActionHandler {
  async complete(ctx: WorkflowRuntimeContext) {
    // Read from context
    const clientName = ctx.context.clientName;
    
    // Write to context (updates instance.contextData)
    ctx.context.approved = true;
    ctx.context.completedAt = ctx.now.toISOString();
    
    // Context is automatically saved after handler completes
    return ActionState.COMPLETED;
  }
}
```

## Best Practices

### 1. **Use TypeScript Types**
```typescript
interface MyWorkflowContext {
  clientName: string;
  caseNumber: string;
  approved?: boolean;
  documents?: string[];
}

const context = await getWorkflowContext(instanceId) as MyWorkflowContext;
```

### 2. **Validate Context Data**
```typescript
import { z } from "zod";

const contextSchema = z.object({
  clientName: z.string().min(1),
  caseNumber: z.string().regex(/^\d{4}-[A-Z]{2}-\d{4}$/),
  approved: z.boolean().optional()
});

const context = await getWorkflowContext(instanceId);
const validated = contextSchema.parse(context);
```

### 3. **Use Namespacing**
```typescript
// Good: Organized by domain
await updateWorkflowContext(instanceId, {
  "client.name": "John Doe",
  "client.email": "john@example.com",
  "court.name": "Superior Court",
  "court.caseNumber": "2025-CV-1234"
});

// Or use nested objects
await updateWorkflowContext(instanceId, {
  client: { name: "John Doe", email: "john@example.com" },
  court: { name: "Superior Court", caseNumber: "2025-CV-1234" }
});
```

### 4. **Don't Store Large Objects**
Context is stored as JSONB. Keep it lean:
- ✅ Store IDs, not full objects
- ✅ Store references to documents/matters
- ❌ Don't store file contents
- ❌ Don't store entire API responses

```typescript
// Good
await setWorkflowContextValue(instanceId, "documentId", "doc-123");

// Bad
await setWorkflowContextValue(instanceId, "documentContent", largeFileBuffer);
```

### 5. **Handle Missing Values**
```typescript
const deadline = await getWorkflowContextValue<string>(instanceId, "deadline");

if (!deadline) {
  throw new Error("Deadline not set in workflow context");
}

// Or provide default
const retries = (await getWorkflowContextValue<number>(instanceId, "retries")) ?? 0;
```

## Migration from Step-Only Data

**Before (isolated step data):**
```typescript
// Step 1 stores in its own actionData
step1.actionData = { clientName: "John Doe" };

// Step 2 can't access Step 1's data ❌
```

**After (shared context):**
```typescript
// Step 1 stores in shared context
await updateWorkflowContext(instanceId, {
  clientName: "John Doe"
});

// Step 2 can read it ✅
const clientName = ctx.context.clientName;
```

## Examples

### Example 1: Client Onboarding Workflow
```typescript
// Step 1: Collect client info (CHECKLIST)
await updateWorkflowContext(instanceId, {
  clientName: "John Doe",
  clientEmail: "john@example.com",
  caseType: "Personal Injury"
});

// Step 2: Generate engagement letter (GENERATE_DOCUMENT)
const context = await getWorkflowContext(instanceId);
const documentId = await generateEngagementLetter({
  clientName: context.clientName,
  caseType: context.caseType
});
await setWorkflowContextValue(instanceId, "engagementLetterId", documentId);

// Step 3: Send for signature (SIGNATURE_CLIENT)
const letterId = await getWorkflowContextValue<string>(instanceId, "engagementLetterId");
await requestSignature(letterId);

// Step 4: Request payment (PAYMENT_CLIENT)
await setWorkflowContextValue(instanceId, "retainerAmount", 5000);
```

### Example 2: Court Filing Workflow
```typescript
// Step 1: Prepare documents
await updateWorkflowContext(instanceId, {
  caseNumber: "2025-CV-1234",
  courtName: "Superior Court",
  filingDeadline: "2025-12-31",
  documents: []
});

// Step 2: Collect documents (may happen in parallel)
await appendToWorkflowContextArray(instanceId, "documents", "doc-petition");
await appendToWorkflowContextArray(instanceId, "documents", "doc-evidence");

// Step 3: Lawyer review
const context = await getWorkflowContext(instanceId);
const allDocuments = context.documents as string[];
if (allDocuments.length < 2) {
  throw new Error("Missing required documents");
}

// Step 4: File with court
await updateWorkflowContext(instanceId, {
  filedAt: new Date().toISOString(),
  filingConfirmation: "CONF-12345"
});
```

## Troubleshooting

### Context not updating?
Make sure you're awaiting the update:
```typescript
// ❌ Wrong
updateWorkflowContext(instanceId, { key: "value" });

// ✅ Correct
await updateWorkflowContext(instanceId, { key: "value" });
```

### Type errors with context?
Cast to your interface:
```typescript
interface MyContext {
  clientName: string;
}

const context = await getWorkflowContext(instanceId) as MyContext;
```

### Context getting too large?
Audit what you're storing and remove unnecessary data:
```typescript
const context = await getWorkflowContext(instanceId);
console.log(JSON.stringify(context, null, 2));

// Clean up old data
await deleteWorkflowContextValue(instanceId, "tempProcessingData");
```

## Future Enhancements

Planned features:
- Context versioning/history
- Context validation schemas
- Context access control per role
- Context change notifications
- Context templates for common workflows
