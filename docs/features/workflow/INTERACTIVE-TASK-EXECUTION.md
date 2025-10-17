# Interactive Task Execution UI

## Overview

This document describes the interactive task execution system implemented in the Matter Detail page. The system replaces generic "Complete" buttons with action-specific UIs that allow users to actually perform workflow tasks (check checklist items, approve with comments, upload documents, etc.).

## Implementation Summary

**File Modified**: `components/matters/MatterDetailClient.tsx`

**Changes Made**:
- Added 4 component-level state declarations for tracking execution data
- Implemented 8 new functions (1 router + 5 action-specific renderers + 2 execution log renderers)
- Enhanced step rendering with visual indicators for task completion
- Removed generic "Complete" button from IN_PROGRESS steps
- Replaced raw JSON config display with hover-based execution log
- Added workflow-level and step-level execution history

## State Management

### Component-Level State

```typescript
// Track checked items for checklist actions (step.id -> Set of checked item texts)
const [checklistStates, setChecklistStates] = useState<Record<string, Set<string>>>({});

// Track approval comments (step.id -> comment text)
const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});

// Track selected files for document requests (step.id -> File or null)
const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});
```

**Design Pattern**: Using `Record<string, T>` pattern allows:
- Each workflow step to have independent state
- Multiple steps of same action type to coexist
- State to persist when user switches between tasks
- No need for local useState in render functions (which causes React errors)

## Execution UI Components

### 1. Router Function

```typescript
function renderStepExecutionUI(step: WorkflowInstanceStep) {
  if (step.actionState !== "IN_PROGRESS") return null;
  
  const config = (step.actionData as any)?.config;
  
  switch (step.actionType) {
    case "CHECKLIST": return renderChecklistExecution(step, config);
    case "APPROVAL_LAWYER": return renderApprovalExecution(step, config);
    case "SIGNATURE_CLIENT": return renderSignatureExecution(step, config);
    case "REQUEST_DOC_CLIENT": return renderDocumentRequestExecution(step, config);
    case "PAYMENT_CLIENT": return renderPaymentExecution(step, config);
    default: return null;
  }
}
```

**Purpose**: Routes to appropriate execution UI based on action type. Only renders when step is IN_PROGRESS.

### 2. Checklist Execution

**Action Type**: `CHECKLIST`

**Visual Theme**: Blue border (`border-blue-200`), light blue background (`bg-blue-50/50`)

**Features**:
- Reads checklist items from `config.items` array
- Displays interactive checkboxes for each item
- Shows progress counter (e.g., "2/5 items checked")
- Disables "Tamamla" button until all items checked
- Uses `checklistStates[step.id]` to track checked items

**User Experience**:
```
┌─────────────────────────────────────────┐
│ ☑ İlk görüşme notları hazırlandı       │
│ ☐ Ücret sözleşmesi hazırlandı          │
│ ☐ Dosya açma formu dolduruldu          │
│                                         │
│ [Tamamla (1/3)]  [✗ Fail]             │
└─────────────────────────────────────────┘
```

**Completion Payload**:
```typescript
{
  checkedItems: Array<string> // All checked item texts
}
```

### 3. Lawyer Approval Execution

**Action Type**: `APPROVAL_LAWYER`

**Visual Theme**: Purple border (`border-purple-200`), light purple background (`bg-purple-50/50`)

**Features**:
- Displays approval message from `config.message`
- Provides textarea for lawyer's comment
- Two distinct buttons: "✓ Onayla" (approve) and "✗ Reddet" (reject)
- Uses `approvalComments[step.id]` for comment text
- Comment is optional but recommended

**User Experience**:
```
┌─────────────────────────────────────────┐
│ Onay: Dava dilekçesini inceleyin        │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Yorum (isteğe bağlı):           │   │
│ │                                 │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [✓ Onayla]  [✗ Reddet]  [✗ Fail]      │
└─────────────────────────────────────────┘
```

**Completion Payload**:
```typescript
{
  approved: boolean,  // true for approve, false for reject
  comment?: string    // Optional lawyer comment
}
```

### 4. Signature Execution

**Action Type**: `SIGNATURE_CLIENT`

**Visual Theme**: Indigo border (`border-indigo-200`), light indigo background (`bg-indigo-50/50`)

**Features**:
- Shows document ID and signature provider
- Placeholder for signature integration (DocuSign, HelloSign, etc.)
- Single completion button: "✓ İmzala ve Tamamla"
- Ready for integration with e-signature services

**User Experience**:
```
┌─────────────────────────────────────────┐
│ İmzalanacak Belge: doc_123              │
│ Sağlayıcı: DocuSign                     │
│                                         │
│ ┌───────────────────────────────────┐ │
│ │   [İmza alanı buraya gelecek]     │ │
│ └───────────────────────────────────┘ │
│                                         │
│ [✓ İmzala ve Tamamla]  [✗ Fail]       │
└─────────────────────────────────────────┘
```

**Completion Payload**:
```typescript
{
  signedDocumentId: string,  // ID of signed document
  provider: string           // Signature provider name
}
```

### 5. Document Request Execution

**Action Type**: `REQUEST_DOC_CLIENT`

**Visual Theme**: Orange border (`border-orange-200`), light orange background (`bg-orange-50/50`)

**Features**:
- Displays request text from `config.requestText`
- Shows accepted file types (e.g., "PDF, DOC, DOCX")
- File input for document selection
- Displays selected filename
- Disables upload button until file selected
- Uses `documentFiles[step.id]` to store selected file

**User Experience**:
```
┌─────────────────────────────────────────┐
│ Nüfus cüzdanı fotokopisini yükleyin    │
│                                         │
│ Kabul edilen: PDF, JPG, PNG             │
│                                         │
│ [Dosya Seç...]  contract.pdf            │
│                                         │
│ [✓ Yükle ve Tamamla]  [✗ Fail]        │
└─────────────────────────────────────────┘
```

**Completion Payload**:
```typescript
{
  uploadedFileId: string,    // ID of uploaded document
  originalFilename: string   // Original filename
}
```

### 6. Payment Execution

**Action Type**: `PAYMENT_CLIENT`

**Visual Theme**: Green border (`border-green-200`), light green background (`bg-green-50/50`)

**Features**:
- Displays formatted amount with currency (using `Intl.NumberFormat("tr-TR")`)
- Shows payment provider info
- Placeholder for payment form integration (Stripe, İyzico, etc.)
- Single completion button: "✓ Ödemeyi Tamamla"
- Ready for payment gateway integration

**User Experience**:
```
┌─────────────────────────────────────────┐
│ Tutar: ₺5.000,00                        │
│ Sağlayıcı: İyzico                       │
│                                         │
│ ┌───────────────────────────────────┐ │
│ │   [Ödeme formu buraya gelecek]    │ │
│ └───────────────────────────────────┘ │
│                                         │
│ [✓ Ödemeyi Tamamla]  [✗ Fail]         │
└─────────────────────────────────────────┘
```

**Completion Payload**:
```typescript
{
  transactionId: string,     // Payment transaction ID
  amount: number,            // Paid amount
  provider: string           // Payment provider name
}
```

## Visual Indicators for Task States

### Step Border Colors

Each step now has a color-coded border based on its state:

```typescript
const isCompleted = step.actionState === "COMPLETED";
const isSkipped = step.actionState === "SKIPPED";
const isInProgress = step.actionState === "IN_PROGRESS";

className={`rounded-lg border-2 px-3 py-2 text-sm ${
  isCompleted
    ? "border-emerald-300 bg-emerald-50/50"    // Green for completed
    : isSkipped
    ? "border-yellow-300 bg-yellow-50/50"      // Yellow for skipped
    : isInProgress
    ? "border-blue-300 bg-blue-50/50"          // Blue for in progress
    : "border-slate-200 bg-white"              // Gray for ready/pending
}`}
```

### State Icons

Visual indicators are shown next to step titles:

- **✓** (green) - Completed tasks
- **⊘** (yellow) - Skipped tasks

```typescript
{isCompleted && (
  <span className="text-emerald-600" title="Tamamlandı">
    ✓
  </span>
)}
{isSkipped && (
  <span className="text-yellow-600" title="Atlandı">
    ⊘
  </span>
)}
```

## Integration Points

### Step Rendering

The execution UI is integrated into the step rendering at line 1264:

```typescript
{workflow.steps.map((step, index) => {
  const isCompleted = step.actionState === "COMPLETED";
  const isSkipped = step.actionState === "SKIPPED";
  const isInProgress = step.actionState === "IN_PROGRESS";
  
  return (
    <div key={step.id} className={/* color-coded border */}>
      {/* Step metadata */}
      <div className="font-medium">
        {step.title}
        {isCompleted && <span>✓</span>}
        {isSkipped && <span>⊘</span>}
      </div>
      
      {/* Action buttons */}
      {renderStepActions(workflow, step, index)}
      
      {/* Action-specific execution UI */}
      {renderStepExecutionUI(step)}
    </div>
  );
})}
```

### API Integration

Each execution UI calls the existing `runStepAction()` function with action-specific payload:

```typescript
async function runStepAction(
  workflowId: string,
  step: WorkflowInstanceStep,
  action: "start" | "complete" | "fail" | "claim",
  payload?: Record<string, any>
) {
  setActionLoading(step.id);
  try {
    const response = await fetch(`/api/workflows/instances/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId: step.id,
        action,
        ...payload,  // Action-specific data goes here
      }),
    });
    
    if (!response.ok) throw new Error("Action failed");
    
    await loadMatter();  // Reload to get updated state
    showToast("success", `Step ${action}ed successfully`);
  } catch (error) {
    showToast("error", `Failed to ${action} step`);
  } finally {
    setActionLoading(null);
  }
}
```

## Backend Handler Processing

Each task handler (`lib/workflows/task-handlers/*.ts`) receives the execution payload and can validate/process it:

```typescript
// Example: ChecklistTaskHandler
async execute(context: WorkflowContext, step: WorkflowInstanceStep) {
  const config = (step.actionData as any)?.config;
  const payload = (step.actionData as any)?.payload;
  
  // Validate all items were checked
  if (config?.items?.length) {
    const checkedItems = payload?.checkedItems || [];
    if (checkedItems.length !== config.items.length) {
      throw new Error("All checklist items must be completed");
    }
  }
  
  // Process completion...
  return {
    nextStepId: step.nextStepId,
    contextUpdates: {
      [`step_${step.id}_checklist_completed`]: payload?.checkedItems || [],
    },
  };
}
```

## Benefits

### User Experience
- ✅ Clear understanding of what each task requires
- ✅ Interactive elements for task-specific actions
- ✅ Visual feedback on task progress
- ✅ Disabled buttons prevent incomplete submissions
- ✅ Color-coded themes improve task recognition
- ✅ Easy identification of completed vs pending tasks

### Developer Experience
- ✅ Centralized state management pattern
- ✅ Type-safe execution payloads
- ✅ Reusable component pattern
- ✅ Easy to add new action types
- ✅ Clean separation of concerns

### Business Value
- ✅ Reduces errors from unclear task requirements
- ✅ Improves workflow completion rates
- ✅ Provides audit trail through structured payloads
- ✅ Enables better reporting on task-specific data
- ✅ Facilitates integration with external services

## Future Enhancements

### Short-term
1. **Document Upload Integration**: Connect document request UI to actual file upload API
2. **Signature Integration**: Integrate with DocuSign or similar e-signature service
3. **Payment Integration**: Connect to payment gateway (Stripe, İyzico)
4. **Validation Messages**: Show inline validation errors for incomplete data
5. **Progress Persistence**: Save draft progress for partially completed tasks

### Medium-term
1. **Collapsible Completed Tasks**: Allow users to collapse completed steps to reduce clutter
2. **Task Summary Display**: Show completion data in collapsed completed steps
3. **Bulk Actions**: Allow completing multiple checklist items at once
4. **File Preview**: Show preview of uploaded documents before completion
5. **Payment Status Tracking**: Real-time payment status updates

### Long-term
1. **Custom Action Types**: Allow admins to define new action types with custom UIs
2. **Conditional Fields**: Show/hide fields based on user input
3. **Multi-step Actions**: Break complex actions into sub-steps
4. **Offline Support**: Allow task progress to be saved locally when offline
5. **Mobile Optimization**: Optimize execution UIs for mobile devices

## Testing Checklist

### Functional Testing
- [ ] Start checklist step and check/uncheck items
- [ ] Verify complete button disabled until all items checked
- [ ] Complete checklist and verify payload sent correctly
- [ ] Start approval step and add comment
- [ ] Approve task with and without comment
- [ ] Reject task with and without comment
- [ ] Start document request and select file
- [ ] Verify complete button disabled until file selected
- [ ] Upload document and verify file sent correctly
- [ ] Verify signature and payment placeholder UIs display
- [ ] Test fail button on all action types

### Visual Testing
- [ ] Verify completed steps have green border and checkmark
- [ ] Verify skipped steps have yellow border and ⊘ icon
- [ ] Verify in-progress steps have blue border
- [ ] Verify each action type has correct color theme
- [ ] Verify responsive layout on mobile devices
- [ ] Verify accessibility (keyboard navigation, screen readers)

### Error Handling
- [ ] Test network failure during task completion
- [ ] Test invalid file types for document upload
- [ ] Test large file uploads (size limits)
- [ ] Test simultaneous completion attempts
- [ ] Test completion after session timeout

## Configuration Examples

### Checklist Template
```json
{
  "actionType": "CHECKLIST",
  "actionData": {
    "config": {
      "items": [
        "İlk görüşme notları hazırlandı",
        "Ücret sözleşmesi hazırlandı",
        "Dosya açma formu dolduruldu"
      ]
    }
  }
}
```

### Approval Template
```json
{
  "actionType": "APPROVAL_LAWYER",
  "actionData": {
    "config": {
      "message": "Dava dilekçesini inceleyin ve onaylayın"
    }
  }
}
```

### Document Request Template
```json
{
  "actionType": "REQUEST_DOC_CLIENT",
  "actionData": {
    "config": {
      "requestText": "Nüfus cüzdanı fotokopisini yükleyin",
      "acceptedTypes": ["application/pdf", "image/jpeg", "image/png"]
    }
  }
}
```

### Signature Template
```json
{
  "actionType": "SIGNATURE_CLIENT",
  "actionData": {
    "config": {
      "documentId": "doc_123",
      "provider": "DocuSign"
    }
  }
}
```

### Payment Template
```json
{
  "actionType": "PAYMENT_CLIENT",
  "actionData": {
    "config": {
      "amount": 5000.00,
      "currency": "TRY",
      "provider": "İyzico"
    }
  }
}
```

## Execution Log System

### Overview

Instead of displaying raw JSON configuration data, the system now provides hover-based execution logs that show:
- Task lifecycle events (started, completed, skipped)
- Action-specific completion details
- Timestamps for all events
- Human-readable audit trail

### Step-Level Execution Log

Each step displays a "Geçmiş" (History) button that shows execution log on hover:

```tsx
{(step.startedAt || step.completedAt) && (
  <div className="relative inline-block group">
    <button className="...">
      <svg>🕐</svg> Geçmiş
    </button>
    {hoveredStep === step.id && (
      <div className="popup">
        {renderExecutionLog(step)}
      </div>
    )}
  </div>
)}
```

**Log Contents**:
- **Start event**: "Görev başlatıldı" with timestamp
- **Completion event**: "Görev tamamlandı" or "Görev atlandı" with details
- **Action-specific details**:
  - Checklist: "5 madde tamamlandı"
  - Approval: "✓ Onaylandı: 'Lawyer comment here'" or "✗ Reddedildi"
  - Document: "Belge yüklendi: filename.pdf"
  - Signature: "Belge imzalandı: doc_123"
  - Payment: "Ödeme tamamlandı: 5000.00 TRY"

### Workflow-Level Execution Log

Each workflow displays a "Geçmiş" button in the header showing complete workflow history:

```tsx
<button className="bg-blue-50 text-blue-700">
  <svg>📄</svg> Geçmiş
</button>
{hoveredStep === `workflow-${workflow.id}` && (
  <div className="popup">
    {renderWorkflowExecutionLog(workflow)}
  </div>
)}
```

**Log Contents**:
- **Workflow creation**: "İş akışı oluşturuldu" with creator info
- **All step events**: Chronologically sorted list of all step starts and completions
- **Scrollable view**: Max height with overflow for long workflows

**Example Timeline**:
```
İş akışı oluşturuldu                    15.10.2025 14:30
  Oluşturan: Ahmet Yavuz

"İlk Görüşme" başlatıldı                15.10.2025 14:35

"İlk Görüşme" tamamlandı                15.10.2025 15:20

"Avukat Onayı" başlatıldı               15.10.2025 15:21

"Avukat Onayı" tamamlandı               15.10.2025 16:45
```

### Benefits

**User Experience**:
- ✅ No more confusing JSON objects cluttering the UI
- ✅ Clean, professional appearance
- ✅ Easy to understand audit trail
- ✅ Hover interaction keeps UI clean when not needed
- ✅ Action-specific details provide context

**Compliance & Audit**:
- ✅ Complete audit trail for regulatory compliance
- ✅ Timestamps for all actions
- ✅ User attribution (who did what)
- ✅ Action-specific completion details
- ✅ Easy to export/document for legal proceedings

**Technical**:
- ✅ Lightweight hover popups (no modals)
- ✅ Proper z-index stacking
- ✅ Mouse enter/leave events for smooth UX
- ✅ Responsive width (320px for step, 384px for workflow)
- ✅ Scrollable for long histories

## Implementation Statistics

- **Files Modified**: 2 (MatterDetailClient.tsx, eslint.config.mjs)
- **Lines Added**: ~950 lines
- **Functions Created**: 8 (renderStepExecutionUI + 5 action-specific renderers + 2 execution log renderers)
- **State Variables Added**: 4 (checklistStates, approvalComments, documentFiles, hoveredStep)
- **Action Types Supported**: 5 (CHECKLIST, APPROVAL_LAWYER, SIGNATURE_CLIENT, REQUEST_DOC_CLIENT, PAYMENT_CLIENT)
- **Color Themes**: 5 (Blue, Purple, Indigo, Orange, Green)
- **Interactive Elements**: Checkboxes, textareas, file inputs, multiple button types, hover popups
- **Visual Indicators**: 2 state icons (✓ completed, ⊘ skipped), 4 border colors, 2 execution log icons

---

**Status**: ✅ Implementation Complete
**Next Steps**: Testing with real workflow data
**Documentation**: This file
**Related Docs**: 
- `TASK-HANDLER-AUTHORIZATION.md` - Task handler RBAC system
- `TASK-HANDLER-IMPLEMENTATION-SUMMARY.md` - Task handler architecture
