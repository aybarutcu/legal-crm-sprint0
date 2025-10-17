# Phase 3 Summary: Workflow Action Handler

## ✅ Phase 3 Complete

Successfully implemented the `PopulateQuestionnaireActionHandler` workflow action handler for integrating questionnaires into workflow templates.

---

## What Was Built

### 1. Handler Implementation
**File**: `/lib/workflows/handlers/populate-questionnaire.ts`  
**Lines**: 250 lines

**Features**:
- ✅ Implements `IActionHandler` interface
- ✅ Config validation with Zod schema
- ✅ Database validation on workflow step start
- ✅ Response validation on workflow step completion
- ✅ Workflow context updates with formatted answers
- ✅ Authorization checks (respondent or ADMIN only)
- ✅ Comprehensive error handling with specific error codes

**Key Methods**:
- `validateConfig()` - Validates questionnaireId, title, description, dueInDays
- `canStart()` - Checks if actor can start the step
- `start()` - Validates questionnaire exists and is active
- `complete()` - Validates response is completed and stores data
- `fail()` - Marks step as failed
- `skip()` - Marks step as skipped
- `getNextStateOnEvent()` - Returns null (no event-based transitions)

### 2. Handler Registration
**File**: `/lib/workflows/handlers/index.ts`  
**Changes**: 
- Added import for `PopulateQuestionnaireActionHandler`
- Registered handler in `registerDefaultWorkflowHandlers()`
- Exported handler class

### 3. Comprehensive Testing
**File**: `/scripts/test-populate-questionnaire-handler.ts`  
**Lines**: 366 lines  
**Tests**: 9 comprehensive tests

**Test Coverage**:
1. ✅ Handler registration in action registry
2. ✅ Test data creation (user, questionnaire, response, answers)
3. ✅ Config validation (valid and invalid cases)
4. ✅ canStart method (with and without actor)
5. ✅ start method (valid and invalid questionnaire)
6. ✅ complete method (valid, invalid, and incomplete responses)
7. ✅ fail method
8. ✅ skip method
9. ✅ getNextStateOnEvent method

**Test Results**: 100% pass rate - all 9 tests passed

---

## Configuration Schema

```typescript
{
  questionnaireId: string;    // Required - Questionnaire to complete
  title: string;              // Required - Step title
  description?: string;       // Optional - Additional guidance
  dueInDays?: number;        // Optional - Days until due
}
```

---

## Data Stored in Workflow Step

```typescript
{
  responseId?: string;           // Completed response ID
  questionnaireId?: string;      // Questionnaire template ID
  questionnaireTitle?: string;   // Questionnaire title
  startedAt?: string;           // ISO timestamp
  completedAt?: string;         // ISO timestamp
  completedBy?: string;         // User ID
  answerCount?: number;         // Number of answers
}
```

---

## Workflow Context Updates

When completed, the handler adds comprehensive data to workflow context:

```typescript
{
  "questionnaire_<stepId>": {
    title: "Complete Client Intake",
    questionnaireId: "...",
    questionnaireTitle: "Client Intake Form",
    responseId: "...",
    startedAt: "2025-10-16T...",
    completedAt: "2025-10-16T...",
    completedBy: "...",
    answerCount: 5,
    answers: [
      {
        questionId: "...",
        questionText: "What is your name?",
        questionType: "FREE_TEXT",
        answerText: "John Doe",
        answerJson: null
      },
      // ... more answers
    ]
  },
  "questionnaire_<stepId>_responseId": "...",
  "questionnaire_<stepId>_answers": [ /* array */ ]
}
```

This data can be accessed in subsequent workflow steps (e.g., email templates, document generation).

---

## Error Handling

| Error Code | When Thrown | Description |
|------------|-------------|-------------|
| `INVALID_CONFIG` | validateConfig() | Configuration validation failed |
| `QUESTIONNAIRE_NOT_FOUND` | start() | Questionnaire doesn't exist or inactive |
| `INVALID_PAYLOAD` | complete() | Completion payload validation failed |
| `RESPONSE_NOT_FOUND` | complete() | Response doesn't exist |
| `QUESTIONNAIRE_MISMATCH` | complete() | Response for different questionnaire |
| `RESPONSE_NOT_COMPLETED` | complete() | Response status not COMPLETED |
| `UNAUTHORIZED` | complete() | Actor is not respondent |

---

## Authorization

- **Start**: Any user assigned to the step (based on roleScope)
- **Complete**: Only the respondent who created the response (or ADMIN)
- **ADMIN Override**: Admins can complete any response

---

## Integration Example

```typescript
// 1. Create questionnaire (Phase 2 APIs)
const questionnaire = await fetch('/api/questionnaires', {
  method: 'POST',
  body: JSON.stringify({
    title: "Client Intake Form",
    questions: [
      { questionText: "Your name?", questionType: "FREE_TEXT", order: 0, required: true },
      { questionText: "Contact method?", questionType: "SINGLE_CHOICE", order: 1, required: true, options: ["Email", "Phone"] }
    ]
  })
});

// 2. Add to workflow template
const template = await prisma.workflowTemplate.create({
  data: {
    name: "Client Onboarding",
    steps: {
      create: [{
        order: 0,
        actionType: "POPULATE_QUESTIONNAIRE",
        actionConfig: {
          questionnaireId: questionnaire.id,
          title: "Complete Intake Form",
          dueInDays: 3
        },
        roleScope: ["CLIENT"],
        required: true
      }]
    }
  }
});

// 3. Client completes questionnaire (Phase 2 APIs)
// POST /api/questionnaire-responses { questionnaireId, workflowStepId }
// PATCH /api/questionnaire-responses/:id { answers: [...] }
// POST /api/questionnaire-responses/:id/complete

// 4. Client submits workflow step (Phase 3 handler)
// Handler validates response and stores data in workflow context
```

---

## Time Investment

- **Planning**: 5 minutes (reviewed existing handlers)
- **Implementation**: 25 minutes (handler + registration)
- **Testing**: 10 minutes (test script + execution)
- **Documentation**: 5 minutes
- **Total**: ~45 minutes

---

## Next Phase

### Phase 4: Management UI (4-5 hours)

**What to Build**:
1. Questionnaire list page with search/filter
2. Create/edit dialog for questionnaires
3. Question editor components
4. Delete confirmation
5. View response counts

**Files to Create**:
- `/app/(dashboard)/questionnaires/page.tsx`
- `/components/questionnaires/QuestionnaireListClient.tsx`
- `/components/questionnaires/QuestionnaireCreateDialog.tsx`
- `/components/questionnaires/QuestionnaireCard.tsx`

**Dependencies**: Phase 2 APIs (already complete ✅)

---

## Status

✅ **Phase 3 Complete**  
📊 **Progress**: 3/8 phases (37.5%)  
⏱️ **Remaining**: 15-22 hours estimated
