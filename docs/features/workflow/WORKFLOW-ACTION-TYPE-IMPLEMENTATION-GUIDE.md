# Workflow Action Type Implementation Guide

This document provides a standardized pattern for implementing new action types in the workflow system. Each action type must support three distinct states: **PENDING/READY**, **IN_PROGRESS**, and **COMPLETED**.

## Table of Contents
1. [Overview](#overview)
2. [Three-State Pattern](#three-state-pattern)
3. [Implementation Checklist](#implementation-checklist)
4. [Current Action Types Reference](#current-action-types-reference)
5. [Step-by-Step Guide](#step-by-step-guide)

---

## Overview

Each action type in the workflow system requires:
1. **Backend Handler** (`lib/workflows/handlers/`) - Business logic and state management
2. **Execution Component** (`components/workflows/execution/`) - Interactive UI for IN_PROGRESS state
3. **Viewer Component** (`components/workflows/output/`) - Read-only UI for COMPLETED state
4. **Integration** in `WorkflowStepDetail.tsx` - Orchestrates the three states

---

## Three-State Pattern

### 1. PENDING/READY State (Preview Mode)
**Purpose**: Show users what they will need to do when the step becomes active.

**Characteristics**:
- Read-only display of configuration
- No interactive elements (buttons, inputs disabled)
- Shows requirements, instructions, or expected inputs
- Uses muted colors (grays, light backgrounds)

**Example**: REQUEST_DOC in PENDING shows document names without upload buttons.

### 2. IN_PROGRESS State (Execution Mode)
**Purpose**: Allow users to perform the action and complete the step.

**Characteristics**:
- Interactive UI with inputs, buttons, forms
- Action-specific controls (checkboxes, text areas, upload buttons)
- Submit/Complete buttons enabled
- Validation feedback
- Bright, action-oriented colors

**Example**: REQUEST_DOC in IN_PROGRESS shows "Yükle" buttons for each document.

### 3. COMPLETED State (Result Mode)
**Purpose**: Display the outcome and artifacts produced by the action.

**Characteristics**:
- Read-only display of results
- Shows submitted data, uploaded files, decisions made
- Includes metadata (who, when)
- Success-themed colors (green tones)
- Download/view options for artifacts

**Example**: REQUEST_DOC in COMPLETED shows DocumentViewer with download buttons.

---

## Implementation Checklist

When creating a new action type, complete these tasks:

### Backend
- [ ] Create handler in `lib/workflows/handlers/your-action.ts`
  - [ ] Implement `start()` method (PENDING → IN_PROGRESS)
  - [ ] Implement `complete()` method (IN_PROGRESS → COMPLETED)
  - [ ] Implement `canComplete()` validation
  - [ ] Define TypeScript types for config and data
- [ ] Register handler in `lib/workflows/handlers/index.ts`
- [ ] Add action type to `ActionType` enum in `prisma/schema.prisma`
- [ ] Create/update migration for schema changes

### Frontend Components
- [ ] Create execution component in `components/workflows/execution/YourActionExecution.tsx`
  - [ ] Accept `step.actionState` prop
  - [ ] Implement PENDING/READY preview (read-only)
  - [ ] Implement IN_PROGRESS execution (interactive)
  - [ ] Handle form state and validation
- [ ] Create viewer component in `components/workflows/output/YourActionViewer.tsx`
  - [ ] Display completed results
  - [ ] Show metadata (timestamps, user)
  - [ ] Provide access to artifacts (downloads, links)
- [ ] Export both components in respective `index.ts` files

### Integration
- [ ] Update `WorkflowStepDetail.tsx`:
  - [ ] Add to `InProgressStateView.renderExecutionUI()` switch case
  - [ ] Add to `CompletedStateView.renderOutputUI()` switch case
- [ ] Update `ActionConfigDisplay.tsx` for template preview
- [ ] Add to workflow template builder UI

### Testing
- [ ] Unit tests for handler logic
- [ ] Test PENDING → READY → IN_PROGRESS → COMPLETED flow
- [ ] Test data persistence in `actionData`
- [ ] Test error handling and validation

---

## Current Action Types Reference

### 1. APPROVAL
**Purpose**: Require approval/rejection decision from authorized user.

**Data Structure**:
```typescript
// Config (from template)
{
  message: string;  // Instructions for reviewer
}

// Runtime Data
{
  decision: {
    approved: boolean;
    comment?: string;
    decidedAt: string;
    decidedBy: string;
  }
}
```

**States**:
- **PENDING/READY**: Shows approval message, no action buttons
- **IN_PROGRESS**: Shows message, comment textarea, "Onayla"/"Reddet" buttons
- **COMPLETED**: ApprovalViewer shows decision badge, comment, metadata

**Files**:
- Handler: `lib/workflows/handlers/approval.ts`
- Execution: `components/workflows/execution/ApprovalExecution.tsx`
- Viewer: `components/workflows/output/ApprovalViewer.tsx`

**Color Scheme**: Purple (`border-purple-200`, `bg-purple-50/50`)

---

### 2. CHECKLIST
**Purpose**: User must check off all items in a list.

**Data Structure**:
```typescript
// Config
{
  items: string[];  // List of checklist items
}

// Runtime Data
{
  completedItems: string[];  // Items that were checked
}
```

**States**:
- **PENDING/READY**: Shows items as read-only list
- **IN_PROGRESS**: Interactive checkboxes, "Tamamla" button (enabled when all checked)
- **COMPLETED**: ChecklistViewer shows all items with check marks

**Files**:
- Handler: `lib/workflows/handlers/checklist.ts`
- Execution: `components/workflows/execution/ChecklistExecution.tsx`
- Viewer: `components/workflows/output/ChecklistViewer.tsx`

**Color Scheme**: Blue (`border-blue-200`, `bg-blue-50/50`)

---

### 3. REQUEST_DOC
**Purpose**: Request upload of specific documents from user.

**Data Structure**:
```typescript
// Config (actionData - flat structure)
{
  requestText: string;      // Request message
  documentNames: string[];  // Required document names
}

// Runtime Data (added to actionData when started)
{
  documentsStatus: Array<{
    documentName: string;
    uploaded: boolean;
    documentId?: string;
    uploadedAt?: string;
  }>;
  allDocumentsUploaded: boolean;
}
```

**States**:
- **PENDING/READY**: Shows document names with clock icons, NO upload buttons
- **IN_PROGRESS**: Shows "Yükle" buttons for each non-uploaded document
- **COMPLETED**: DocumentViewer component with download buttons

**Files**:
- Handler: `lib/workflows/handlers/request-doc.ts`
- Execution: `components/workflows/execution/DocumentRequestExecution.tsx`
- Viewer: `components/workflows/output/DocumentViewer.tsx`

**Color Scheme**: Orange (`border-orange-200`, `bg-orange-50/50`)

**Special Notes**:
- In COMPLETED state, switches to DocumentViewer component entirely
- Auto-completes when all documents uploaded

---

### 4. SIGNATURE
**Purpose**: Require digital signature on a document.

**Data Structure**:
```typescript
// Config
{
  documentId: string;
  provider: string;  // "mock", "docusign", etc.
}

// Runtime Data
{
  signedAt: string;
  signedBy: string;
  signatureProvider: string;
}
```

**States**:
- **PENDING/READY**: Shows document info, signature area (disabled)
- **IN_PROGRESS**: Active signature UI, "İmzala ve Tamamla" button
- **COMPLETED**: Shows signature confirmation, metadata

**Files**:
- Handler: `lib/workflows/handlers/signature.ts`
- Execution: `components/workflows/execution/SignatureExecution.tsx`
- Viewer: (Uses generic display, no dedicated viewer yet)

**Color Scheme**: Indigo (`border-indigo-200`, `bg-indigo-50/50`)

---

### 5. WRITE_TEXT
**Purpose**: User must write/compose text content.

**Data Structure**:
```typescript
// Config
{
  title: string;
  description?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  required: boolean;
}

// Runtime Data
{
  content: string;
  format: "plain" | "html";
  writtenAt: string;
}
```

**States**:
- **PENDING/READY**: Shows title, description, disabled textarea
- **IN_PROGRESS**: Active textarea with character count, validation, "Tamamla" button
- **COMPLETED**: WriteTextViewer shows formatted content

**Files**:
- Handler: `lib/workflows/handlers/write-text.ts`
- Execution: `components/workflows/execution/WriteTextExecution.tsx`
- Viewer: `components/workflows/output/WriteTextViewer.tsx`

**Color Scheme**: Indigo (`border-indigo-200`, `bg-indigo-50/50`)

**Special Features**: Character count, length validation, required field indicator

---

### 6. POPULATE_QUESTIONNAIRE
**Purpose**: User must fill out a questionnaire form.

**Data Structure**:
```typescript
// Config
{
  questionnaireId: string;
}

// Runtime Data
{
  responseId: string;  // ID of created QuestionnaireResponse
  submittedAt: string;
}
```

**States**:
- **PENDING/READY**: Shows questionnaire name/description
- **IN_PROGRESS**: Opens questionnaire form, submit button
- **COMPLETED**: QuestionnaireResponseViewer shows submitted answers

**Files**:
- Handler: `lib/workflows/handlers/populate-questionnaire.ts`
- Execution: `components/workflows/execution/PopulateQuestionnaireExecution.tsx`
- Viewer: `components/workflows/output/QuestionnaireResponseViewer.tsx`

**Color Scheme**: Teal (`border-teal-200`, `bg-teal-50/50`)

---

### 7. TASK
**Purpose**: Create a task that must be marked as completed.

**Data Structure**:
```typescript
// Config
{
  title: string;
  description?: string;
  assignToRole?: RoleScope;
}

// Runtime Data
{
  taskId: string;
  completedAt: string;
  completedBy: string;
}
```

**States**:
- **PENDING/READY**: Shows task preview
- **IN_PROGRESS**: Shows task details, "Mark Complete" button
- **COMPLETED**: TaskViewer shows completion status

**Files**:
- Handler: `lib/workflows/handlers/task.ts`
- Execution: `components/workflows/execution/TaskExecution.tsx`
- Viewer: `components/workflows/output/TaskViewer.tsx`

**Color Scheme**: Slate (`border-slate-200`, `bg-slate-50`)

---

### 8. PAYMENT
**Purpose**: Process a payment transaction.

**Data Structure**:
```typescript
// Config
{
  amount: number;
  currency: string;
  description: string;
}

// Runtime Data
{
  transactionId: string;
  paidAt: string;
  paidBy: string;
  method: string;
}
```

**States**:
- **PENDING/READY**: Shows payment amount, description (no payment button)
- **IN_PROGRESS**: Shows payment form, "Pay" button
- **COMPLETED**: Shows payment confirmation, receipt link

**Files**:
- Handler: `lib/workflows/handlers/payment.ts`
- Execution: `components/workflows/execution/PaymentExecution.tsx`
- Viewer: (Generic display, no dedicated viewer)

**Color Scheme**: Green (`border-green-200`, `bg-green-50/50`)

---

### 9. AUTOMATION_EMAIL / AUTOMATION_WEBHOOK
**Purpose**: Automated actions (no user interaction).

**Data Structure**:
```typescript
// Config
{
  // Email: to, subject, body, etc.
  // Webhook: url, method, headers, payload
}

// Runtime Data
{
  sentAt: string;
  status: "success" | "failed";
  error?: string;
}
```

**States**:
- **PENDING/READY**: Shows automation config preview
- **IN_PROGRESS**: Auto-executes immediately, shows spinner
- **COMPLETED**: AutomationViewer shows execution log

**Files**:
- Handlers: `lib/workflows/handlers/automation-email.ts`, `automation-webhook.ts`
- Execution: `components/workflows/execution/AutomationExecution.tsx`
- Viewer: `components/workflows/output/AutomationViewer.tsx`

**Color Scheme**: Gray (`border-gray-200`, `bg-gray-50`)

**Special Notes**: Auto-executes when step starts (no user input needed)

---

## Step-by-Step Guide

### Creating a New Action Type: "REVIEW_CODE"

Let's walk through creating a hypothetical code review action type.

#### Step 1: Define the Schema

Add to `prisma/schema.prisma`:
```prisma
enum ActionType {
  APPROVAL
  SIGNATURE
  REQUEST_DOC
  PAYMENT
  CHECKLIST
  WRITE_TEXT
  POPULATE_QUESTIONNAIRE
  TASK
  AUTOMATION_EMAIL
  AUTOMATION_WEBHOOK
  REVIEW_CODE  // <-- Add this
}
```

Run migration:
```bash
npx prisma migrate dev --name add_review_code_action
```

#### Step 2: Create Backend Handler

Create `lib/workflows/handlers/review-code.ts`:

```typescript
import { WorkflowHandler, WorkflowRuntimeContext, ActionState } from "../types";
import { prisma } from "@/lib/prisma";

// Define config type (from template)
export interface ReviewCodeConfig {
  repositoryUrl: string;
  branchName: string;
  instructions?: string;
}

// Define runtime data type
export interface ReviewCodeData {
  status?: "in_progress" | "approved" | "changes_requested";
  reviewComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  filesReviewed?: number;
}

export class ReviewCodeHandler implements WorkflowHandler<ReviewCodeConfig, ReviewCodeData> {
  async start(ctx: WorkflowRuntimeContext<ReviewCodeConfig, ReviewCodeData>): Promise<ActionState> {
    // Initialize runtime data
    ctx.data.status = "in_progress";
    
    // Log in history
    ctx.history.push({
      timestamp: new Date().toISOString(),
      event: "review_started",
      actor: ctx.user.id,
    });
    
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<ReviewCodeConfig, ReviewCodeData>,
    payload: { approved: boolean; comment: string; filesReviewed: number }
  ): Promise<ActionState> {
    // Validate
    if (!payload.comment || payload.comment.trim().length === 0) {
      throw new Error("Review comment is required");
    }

    // Store result
    ctx.data.status = payload.approved ? "approved" : "changes_requested";
    ctx.data.reviewComment = payload.comment;
    ctx.data.reviewedAt = new Date().toISOString();
    ctx.data.reviewedBy = ctx.user.id;
    ctx.data.filesReviewed = payload.filesReviewed;

    // Log in history
    ctx.history.push({
      timestamp: new Date().toISOString(),
      event: "review_completed",
      actor: ctx.user.id,
      data: { approved: payload.approved },
    });

    return ActionState.COMPLETED;
  }

  async canComplete(ctx: WorkflowRuntimeContext<ReviewCodeConfig, ReviewCodeData>): Promise<boolean> {
    return ctx.data.status === "in_progress";
  }
}
```

Register in `lib/workflows/handlers/index.ts`:
```typescript
import { ReviewCodeHandler } from "./review-code";

registry.register("REVIEW_CODE", new ReviewCodeHandler());
```

#### Step 3: Create Execution Component

Create `components/workflows/execution/ReviewCodeExecution.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Code, CheckCircle2, XCircle } from "lucide-react";

interface ReviewCodeExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
    actionState?: string;
  };
  onComplete: (payload: { approved: boolean; comment: string; filesReviewed: number }) => void;
  isLoading: boolean;
}

export function ReviewCodeExecution({
  step,
  onComplete,
  isLoading,
}: ReviewCodeExecutionProps) {
  const actionData = step.actionData as Record<string, unknown> | null;
  
  const repositoryUrl = (actionData?.repositoryUrl as string) ?? "";
  const branchName = (actionData?.branchName as string) ?? "";
  const instructions = (actionData?.instructions as string) ?? "";
  
  const [comment, setComment] = useState("");
  const [filesReviewed, setFilesReviewed] = useState(0);
  
  const canReview = step.actionState === "IN_PROGRESS";

  const handleApprove = () => {
    onComplete({ approved: true, comment, filesReviewed });
  };

  const handleRequestChanges = () => {
    onComplete({ approved: false, comment, filesReviewed });
  };

  return (
    <div className="mt-3 rounded-lg border-2 border-cyan-200 bg-cyan-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Code className="h-5 w-5 text-cyan-600" />
        <h5 className="font-semibold text-cyan-900">Code Review Required</h5>
      </div>

      {/* Repository Info */}
      <div className="mb-3 rounded-lg border border-cyan-200 bg-white p-3 text-sm">
        <p className="font-medium text-slate-900 mb-1">Repository</p>
        <a
          href={repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-600 hover:underline"
        >
          {repositoryUrl}
        </a>
        <p className="mt-2 text-slate-600">
          <span className="font-medium">Branch:</span> {branchName}
        </p>
      </div>

      {instructions && (
        <div className="mb-3 rounded-lg border border-cyan-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900 mb-1">Instructions</p>
          {instructions}
        </div>
      )}

      {/* Review Form (only in IN_PROGRESS) */}
      {canReview && (
        <>
          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Files Reviewed
            </label>
            <input
              type="number"
              min="0"
              value={filesReviewed}
              onChange={(e) => setFilesReviewed(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Review Comments *
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Provide your review feedback..."
              className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              rows={5}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isLoading || !comment.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Changes
            </button>
            <button
              type="button"
              onClick={handleRequestChanges}
              disabled={isLoading || !comment.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Request Changes
            </button>
          </div>
        </>
      )}

      {/* PENDING/READY state - read-only preview */}
      {!canReview && step.actionState !== "COMPLETED" && (
        <div className="rounded-lg border border-dashed border-cyan-300 bg-white p-4 text-center text-sm text-slate-600">
          Review form will be available when this step starts.
        </div>
      )}
    </div>
  );
}
```

Export in `components/workflows/execution/index.ts`:
```typescript
export { ReviewCodeExecution } from "./ReviewCodeExecution";
```

#### Step 4: Create Viewer Component

Create `components/workflows/output/ReviewCodeViewer.tsx`:

```typescript
"use client";

import { CheckCircle2, XCircle, Code, User, Calendar } from "lucide-react";

interface ReviewCodeViewerProps {
  data: {
    status: "approved" | "changes_requested";
    reviewComment: string;
    reviewedAt: string;
    reviewedBy?: string;
    filesReviewed?: number;
  };
  config: {
    repositoryUrl: string;
    branchName: string;
  };
}

export function ReviewCodeViewer({ data, config }: ReviewCodeViewerProps) {
  const isApproved = data.status === "approved";

  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Code className="h-5 w-5 text-cyan-600" />
        <h4 className="font-semibold text-slate-900">Code Review Results</h4>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isApproved
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-orange-100 text-orange-700 border border-orange-200"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {isApproved ? "Approved" : "Changes Requested"}
        </span>
      </div>

      {/* Repository Info */}
      <div className="mb-3 rounded-lg border border-cyan-200 bg-white p-3 text-sm">
        <a
          href={config.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-600 hover:underline font-medium"
        >
          {config.repositoryUrl}
        </a>
        <p className="mt-1 text-slate-600">Branch: {config.branchName}</p>
      </div>

      {/* Metadata */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {data.reviewedBy && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Reviewed by: {data.reviewedBy}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(data.reviewedAt).toLocaleString("tr-TR")}
        </div>
        {data.filesReviewed !== undefined && (
          <div>Files reviewed: {data.filesReviewed}</div>
        )}
      </div>

      {/* Review Comment */}
      <div className="rounded-lg border border-cyan-200 bg-white p-3">
        <p className="text-xs font-medium text-slate-700 mb-2">Review Comments</p>
        <p className="text-sm text-slate-900 whitespace-pre-wrap">{data.reviewComment}</p>
      </div>
    </div>
  );
}
```

Export in `components/workflows/output/index.ts`:
```typescript
export { ReviewCodeViewer } from "./ReviewCodeViewer";
```

#### Step 5: Integrate in WorkflowStepDetail

Update `components/matters/workflows/WorkflowStepDetail.tsx`:

**In `InProgressStateView.renderExecutionUI()`:**
```typescript
case "REVIEW_CODE":
  return (
    <ReviewCodeExecution
      step={step}
      onComplete={(payload) => {
        void onRunStepAction(step.id, "complete", payload);
      }}
      isLoading={isLoading}
    />
  );
```

**In `CompletedStateView.renderOutputUI()`:**
```typescript
case "REVIEW_CODE":
  if (actionData.status && actionData.reviewComment) {
    return (
      <ReviewCodeViewer
        data={{
          status: actionData.status,
          reviewComment: actionData.reviewComment,
          reviewedAt: actionData.reviewedAt,
          reviewedBy: actionData.reviewedBy,
          filesReviewed: actionData.filesReviewed,
        }}
        config={{
          repositoryUrl: step.actionData?.repositoryUrl || "",
          branchName: step.actionData?.branchName || "",
        }}
      />
    );
  }
  return null;
```

#### Step 6: Add to Template Builder

Update `components/workflows/ActionConfigDisplay.tsx` to show config preview in template builder.

#### Step 7: Test

Create a test workflow:
```bash
tsx scripts/test-review-code-workflow.ts
```

Test all three states:
1. Create instance (steps in PENDING)
2. Start step (IN_PROGRESS with form)
3. Complete review (COMPLETED with results)

---

## Best Practices

### 1. Data Structure
- **Config**: Immutable, from template, describes WHAT to do
- **Runtime Data**: Mutable, stores execution results and state
- **History**: Array of timestamped events for audit trail

### 2. Validation
- Validate in `canComplete()` before allowing completion
- Show real-time validation in execution component
- Provide clear error messages

### 3. Color Schemes
Use consistent color per action type:
- Purple: Approval
- Blue: Checklist
- Orange: Document requests
- Indigo: Signatures, text writing
- Teal: Questionnaires
- Green: Payments, success
- Cyan: Code/technical actions
- Gray: Automated actions

### 4. Accessibility
- Use semantic HTML
- Provide ARIA labels
- Support keyboard navigation
- Include loading states

### 5. Mobile Responsive
- Stack layouts on small screens
- Touch-friendly button sizes (min 44px)
- Test on mobile devices

### 6. Error Handling
- Catch and display errors gracefully
- Provide retry mechanisms
- Log errors for debugging

---

## Common Patterns

### Pattern 1: File Upload Actions
If action involves file uploads:
- Store document IDs in runtime data
- Use DocumentViewer for COMPLETED state
- Show upload progress in IN_PROGRESS

### Pattern 2: External Service Integration
If action calls external API:
- Store API response/errors in runtime data
- Show loading state during API call
- Handle timeout and retry logic

### Pattern 3: Multi-Step Actions
If action has substeps:
- Track substep progress in runtime data
- Show progress indicator in UI
- Allow partial completion save

### Pattern 4: Conditional Branching
If action determines next step:
- Store decision in runtime data
- Use `nextStepOnTrue`/`nextStepOnFalse` in template
- Show branch taken in COMPLETED state

---

## Testing Checklist

- [ ] PENDING state displays correctly
- [ ] IN_PROGRESS shows interactive UI
- [ ] Form validation works
- [ ] Complete action stores data in actionData
- [ ] COMPLETED state shows results
- [ ] actionData persists across page refresh
- [ ] History logs events correctly
- [ ] Role-based access control works
- [ ] Mobile UI is usable
- [ ] Error states display properly

---

## Troubleshooting

### Issue: actionData is null in PENDING
**Solution**: actionData is populated when step is created from template. Check template has actionConfig set.

### Issue: Execution component not showing
**Solution**: Verify step.actionState === "IN_PROGRESS" and component is registered in WorkflowStepDetail switch case.

### Issue: Data not persisting
**Solution**: Ensure handler's complete() method modifies ctx.data and returns COMPLETED state. Check API transaction commits.

### Issue: Viewer showing wrong data
**Solution**: Check data structure matches what viewer expects. Use console.log to inspect actionData in COMPLETED state.

---

## Additional Resources

- [Workflow System Documentation](./MASTER-SYSTEM-DOCUMENTATION.md#workflow-engine)
- [API Handler Pattern](../lib/workflows/README.md)
- [Component Library](../components/workflows/README.md)
- [Database Schema](../prisma/schema.prisma)

---

**Last Updated**: 2025-11-29  
**Version**: 1.0  
**Maintainer**: Legal CRM Development Team
