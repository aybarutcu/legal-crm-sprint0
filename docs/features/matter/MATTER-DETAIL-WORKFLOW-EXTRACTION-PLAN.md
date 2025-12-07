# MatterDetailClient Refactoring Plan - Workflow Components Extraction

## Current State
- **File:** `components/matters/MatterDetailClient.tsx`
- **Current Size:** 1,629 lines
- **Target Size:** ~300-400 lines (after both Task #10 and #11)
- **Task #10 Goal:** Extract workflow components (~530 lines)
- **Task #11 Goal:** Extract matter section components (~240 lines)

## Task #10: Extract Workflow Components

### Components to Create

#### 1. `WorkflowStepCard.tsx` (~200 lines)
**Purpose:** Display individual workflow step with all actions and UI

**Props:**
```typescript
interface WorkflowStepCardProps {
  step: WorkflowInstanceStep;
  workflow: WorkflowInstance;
  index: number;
  actionLoading: string | null;
  hoveredStep: string | null;
  onSetHoveredStep: (stepId: string | null) => void;
  onOpenEditStep: (instanceId: string, step: WorkflowInstanceStep) => void;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  currentUserRole: string;
  // Execution UI state
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onToggleChecklistItem: (stepId: string, item: string) => void;
  onCommentChange: (stepId: string, comment: string) => void;
  onFileChange: (stepId: string, file: File | null) => void;
}
```

**Responsibilities:**
- Render step card with styling based on state (completed, skipped, in progress)
- Display step title, action type, role scope, required status
- Show ActionConfigDisplay for task configuration
- Display execution history with hover popup
- Render step actions (Start, Claim, Fail, Skip, Edit, Move, Delete)
- Render step execution UI (ChecklistExecution, ApprovalExecution, etc.)
- Handle all step-related state display

**Key Sections to Extract:**
- Lines ~1300-1390: Step card rendering
- Includes state badges, action config display, execution log, step actions
- Integrates with execution components

---

#### 2. `WorkflowInstanceCard.tsx` (~250 lines)
**Purpose:** Display complete workflow instance with all steps

**Props:**
```typescript
interface WorkflowInstanceCardProps {
  workflow: WorkflowInstance;
  actionLoading: string | null;
  stepFormState: {
    mode: "add" | "edit";
    instanceId: string;
    stepId?: string;
  } | null;
  stepFormValues: {
    title: string;
    actionType: ActionType;
    roleScope: RoleScope;
    required: boolean;
    actionConfig: string;
  };
  hoveredStep: string | null;
  isWorkflowRemovable: boolean;
  currentUserRole: string;
  onSetHoveredStep: (stepId: string | null) => void;
  onOpenAddStep: (instanceId: string) => void;
  onOpenEditStep: (instanceId: string, step: WorkflowInstanceStep) => void;
  onCloseStepForm: () => void;
  onSetStepFormValues: (values: any) => void;
  onSubmitStepForm: () => Promise<void>;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onRemoveWorkflow: (instanceId: string) => Promise<void>;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  // Execution UI state  
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onToggleChecklistItem: (stepId: string, item: string) => void;
  onCommentChange: (stepId: string, comment: string) => void;
  onFileChange: (stepId: string, file: File | null) => void;
}
```

**Responsibilities:**
- Render workflow header (name, status, created by, created date)
- Display workflow-level execution log with hover
- Show workflow actions (Add Step, Advance, Remove)
- Render step form (add/edit step)
- Display WorkflowContextPanel
- Render all WorkflowStepCards
- Manage workflow-level state

**Key Sections to Extract:**
- Lines ~1213-1410: Workflow instance rendering
- Includes header, action buttons, step form, context panel
- Maps through steps to render WorkflowStepCard components

---

#### 3. `MatterWorkflowsSection.tsx` (~80 lines)
**Purpose:** Container for all workflows in a matter

**Props:**
```typescript
interface MatterWorkflowsSectionProps {
  workflows: WorkflowInstance[];
  workflowsLoading: boolean;
  onOpenWorkflowModal: () => void;
  // All props from WorkflowInstanceCard
  ...WorkflowInstanceCardProps (minus workflow prop);
}
```

**Responsibilities:**
- Display "Workflows" section header
- Show "Add Workflow" button
- Display loading state
- Display empty state ("No workflows...")
- Map through workflows to render WorkflowInstanceCard components

**Key Sections to Extract:**
- Lines ~1190-1415: Workflows section container
- Header, add button, loading/empty states, workflow list

---

### Type Definitions to Move

Create `components/matters/workflows/types.ts`:
```typescript
export type ActionState = 
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type ActionType =
  | "CHECKLIST"
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT";

export type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

export type WorkflowInstanceStep = {
  id: string;
  order: number;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: Record<string, unknown> | null;
  assignedToId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowInstance = {
  id: string;
  status: string;
  createdAt: string;
  createdBy: { name?: string; email?: string } | null;
  template: {
    name: string;
  };
  steps: WorkflowInstanceStep[];
};
```

---

### Helper Functions to Move

Create `components/matters/workflows/utils.ts`:
```typescript
export function getStepClasses(
  kind: "prev" | "current" | "next",
  state?: ActionState
): string {
  if (kind === "next") return "border-slate-200 bg-white text-slate-700";
  if (kind === "prev") {
    switch (state) {
      case "COMPLETED":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "FAILED":
        return "border-red-200 bg-red-50 text-red-700";
      case "SKIPPED":
        return "border-slate-200 bg-slate-50 text-slate-600";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600";
    }
  }
  switch (state) {
    case "READY":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "IN_PROGRESS":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "BLOCKED":
      return "border-red-200 bg-red-50 text-red-700";
    case "PENDING":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function defaultConfigFor(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    case "APPROVAL":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC":
      return { requestText: "", documentNames: [] };
    case "PAYMENT":
      return { amount: 0, currency: "USD", provider: "mock" };
    case "CHECKLIST":
    default:
      return { items: [] };
  }
}

export function isTerminalState(state: ActionState): boolean {
  return state === "COMPLETED" || state === "FAILED" || state === "SKIPPED";
}
```

---

### Barrel Export

Create `components/matters/workflows/index.ts`:
```typescript
export { MatterWorkflowsSection } from "./MatterWorkflowsSection";
export { WorkflowInstanceCard } from "./WorkflowInstanceCard";
export { WorkflowStepCard } from "./WorkflowStepCard";
export * from "./types";
export * from "./utils";
```

---

## Integration into MatterDetailClient

### Before (Current):
```tsx
// ~550 lines of workflow rendering logic inline
<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
  <div className="flex items-center justify-between">
    <h3>Workflows</h3>
    <button onClick={() => setWorkflowModalOpen(true)}>Add Workflow</button>
  </div>
  <div className="mt-4 space-y-4">
    {workflowsLoading ? (...) : workflows.length === 0 ? (...) : (
      workflows.map((workflow) => (
        <article key={workflow.id}>
          {/* 350+ lines of workflow rendering */}
        </article>
      ))
    )}
  </div>
</div>
```

### After (Target):
```tsx
<MatterWorkflowsSection
  workflows={workflows}
  workflowsLoading={workflowsLoading}
  onOpenWorkflowModal={() => setWorkflowModalOpen(true)}
  actionLoading={actionLoading}
  stepFormState={stepFormState}
  stepFormValues={stepFormValues}
  hoveredStep={hoveredStep}
  isWorkflowRemovable={isWorkflowRemovable}
  currentUserRole={currentUserRole}
  onSetHoveredStep={setHoveredStep}
  onOpenAddStep={openAddStep}
  onOpenEditStep={openEditStep}
  onCloseStepForm={closeStepForm}
  onSetStepFormValues={setStepFormValues}
  onSubmitStepForm={submitStepForm}
  onRunStepAction={runStepAction}
  onRemoveWorkflow={removeWorkflow}
  onMoveStep={moveStep}
  onDeleteStep={deleteStep}
  checklistStates={checklistStates}
  approvalComments={approvalComments}
  documentFiles={documentFiles}
  onToggleChecklistItem={(stepId, item) => {
    setChecklistStates((prev) => {
      const current = prev[stepId] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return { ...prev, [stepId]: next };
    });
  }}
  onCommentChange={(stepId, comment) => {
    setApprovalComments((prev) => ({ ...prev, [stepId]: comment }));
  }}
  onFileChange={(stepId, file) => {
    setDocumentFiles((prev) => ({ ...prev, [stepId]: file }));
  }}
/>
```

---

## Benefits

1. **Reduced Complexity:** MatterDetailClient from 1,629 → ~1,100 lines
2. **Reusability:** Workflow components can be used elsewhere
3. **Testability:** Easier to test individual workflow components
4. **Maintainability:** Changes to workflow UI isolated to dedicated files
5. **Readability:** Clear component hierarchy and responsibilities

---

## Testing Plan

After extraction:
- [ ] Verify workflows section renders correctly
- [ ] Test workflow instance cards display properly
- [ ] Verify step cards show all information
- [ ] Test step actions (Start, Claim, Fail, Skip, Edit, Move, Delete)
- [ ] Verify execution UI works (checklist, approval, etc.)
- [ ] Test hover popups for execution logs
- [ ] Verify step form (add/edit) functionality
- [ ] Test workflow removal
- [ ] Check context panel display
- [ ] Verify all state management still works

---

## Next: Task #11

After completing Task #10, proceed with Task #11:
- Extract MatterPartiesSection (~100 lines)
- Extract MatterDocumentsSection (~90 lines)
- Extract MatterStatusUpdateSection (~50 lines)

Final target: MatterDetailClient ~300-400 lines

---

**Status:** Ready to implement
**Estimated Time:** 3-4 hours
**Priority:** High
