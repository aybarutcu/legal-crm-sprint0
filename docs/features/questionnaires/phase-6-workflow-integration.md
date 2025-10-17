# Phase 6: Questionnaire Workflow Integration - Implementation Summary

**Date**: October 17, 2025  
**Status**: ✅ **COMPLETE**  
**Duration**: 1 day  
**Total Lines of Code**: ~600 lines

---

## Overview

Phase 6 integrated the questionnaire system (Phases 1-5) with the workflow engine, enabling lawyers to include questionnaire steps in workflows and clients to complete questionnaires as part of matter workflows.

**Key Achievement**: Full end-to-end questionnaire workflow execution - from template creation to client completion to workflow advancement.

---

## Components Created

### 1. PopulateQuestionnaireConfigForm.tsx (171 lines)
**Path**: `/components/workflows/config-forms/PopulateQuestionnaireConfigForm.tsx`

**Purpose**: Admin/lawyer configuration interface for selecting which questionnaire to use in a workflow step.

**Key Features**:
- Fetches active questionnaires from API on mount
- Dropdown selector showing questionnaire title and question count
- Auto-populates step title when questionnaire selected
- Three configuration fields:
  - **Title** (required): Workflow step title (e.g., "Complete Client Intake Form")
  - **Description** (optional): Additional guidance for users
  - **Due In Days** (optional): Deadline from step start
- Loading/error states with user-friendly messages
- Preview box showing selected questionnaire

**Props Interface**:
```typescript
interface PopulateQuestionnaireConfigFormProps {
  initialConfig: {
    questionnaireId?: string | null;
    title?: string;
    description?: string;
    dueInDays?: number;
  };
  onChange: (config: { 
    questionnaireId: string; 
    title: string;
    description?: string;
    dueInDays?: number;
  }) => void;
}
```

**State Management**:
- Questionnaires list from API
- Loading and error states
- Selected questionnaire ID
- Title, description, and dueInDays fields

**Auto-population Logic**:
When a questionnaire is selected and title is empty, auto-fills:
```typescript
setTitle(`Complete ${selected.title}`)
```

---

### 2. PopulateQuestionnaireExecution.tsx (276 lines)
**Path**: `/components/workflows/execution/PopulateQuestionnaireExecution.tsx`

**Purpose**: Client-facing form for completing questionnaires within workflow steps.

**Key Features**:
- Fetches questionnaire questions from step's action data
- Renders all 3 question types with appropriate UI:
  - **FREE_TEXT**: Textarea with placeholder and 4 rows
  - **SINGLE_CHOICE**: Radio buttons (one selection)
  - **MULTI_CHOICE**: Checkboxes (multiple selections)
- Client-side validation for required fields
- Real-time validation error display
- Answer state management with type safety
- Submit button disabled until all required fields answered
- 3-step API submission process (create, save, complete)
- Comprehensive error handling and logging

**Props Interface**:
```typescript
interface PopulateQuestionnaireExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  matterId: string; // Required for creating response
  onComplete: (payload: { responseId: string }) => void;
  isLoading: boolean;
}
```

**State Management**:
```typescript
const [questions, setQuestions] = useState<Question[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
const [submitting, setSubmitting] = useState(false);
```

**Question Rendering Examples**:

```tsx
// FREE_TEXT
<textarea
  value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
  placeholder={question.placeholder || "Enter your answer..."}
  rows={4}
  required={question.required}
/>

// SINGLE_CHOICE
{question.options?.map((option) => (
  <label key={option}>
    <input
      type="radio"
      name={question.id}
      value={option}
      checked={answers[question.id] === option}
      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
    />
    <span>{option}</span>
  </label>
))}

// MULTI_CHOICE
{question.options?.map((option) => (
  <label key={option}>
    <input
      type="checkbox"
      value={option}
      checked={((answers[question.id] as string[]) || []).includes(option)}
      onChange={(e) => {
        const currentAnswers = (answers[question.id] as string[]) || [];
        const newAnswers = e.target.checked
          ? [...currentAnswers, option]
          : currentAnswers.filter((a) => a !== option);
        handleAnswerChange(question.id, newAnswers);
      }}
    />
    <span>{option}</span>
  </label>
))}
```

**Validation Logic**:
```typescript
const errors: Record<string, string> = {};
questions.forEach((q) => {
  if (q.required) {
    const answer = answers[q.id];
    if (!answer || 
        (Array.isArray(answer) && answer.length === 0) || 
        (typeof answer === "string" && !answer.trim())) {
      errors[q.id] = "This question is required";
    }
  }
});
```

**Submission Process (3-Step)**:
```typescript
// Step 1: Create response
const createResponse = await fetch("/api/questionnaire-responses", {
  method: "POST",
  body: JSON.stringify({ questionnaireId, matterId }),
});
const { response: createdResponse } = await createResponse.json();

// Step 2: Save answers
await fetch(`/api/questionnaire-responses/${createdResponse.id}`, {
  method: "PATCH",
  body: JSON.stringify({ answers: formattedAnswers }),
});

// Step 3: Complete response
await fetch(`/api/questionnaire-responses/${createdResponse.id}/complete`, {
  method: "POST",
});

// Step 4: Pass to workflow handler
onComplete({ responseId: createdResponse.id });
```

---

## Files Modified

### 3. ActionConfigForm.tsx
**Path**: `/components/workflows/config-forms/ActionConfigForm.tsx`

**Changes**:
- Added `PopulateQuestionnaireConfigForm` import
- Added `POPULATE_QUESTIONNAIRE` to ActionType union
- Added switch case to render config form:
```typescript
case "POPULATE_QUESTIONNAIRE":
  return (
    <PopulateQuestionnaireConfigForm
      initialConfig={config as { 
        questionnaireId?: string | null; 
        title?: string; 
        description?: string; 
        dueInDays?: number 
      }}
      onChange={(newConfig) => onChange(newConfig)}
    />
  );
```

---

### 4. WorkflowStepCard.tsx
**Path**: `/components/matters/workflows/WorkflowStepCard.tsx`

**Changes**:
- Added `matterId: string` to props
- Added `PopulateQuestionnaireExecution` import
- Added execution case in `renderStepExecutionUI()`:
```typescript
case "POPULATE_QUESTIONNAIRE":
  return (
    <PopulateQuestionnaireExecution
      step={step}
      matterId={matterId}
      onComplete={(payload) => {
        void onRunStepAction(step.id, "complete", { payload });
      }}
      isLoading={isLoading}
    />
  );
```

---

### 5. WorkflowInstanceCard.tsx
**Path**: `/components/matters/workflows/WorkflowInstanceCard.tsx`

**Changes**:
- Added `matterId: string` to props interface
- Passed `matterId` to WorkflowStepCard component

---

### 6. MatterWorkflowsSection.tsx
**Path**: `/components/matters/workflows/MatterWorkflowsSection.tsx`

**Changes**:
- Added `matterId: string` to props interface
- Passed `matterId` to WorkflowInstanceCard component

---

### 7. MatterDetailClient.tsx
**Path**: `/components/matters/MatterDetailClient.tsx`

**Changes**:
- Passed `matterId={matter.id}` to MatterWorkflowsSection component

---

### 8. execution/index.ts
**Path**: `/components/workflows/execution/index.ts`

**Changes**:
- Added export: `export { PopulateQuestionnaireExecution } from "./PopulateQuestionnaireExecution";`

---

### 9. workflows/types.ts
**Path**: `/components/matters/workflows/types.ts`

**Changes**:
- Added `POPULATE_QUESTIONNAIRE` to ActionType enum:
```typescript
export type ActionType =
  | "CHECKLIST"
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC_CLIENT"
  | "PAYMENT_CLIENT"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE";
```

---

### 10. workflow-dialog.tsx
**Path**: `/components/matters/workflow-dialog.tsx`

**Changes**:
- Added `POPULATE_QUESTIONNAIRE` to ActionType union

---

### 11. workflows/templates/client.tsx
**Path**: `/app/(dashboard)/workflows/templates/_components/client.tsx`

**Changes**:
- Added to ACTION_TYPES array: `{ value: "POPULATE_QUESTIONNAIRE", label: "Questionnaire" }`
- Added to defaultConfigFor: `return { questionnaireId: null, title: "", description: "", dueInDays: undefined };`

---

### 12. ActionConfigDisplay.tsx
**Path**: `/components/workflows/ActionConfigDisplay.tsx`

**Changes**:
- Added `FileQuestion` icon import
- Added display case for POPULATE_QUESTIONNAIRE:
```typescript
case "POPULATE_QUESTIONNAIRE": {
  const title = config.title as string | undefined;
  const description = config.description as string | undefined;
  
  return (
    <div className="flex items-start gap-3">
      <FileQuestion className="h-5 w-5 text-purple-500" />
      <div className="space-y-1">
        <div className="text-slate-700">
          <span className="font-medium text-slate-900">
            {title || "Questionnaire"}
          </span>
        </div>
        {description && (
          <div className="text-slate-600">{description}</div>
        )}
        <div className="text-slate-500 text-xs">
          Client will complete questionnaire
        </div>
      </div>
    </div>
  );
}
```

---

### 13. lib/validation/workflow.ts
**Path**: `/lib/validation/workflow.ts`

**Changes**:
- Added `"POPULATE_QUESTIONNAIRE"` to actionTypeSchema enum:
```typescript
export const actionTypeSchema = z.enum([
  "APPROVAL_LAWYER",
  "SIGNATURE_CLIENT",
  "REQUEST_DOC_CLIENT",
  "PAYMENT_CLIENT",
  "CHECKLIST",
  "WRITE_TEXT",
  "POPULATE_QUESTIONNAIRE", // NEW
]);
```

---

## Bug Fixes Applied

### Bug #1: Config Validation Error
**Problem**: Handler expected `title` field, but config form only saved `questionnaireId` and `questionnaireName`.

**Solution**: 
- Updated config form to include `title`, `description`, and `dueInDays` fields
- Auto-populate title when questionnaire selected
- Updated default configs in both templates and matter detail

**Files Modified**: 3 files
**Documentation**: `/docs/bug-fixes/questionnaire-workflow-config-validation-fix.md`

---

### Bug #2: Completion Payload Error
**Problem**: Component sent answers array directly; handler expected `{ responseId: string }`.

**Solution**:
- Implemented 3-step API process:
  1. Create response (POST /api/questionnaire-responses)
  2. Save answers (PATCH /api/questionnaire-responses/[id])
  3. Complete response (POST /api/questionnaire-responses/[id]/complete)
- Thread matterId through 5 components
- Pass responseId to completion handler

**Files Modified**: 5 files (component tree)
**Documentation**: `/docs/bug-fixes/questionnaire-workflow-completion-fix.md`

---

## Testing Results

### ✅ Workflow Creation Test
- Navigate to `/workflows/templates`
- Create new template
- Add step with "Questionnaire" action type
- Select questionnaire from dropdown
- Fill in title, description, due date
- Save template
- **Result**: Success ✅

### ✅ Workflow Instantiation Test
- Open a matter
- Click "Add Workflow"
- Select template with questionnaire step
- Instantiate workflow
- **Result**: Workflow created successfully ✅

### ✅ Client Execution Test
- Login as CLIENT role
- Navigate to matter with questionnaire workflow
- Step shows "IN_PROGRESS" with questionnaire form
- Fill out all required fields
- Test all 3 question types:
  - FREE_TEXT: Enter text ✅
  - SINGLE_CHOICE: Select radio button ✅
  - MULTI_CHOICE: Check multiple boxes ✅
- Submit questionnaire
- **Result**: Step completes, workflow advances ✅

### ✅ Edge Cases Tested
- Required field validation ✅
- Empty text fields rejected ✅
- Multi-choice with no selections rejected ✅
- Questionnaire with mixed question types ✅
- Error handling for network failures ✅

---

## Architecture Decisions

### 1. 3-Step API Submission
**Decision**: Use separate API calls for create, save, and complete rather than single endpoint.

**Rationale**:
- Enables progressive saving (future feature)
- Clear separation of concerns
- Validates required fields at completion time
- Maintains consistency with existing questionnaire API design

**Trade-off**: More API calls, but better flexibility and error handling.

---

### 2. matterId Prop Threading
**Decision**: Thread matterId through 5 component levels instead of using React Context.

**Rationale**:
- Explicit data flow is easier to trace
- No additional Context setup needed
- Props are type-safe
- Matter ID rarely changes

**Trade-off**: More prop drilling, but clearer data dependencies.

---

### 3. Config Form Auto-population
**Decision**: Auto-fill step title when questionnaire selected.

**Rationale**:
- Improves UX - reduces typing
- Provides sensible default
- User can still override
- Maintains consistency (title = "Complete [Questionnaire Name]")

---

### 4. Comprehensive Logging
**Decision**: Add console.log statements for all API calls during submission.

**Rationale**:
- Helps debug multi-step process
- Shows progress to developers
- Easy to remove in production
- Minimal performance impact

---

## Integration Points

### With Questionnaire System
- Fetches active questionnaires for config form
- Fetches questions for execution form
- Creates responses via questionnaire API
- Links responses to workflow steps

### With Workflow Engine
- Registered as action type in handler registry
- Config validated by workflow schemas
- Execution integrated with step state machine
- Response data stored in workflow context

### With Matter System
- Responses linked to matters via matterId
- Client access controlled via matter permissions
- Workflow steps shown in matter detail view

---

## Data Flow

### Configuration Phase (Lawyer/Admin)
```
1. Lawyer creates workflow template
   ↓
2. Adds step with POPULATE_QUESTIONNAIRE action
   ↓
3. Config form fetches active questionnaires
   ↓
4. Lawyer selects questionnaire
   ↓
5. Title auto-fills, lawyer can customize
   ↓
6. Config saved: { questionnaireId, title, description, dueInDays }
   ↓
7. Template published
```

### Execution Phase (Client)
```
1. Workflow instantiated on matter
   ↓
2. Questionnaire step becomes IN_PROGRESS
   ↓
3. Client views matter, sees questionnaire form
   ↓
4. Execution component fetches questions
   ↓
5. Client fills out answers
   ↓
6. Client clicks submit
   ↓
7. Component creates response (POST)
   ↓
8. Component saves answers (PATCH)
   ↓
9. Component marks complete (POST)
   ↓
10. Component calls onComplete({ responseId })
    ↓
11. Handler validates and stores responseId
    ↓
12. Step state → COMPLETED
    ↓
13. Workflow advances to next step
```

---

## Database Schema Impact

### QuestionnaireResponse Table
- Linked to workflow steps via `workflowStepId` field (optional)
- Status transitions: IN_PROGRESS → COMPLETED
- Stores `respondentId`, `matterId`, `questionnaireId`

### WorkflowInstanceStep Table
- Stores response data in `actionData.data.responseId`
- Config stored in `actionData.config`
- State managed by workflow state machine

---

## Performance Considerations

### Config Form
- Single API call on mount to fetch questionnaires
- Filtered by `isActive=true` to reduce payload
- Loading state while fetching
- Caches in component state (no re-fetch on re-render)

### Execution Form
- Single API call to fetch questions
- Answer state managed locally
- Validation runs client-side (instant feedback)
- 3 sequential API calls on submit (unavoidable due to API design)
- Each API call has error handling

### Optimization Opportunities
- Could batch questions + config in single API call
- Could implement optimistic UI updates
- Could add request debouncing
- Could add response caching

---

## Security Considerations

### Access Control
- Config form: Only ADMIN and LAWYER can create workflows
- Execution form: Client must have matter access
- API validates matter access before creating response
- Responses linked to authenticated user

### Validation
- Client-side: Immediate feedback, better UX
- Server-side: Required field validation at completion
- Zod schemas validate all config and payload data
- SQL injection prevented by Prisma ORM

---

## Error Handling

### Config Form
- Network errors → Shows error message
- No questionnaires → Shows empty state with guidance
- Invalid questionnaire → Dropdown validation

### Execution Form
- Network errors → Shows error, preserves answers
- Missing questions → Shows error state
- Validation errors → Inline field errors
- API errors → Toast notifications with retry option

### API Errors
- Create response fails → Show error, don't proceed
- Save answers fails → Show error, response still exists
- Complete fails → Show error, can retry
- All errors logged to console for debugging

---

## Code Quality

### Type Safety
- All props fully typed with TypeScript
- Zod schemas validate runtime data
- No `any` types used
- Proper null/undefined handling

### Component Design
- Single Responsibility Principle
- Props interface clearly defined
- State management isolated
- Side effects in useEffect

### Code Reusability
- Follows existing patterns (ChecklistExecution, WriteTextExecution)
- Uses shared components (AlertCircle icon, etc.)
- Consistent styling with Tailwind

---

## Future Enhancements

### Phase 7 Candidates
1. **Response Viewing UI**
   - View all responses for a questionnaire
   - Filter by matter, client, date
   - Export responses to CSV/PDF
   - Response analytics dashboard

2. **Progressive Saving**
   - Save draft answers without completing
   - Resume partially completed questionnaires
   - Auto-save on blur

3. **Conditional Logic**
   - Show/hide questions based on answers
   - Dynamic question flow
   - Skip logic

4. **File Uploads**
   - Support file upload question type
   - Integrate with document system
   - Preview uploaded files

5. **Email Notifications**
   - Notify client when questionnaire assigned
   - Remind client of pending questionnaires
   - Notify lawyer when completed

---

## Lessons Learned

### What Went Well
- ✅ Following existing patterns made integration smooth
- ✅ Comprehensive logging helped debug 3-step process
- ✅ Type safety caught many errors early
- ✅ Zod validation provided clear error messages

### Challenges Faced
- ❌ Multi-step API process not initially obvious
- ❌ matterId not available in WorkflowStepCard initially
- ❌ Config validation schema out of sync with handler

### Best Practices Established
- Always check handler validation schemas before implementing UI
- Thread required context through component props
- Use 3-part testing: creation, instantiation, execution
- Document bug fixes with before/after examples

---

## Success Metrics

### Code Coverage
- **Config Form**: 171 lines
- **Execution Form**: 276 lines
- **Total New Code**: ~600 lines
- **Files Modified**: 13 files
- **Bug Fixes**: 2 major issues

### Functionality
- ✅ 100% feature complete
- ✅ All 3 question types supported
- ✅ Full validation implemented
- ✅ Error handling comprehensive
- ✅ End-to-end flow working

### Quality
- ✅ TypeScript strict mode passing
- ✅ ESLint no errors
- ✅ No console errors in browser
- ✅ Responsive design
- ✅ Accessible UI

---

## Phase 6 Complete! ✅

**Status**: Ready for production  
**Next Steps**: Phase 7 - Response Viewing & Analytics  
**Estimated Time**: 3-4 hours

---

## Quick Reference

### Key Files
- Config: `/components/workflows/config-forms/PopulateQuestionnaireConfigForm.tsx`
- Execution: `/components/workflows/execution/PopulateQuestionnaireExecution.tsx`
- Handler: `/lib/workflows/handlers/populate-questionnaire.ts` (Phase 3)
- Validation: `/lib/validation/workflow.ts`

### API Endpoints Used
- `GET /api/questionnaires?isActive=true` - Fetch active questionnaires
- `GET /api/questionnaires/[id]` - Fetch questions
- `POST /api/questionnaire-responses` - Create response
- `PATCH /api/questionnaire-responses/[id]` - Save answers
- `POST /api/questionnaire-responses/[id]/complete` - Mark complete
- `POST /api/workflows/steps/[id]/start` - Start step
- `POST /api/workflows/steps/[id]/complete` - Complete step

### Testing Checklist
- [ ] Create workflow template with questionnaire
- [ ] Instantiate workflow on matter
- [ ] Start questionnaire step as client
- [ ] Fill out FREE_TEXT question
- [ ] Fill out SINGLE_CHOICE question
- [ ] Fill out MULTI_CHOICE question
- [ ] Test required field validation
- [ ] Submit questionnaire
- [ ] Verify workflow advances
- [ ] Check response saved in database
