# Bug Fix: Questionnaire Workflow Completion Error

**Date**: October 17, 2025  
**Status**: ✅ Fixed  
**Severity**: Critical - Blocking questionnaire workflow completion  
**Components Affected**: Workflow Execution (Phase 6)

## Problem

When attempting to complete a questionnaire within a workflow step, the system threw a validation error:

```
ActionHandlerError: Invalid completion payload: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["responseId"],
    "message": "Required"
  }
]
```

**Error occurred at**: `/api/workflows/steps/[id]/complete` (POST)

## Root Cause

The `PopulateQuestionnaireActionHandler.complete()` method expects a `responseId` in the payload:

```typescript
const completePayloadSchema = z.object({
  responseId: z.string().min(1, "Response ID is required"),
});
```

However, the `PopulateQuestionnaireExecution` component was submitting the raw answers array directly to the completion handler, without first creating a questionnaire response in the database.

**The workflow was**:
1. User fills out questionnaire form ✅
2. Component calls `onComplete(answers)` ❌ **Wrong - no responseId**
3. Handler expects `{ responseId: string }` ❌ **Validation fails**

**The workflow should be**:
1. User fills out questionnaire form ✅
2. Component creates questionnaire response via API ✅
3. Component calls `onComplete({ responseId })` ✅
4. Handler validates and stores responseId ✅

## Solution

Updated `PopulateQuestionnaireExecution` component to create the questionnaire response before completing the workflow step.

### 1. Updated Component Props

Changed the onComplete callback signature to expect `responseId`:

**Before**:
```typescript
interface PopulateQuestionnaireExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: (answers: Array<{ questionId: string; answerText?: string; answerJson?: string | string[] }>) => void;
  isLoading: boolean;
}
```

**After**:
```typescript
interface PopulateQuestionnaireExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  matterId: string; // NEW: Required to create response
  onComplete: (payload: { responseId: string }) => void; // CHANGED: Now expects responseId
  isLoading: boolean;
}
```

### 2. Updated Submit Handler

Changed `handleSubmit` to be async and implement a 3-step process:

**Before**:
```typescript
const handleSubmit = () => {
  // Validate...
  
  // Format answers
  const formattedAnswers = questions.map(/* ... */);
  
  // Submit directly
  onComplete(formattedAnswers); // ❌ No responseId
};
```

**After**:
```typescript
const handleSubmit = async () => {
  // Validate...
  
  setSubmitting(true);
  try {
    // Format answers
    const formattedAnswers = questions.map(/* ... */);

    // Step 1: Create questionnaire response
    const createResponse = await fetch("/api/questionnaire-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionnaireId,
        matterId,
      }),
    });

    if (!createResponse.ok) {
      const data = await createResponse.json().catch(() => null);
      throw new Error(data?.error || "Failed to create questionnaire response");
    }

    const { response: createdResponse } = await createResponse.json();

    // Step 2: Save answers
    const saveAnswersResponse = await fetch(`/api/questionnaire-responses/${createdResponse.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: formattedAnswers,
      }),
    });

    if (!saveAnswersResponse.ok) {
      const data = await saveAnswersResponse.json().catch(() => null);
      throw new Error(data?.error || "Failed to save answers");
    }

    // Step 3: Mark as completed
    const completeResponse = await fetch(`/api/questionnaire-responses/${createdResponse.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!completeResponse.ok) {
      const data = await completeResponse.json().catch(() => null);
      throw new Error(data?.error || "Failed to complete questionnaire");
    }
    
    // Step 4: Pass the responseId to the completion handler
    onComplete({ responseId: createdResponse.id }); // ✅ Correct
  } catch (err) {
    console.error("Failed to submit questionnaire:", err);
    setError(err instanceof Error ? err.message : "Failed to submit questionnaire");
    setSubmitting(false);
  }
};
```

**Why 3 API calls?**:
The questionnaire response API follows a state-based pattern:
1. POST `/api/questionnaire-responses` - Creates response with `IN_PROGRESS` status
2. PATCH `/api/questionnaire-responses/[id]` - Saves answers (can be called multiple times for progressive saving)
3. POST `/api/questionnaire-responses/[id]/complete` - Validates all required questions answered and marks as `COMPLETED`

This design allows for:
- Progressive saving of answers (users can save and come back later)
- Validation at completion time (ensures all required questions are answered)
- Clear state transitions (IN_PROGRESS → COMPLETED)

### 3. Added Submitting State

Added a `submitting` state to track API call progress:

```typescript
const [submitting, setSubmitting] = useState(false);

// In submit button:
<button
  disabled={!allRequiredAnswered || isLoading || submitting}
>
  {submitting ? "Submitting..." : isLoading ? "Processing..." : "Submit Questionnaire"}
</button>
```

### 4. Updated WorkflowStepCard

Updated the onComplete callback to pass the payload correctly:

**Before**:
```typescript
<PopulateQuestionnaireExecution
  step={step}
  onComplete={(answers) => {
    void onRunStepAction(step.id, "complete", { payload: { answers } });
  }}
  isLoading={isLoading}
/>
```

**After**:
```typescript
<PopulateQuestionnaireExecution
  step={step}
  matterId={matterId}
  onComplete={(payload) => {
    void onRunStepAction(step.id, "complete", { payload });
  }}
  isLoading={isLoading}
/>
```

### 5. Passed matterId Through Component Tree

Since `matterId` was not available in WorkflowStepCard, we needed to thread it through:

**Updated components**:
1. **WorkflowStepCard** - Added `matterId` prop
2. **WorkflowInstanceCard** - Added `matterId` prop and passed to WorkflowStepCard
3. **MatterWorkflowsSection** - Added `matterId` prop and passed to WorkflowInstanceCard
4. **MatterDetailClient** - Passed `matter.id` to MatterWorkflowsSection

## Files Modified

1. `/components/workflows/execution/PopulateQuestionnaireExecution.tsx`
   - Added `matterId` prop
   - Changed `onComplete` signature to accept `{ responseId: string }`
   - Made `handleSubmit` async
   - Added API call to create questionnaire response
   - Added submitting state and error handling

2. `/components/matters/workflows/WorkflowStepCard.tsx`
   - Added `matterId` prop
   - Updated PopulateQuestionnaireExecution usage

3. `/components/matters/workflows/WorkflowInstanceCard.tsx`
   - Added `matterId` prop
   - Passed `matterId` to WorkflowStepCard

4. `/components/matters/workflows/MatterWorkflowsSection.tsx`
   - Added `matterId` prop
   - Passed `matterId` to WorkflowInstanceCard

5. `/components/matters/MatterDetailClient.tsx`
   - Passed `matter.id` as `matterId` to MatterWorkflowsSection

## Testing

To verify the fix:

1. ✅ Create a workflow with a questionnaire step
2. ✅ Start the workflow step
3. ✅ Fill out the questionnaire form
4. ✅ Click "Submit Questionnaire"
5. ✅ Verify questionnaire response is created in database
6. ✅ Verify workflow step completes successfully
7. ✅ Verify response data is stored in workflow step's actionData

## Database Flow

**Response Creation and Completion (3-Step Process)**:
```sql
-- Step 1: Create response with IN_PROGRESS status
INSERT INTO "QuestionnaireResponse" (id, questionnaireId, matterId, respondentId, status)
VALUES ('response-id', 'questionnaire-id', 'matter-id', 'client-id', 'IN_PROGRESS');

-- Step 2: Save all answers
INSERT INTO "QuestionnaireResponseAnswer" (id, responseId, questionId, answerText, answerJson)
VALUES 
  ('answer-1', 'response-id', 'question-1', 'Answer text', NULL),
  ('answer-2', 'response-id', 'question-2', NULL, '["option1", "option2"]'),
  ...;

-- Step 3: Mark as completed (validates required questions first)
UPDATE "QuestionnaireResponse"
SET status = 'COMPLETED',
    completedAt = NOW()
WHERE id = 'response-id';

-- Step 4: Workflow step is updated with responseId
UPDATE "WorkflowInstanceStep"
SET actionState = 'COMPLETED',
    actionData = jsonb_set(actionData, '{data,responseId}', '"response-id"')
WHERE id = 'step-id';
```

## Prevention

**Key Learnings**:
1. Always create database records before passing IDs to handlers
2. Handler validation schemas define the contract - execution components must comply
3. Complex workflows often require multi-step API calls
4. Thread required context (like matterId) through component props
5. Use async/await for sequential API calls
6. Show appropriate loading states during multi-step operations

## Related Files

- Handler: `/lib/workflows/handlers/populate-questionnaire.ts`
- Execution Component: `/components/workflows/execution/PopulateQuestionnaireExecution.tsx`
- API Endpoint: `/app/api/questionnaire-responses/route.ts`

## Impact

**Before Fix**: ❌ Questionnaire workflow steps could start but not complete  
**After Fix**: ✅ Full end-to-end questionnaire workflow execution working

**Affected Users**: Clients completing questionnaires within workflow steps  
**Risk Level**: Low - Fix is backward compatible; no existing responses affected
