# Bug Fix: Workflow Step Output Not Displaying

**Date**: 2025-10-17
**Status**: ✅ Fixed
**Severity**: High - User-facing feature completely broken
**Component**: Workflow Step Output Display

---

## Problem Description

Completed workflow steps were not displaying their output/results in the Matter Detail page. Specifically:

- ✅ Workflow steps marked as "COMPLETED" 
- ❌ No output visible (e.g., questionnaire responses, written text, documents)
- Expected: Completed questionnaire should show all questions and answers

---

## Root Cause

**Incorrect data path in output rendering logic**

The `WorkflowStepCard` component was attempting to access step output data using the wrong JSON path:

```typescript
// ❌ INCORRECT - Looking for nested .data property
if (step.actionData?.data) {
  const data = step.actionData.data as any;
  if (data.responseId) { ... }
}
```

However, workflow handlers store their data **directly at the root level** of `actionData`, not in a nested `data` property:

```typescript
// ✅ CORRECT - Data is at root level of actionData
{
  config: { questionnaireId: "...", title: "..." },
  history: [...],
  responseId: "resp_123",          // ← Handler-added data here
  questionnaireId: "quest_456",     // ← Not in .data property
  questionnaireTitle: "...",
  answerCount: 5
}
```

---

## Technical Details

### How Workflow Data is Stored

1. **Handler Context (`ctx.data`)**:
   - Handlers (e.g., `PopulateQuestionnaireActionHandler`) store data in `ctx.data`
   - Example: `ctx.data.responseId = response.id`

2. **Persisted to Database**:
   - `ctx.data` is merged into the root level of `actionData` JSON
   - Schema: `actionData: { config, history, ...handlerData }`
   - NOT: `actionData: { config, history, data: { ...handlerData } }`

3. **Retrieved in UI**:
   - Component receives `step.actionData` as JSON object
   - Handler fields are at root level, not in `.data` property

### Code Flow

```typescript
// Handler (lib/workflows/handlers/populate-questionnaire.ts)
async complete(ctx, payload) {
  ctx.data.responseId = response.id;
  ctx.data.questionnaireTitle = response.questionnaire.title;
  // ...
}

// Runtime persists to DB (lib/workflows/runtime.ts)
await tx.workflowInstanceStep.update({
  data: {
    actionData: {
      config: {...},
      history: [...],
      responseId: "...",      // ← ctx.data fields merged here
      questionnaireTitle: "..."
    }
  }
});

// UI accesses (components/matters/workflows/WorkflowStepCard.tsx)
const actionData = step.actionData;  // Not step.actionData.data
if (actionData.responseId) {
  return <QuestionnaireResponseViewer responseId={actionData.responseId} />;
}
```

---

## Solution

Changed the output rendering logic to access data at the correct path.

### Files Modified

**`/components/matters/workflows/WorkflowStepCard.tsx`**

**Before (Broken)**:
```typescript
const renderStepOutputUI = () => {
  if (step.actionState !== "COMPLETED" || !step.actionData?.data) {
    return null;
  }

  const data = step.actionData.data as any;  // ❌ .data doesn't exist

  switch (step.actionType) {
    case "POPULATE_QUESTIONNAIRE":
      if (data.responseId) {  // ❌ Always undefined
        return <QuestionnaireResponseViewer responseId={data.responseId} />;
      }
      return null;

    case "WRITE_TEXT":
      if (data.content) {  // ❌ Always undefined
        return <WriteTextViewer content={data.content} />;
      }
      return null;

    // ... other cases
  }
};
```

**After (Fixed)**:
```typescript
const renderStepOutputUI = () => {
  if (step.actionState !== "COMPLETED" || !step.actionData) {
    return null;
  }

  const actionData = step.actionData as any;  // ✅ Access root level

  switch (step.actionType) {
    case "POPULATE_QUESTIONNAIRE":
      if (actionData.responseId) {  // ✅ Correctly finds responseId
        return <QuestionnaireResponseViewer responseId={actionData.responseId} />;
      }
      return null;

    case "WRITE_TEXT":
      if (actionData.content) {  // ✅ Correctly finds content
        return <WriteTextViewer content={actionData.content} />;
      }
      return null;

    case "REQUEST_DOC_CLIENT":
      if (actionData.documentId) {  // ✅ Correctly finds documentId
        return <DocumentViewer documentIds={[actionData.documentId]} />;
      }
      return null;

    case "CHECKLIST":
      if (actionData.completedItems && Array.isArray(actionData.completedItems)) {
        const config = (step.actionData as any)?.config;
        const items = config?.items || [];
        const checklistItems = items.map((item: string) => ({
          id: item,
          text: item,
          checked: actionData.completedItems.includes(item),  // ✅ Fixed
        }));
        return <ChecklistViewer items={checklistItems} metadata={{...}} />;
      }
      return null;

    default:
      return null;
  }
};
```

**Changes Summary**:
1. Changed condition: `!step.actionData?.data` → `!step.actionData`
2. Changed variable: `const data = step.actionData.data` → `const actionData = step.actionData`
3. Updated all references: `data.responseId` → `actionData.responseId`
4. Applied to all action types: POPULATE_QUESTIONNAIRE, WRITE_TEXT, REQUEST_DOC_CLIENT, CHECKLIST

---

## Testing Steps

1. **Setup**:
   - Create workflow with "Populate Questionnaire" step
   - Assign questionnaire to matter
   - Start and complete the step by filling out questionnaire

2. **Before Fix**:
   - ❌ Step shows "COMPLETED" badge
   - ❌ No questionnaire responses visible below step card

3. **After Fix**:
   - ✅ Step shows "COMPLETED" badge
   - ✅ Questionnaire responses displayed in expandable viewer
   - ✅ All questions and answers visible
   - ✅ Proper formatting and styling

4. **Other Action Types**:
   - WRITE_TEXT: Text content displays
   - REQUEST_DOC_CLIENT: Document preview shows
   - CHECKLIST: Completed items marked with checkmarks

---

## Impact

**Before Fix**:
- Users couldn't see completed questionnaire responses
- Workflow outputs were invisible
- Had to check database directly to verify task completion
- Poor user experience

**After Fix**:
- All completed workflow step outputs now visible
- Questionnaire responses properly displayed
- Matter team can review all task results
- Complete audit trail of workflow execution

---

## Related Issues

- **JSON Parsing Error**: Fixed in `question-options-json-parsing-error.md`
- **Missing Input Fields**: Fixed in `missing-question-input-fields.md`
- **Phase 7 Implementation**: Output visibility feature (MASTER-SYSTEM-DOCUMENTATION.md)

---

## Prevention

**Future Development Guidelines**:

1. **Understand Data Schema**:
   - Always check how handlers store data (`ctx.data`)
   - Verify database schema for JSON fields
   - Don't assume nested structure without verification

2. **Type Safety**:
   - Define TypeScript interfaces for `actionData` structure
   - Document JSON schema for each action type
   - Use type guards when accessing nested properties

3. **Testing**:
   - Test end-to-end: handler → database → UI retrieval
   - Verify data path matches across all layers
   - Add console logging during development, remove in production

4. **Documentation**:
   - Document data flow in handler comments
   - Include example `actionData` JSON in handler files
   - Update schema docs when changing data structure

---

## Example Action Data Structures

### POPULATE_QUESTIONNAIRE
```json
{
  "config": {
    "questionnaireId": "quest_123",
    "title": "Client Intake Form",
    "description": "Complete the intake questionnaire"
  },
  "history": [
    { "at": "2025-10-17T10:00:00Z", "event": "STARTED" },
    { "at": "2025-10-17T10:15:00Z", "event": "COMPLETED", "payload": { "responseId": "resp_456" } }
  ],
  "responseId": "resp_456",
  "questionnaireId": "quest_123",
  "questionnaireTitle": "Client Intake Form",
  "startedAt": "2025-10-17T10:00:00Z",
  "completedAt": "2025-10-17T10:15:00Z",
  "completedBy": "user_789",
  "answerCount": 5
}
```

### WRITE_TEXT
```json
{
  "config": {
    "title": "Draft Cover Letter",
    "description": "Write a cover letter for the client"
  },
  "history": [...],
  "content": "Dear Client,\n\nThis is your cover letter...",
  "characterCount": 250,
  "wordCount": 45
}
```

### CHECKLIST
```json
{
  "config": {
    "items": ["Review documents", "Contact client", "File paperwork"]
  },
  "history": [...],
  "completedItems": ["Review documents", "Contact client"]
}
```

---

## Lessons Learned

1. **Assumptions Are Dangerous**: Don't assume data structure without verification
2. **Test Data Flow**: Follow data from handler → DB → UI in one flow
3. **Debug Early**: Add logging to identify data path issues quickly
4. **Schema Documentation**: Keep data schemas documented and up-to-date
5. **Type Safety Helps**: TypeScript can catch these issues with proper types

---

**Status**: ✅ **RESOLVED**
**Fix Verified**: 2025-10-17
**Affected Versions**: All versions prior to this fix
**Breaking Changes**: None - backward compatible fix
