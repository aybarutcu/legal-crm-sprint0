# Phase 3 Complete: Workflow Action Handler

**Date**: October 16, 2025  
**Status**: ✅ Complete  
**Time Taken**: ~45 minutes

---

## Summary

Successfully implemented Phase 3 of the Questionnaire feature implementation plan. The `PopulateQuestionnaireActionHandler` workflow action handler is now complete, tested, and registered in the action registry. This handler enables questionnaires to be integrated into workflow templates as actionable steps.

---

## Implementation Details

### Handler File: `/lib/workflows/handlers/populate-questionnaire.ts`

**Class**: `PopulateQuestionnaireActionHandler`  
**Action Type**: `ActionType.POPULATE_QUESTIONNAIRE`  
**Lines**: 250 lines of TypeScript

### Handler Implementation

#### Configuration Schema
```typescript
{
  questionnaireId: string;    // Required - ID of questionnaire to complete
  title: string;              // Required - Step title (e.g., "Complete Client Intake")
  description?: string;       // Optional - Additional guidance
  dueInDays?: number;        // Optional - Days until due
}
```

#### Data Schema (Stored in Workflow Step)
```typescript
{
  responseId?: string;           // The completed response ID
  questionnaireId?: string;      // The questionnaire template ID
  questionnaireTitle?: string;   // The questionnaire title
  startedAt?: string;           // ISO timestamp when started
  completedAt?: string;         // ISO timestamp when completed
  completedBy?: string;         // User ID who completed it
  answerCount?: number;         // Number of answers provided
}
```

#### Complete Payload
```typescript
{
  responseId: string;  // Required - The ID of the completed response
}
```

---

## Handler Methods

### 1. `validateConfig(config)`
**Purpose**: Validate handler configuration using Zod schema

**Validations**:
- ✅ `questionnaireId` is required and non-empty
- ✅ `title` is required and non-empty
- ✅ `description` is optional string
- ✅ `dueInDays` is optional non-negative integer

**Throws**: `ActionHandlerError` with `INVALID_CONFIG` code if validation fails

---

### 2. `canStart(ctx)`
**Purpose**: Determine if actor can start this action

**Logic**:
- Returns `false` if no actor
- Returns `true` for ADMIN role
- Returns `true` for other roles (roleScope checked elsewhere)

**Returns**: `boolean`

---

### 3. `start(ctx)`
**Purpose**: Initialize the workflow step and prepare for questionnaire completion

**Process**:
1. Validates questionnaire exists in database
2. Checks questionnaire is active (`isActive: true`)
3. Checks questionnaire is not deleted (`deletedAt: null`)
4. Stores questionnaire ID and title in step data
5. Returns `ActionState.IN_PROGRESS`

**Database Query**:
```typescript
await ctx.tx.questionnaire.findFirst({
  where: {
    id: ctx.config.questionnaireId,
    isActive: true,
    deletedAt: null,
  },
  select: { id: true, title: true },
});
```

**Throws**: `ActionHandlerError` with `QUESTIONNAIRE_NOT_FOUND` if validation fails

**Returns**: `ActionState.IN_PROGRESS`

---

### 4. `complete(ctx, payload)`
**Purpose**: Complete the workflow step with a questionnaire response

**Process**:
1. Validates payload structure (must have `responseId`)
2. Fetches response with full details (questionnaire, answers, questions)
3. Validates response exists
4. Validates response is for correct questionnaire
5. Validates response status is `COMPLETED`
6. Validates actor is respondent (or ADMIN)
7. Stores completion data in step
8. Updates workflow context with formatted answer data
9. Returns `ActionState.COMPLETED`

**Database Query**:
```typescript
await ctx.tx.questionnaireResponse.findUnique({
  where: { id: responseId },
  include: {
    questionnaire: {
      select: { id: true, title: true },
    },
    answers: {
      include: {
        question: {
          select: { id: true, questionText: true, questionType: true },
        },
      },
      orderBy: { question: { order: 'asc' } },
    },
  },
});
```

**Validations**:
- ✅ Response exists
- ✅ Response is for correct questionnaire
- ✅ Response status is COMPLETED
- ✅ Actor is respondent or ADMIN

**Throws**: 
- `ActionHandlerError` with `RESPONSE_NOT_FOUND` if response doesn't exist
- `ActionHandlerError` with `QUESTIONNAIRE_MISMATCH` if wrong questionnaire
- `ActionHandlerError` with `RESPONSE_NOT_COMPLETED` if not completed
- `ActionHandlerError` with `UNAUTHORIZED` if wrong actor

**Returns**: `ActionState.COMPLETED`

---

### 5. `fail(ctx, reason)`
**Purpose**: Mark the step as failed

**Process**:
1. Records completion timestamp
2. Records who failed it
3. Returns `ActionState.FAILED`

**Returns**: `ActionState.FAILED`

---

### 6. `skip(ctx)`
**Purpose**: Mark the step as skipped

**Process**:
1. Records completion timestamp
2. Returns `ActionState.SKIPPED`

**Returns**: `ActionState.SKIPPED`

---

### 7. `getNextStateOnEvent()`
**Purpose**: Handle event-based state transitions

**Returns**: `null` (this handler doesn't use event-based transitions)

---

## Workflow Context Updates

When a questionnaire is completed, the handler updates the workflow context with comprehensive data:

```typescript
{
  // Main questionnaire data object
  "questionnaire_<stepId>": {
    title: "Complete Client Intake",
    questionnaireId: "cmgt...",
    questionnaireTitle: "Client Intake Form",
    responseId: "cmgt...",
    startedAt: "2025-10-16T...",
    completedAt: "2025-10-16T...",
    completedBy: "cmgt...",
    answerCount: 5,
    answers: [
      {
        questionId: "cmgt...",
        questionText: "What is your name?",
        questionType: "FREE_TEXT",
        answerText: "John Doe",
        answerJson: null
      },
      {
        questionId: "cmgt...",
        questionText: "Preferred contact method?",
        questionType: "SINGLE_CHOICE",
        answerText: null,
        answerJson: "Email"
      },
      {
        questionId: "cmgt...",
        questionText: "Services interested in?",
        questionType: "MULTI_CHOICE",
        answerText: null,
        answerJson: ["Service A", "Service B"]
      }
    ]
  },
  
  // Convenience shortcuts
  "questionnaire_<stepId>_responseId": "cmgt...",
  "questionnaire_<stepId>_answers": [ /* array of answers */ ]
}
```

### Context Usage Examples

**Access response ID**:
```typescript
const responseId = context[`questionnaire_${stepId}_responseId`];
```

**Access all answers**:
```typescript
const answers = context[`questionnaire_${stepId}_answers`];
```

**Access specific answer by question text**:
```typescript
const answers = context[`questionnaire_${stepId}_answers`];
const nameAnswer = answers.find(a => a.questionText === "What is your name?");
console.log(nameAnswer.answerText); // "John Doe"
```

**Use in email template**:
```handlebars
Client Name: {{questionnaire_step123_answers.0.answerText}}
Contact Method: {{questionnaire_step123_answers.1.answerJson}}
```

---

## Handler Registration

### Updated: `/lib/workflows/handlers/index.ts`

**Added import**:
```typescript
import { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
```

**Added registration**:
```typescript
export function registerDefaultWorkflowHandlers(): void {
  // ... existing handlers ...
  actionRegistry.override(new PopulateQuestionnaireActionHandler());
}
```

**Added export**:
```typescript
export { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
```

The handler is now automatically registered when the application starts.

---

## Testing

### Test File: `/scripts/test-populate-questionnaire-handler.ts`

**Lines**: 366 lines of TypeScript  
**Test Count**: 9 comprehensive tests

### Test Coverage

#### Test 1: Handler Registration ✅
- Handler instantiation
- Action type verification
- Registry registration

#### Test 2: Test Data Creation ✅
- Create test user
- Create test questionnaire with 2 questions (FREE_TEXT, SINGLE_CHOICE)
- Create completed response with 2 answers

#### Test 3: Config Validation ✅
- Valid config acceptance
- Invalid config rejection (missing questionnaireId)
- Invalid config rejection (missing title)

#### Test 4: canStart Method ✅
- Returns `true` with valid actor
- Returns `false` with no actor

#### Test 5: start Method ✅
- Successfully starts with valid questionnaire
- Stores questionnaire ID and title in data
- Returns `ActionState.IN_PROGRESS`
- Rejects invalid questionnaire ID

#### Test 6: complete Method ✅
- Successfully completes with valid response
- Stores all completion data
- Updates workflow context correctly
- Rejects invalid response ID
- Rejects incomplete response (IN_PROGRESS status)

#### Test 7: fail Method ✅
- Returns `ActionState.FAILED`
- Records completion timestamp and actor

#### Test 8: skip Method ✅
- Returns `ActionState.SKIPPED`
- Records completion timestamp

#### Test 9: getNextStateOnEvent Method ✅
- Returns `null` as expected

### Test Results

```
🧪 Testing PopulateQuestionnaireActionHandler

✅ Test 1: Handler Registration
✅ Test 2: Creating test data...
✅ Test 3: Config Validation
✅ Test 4: canStart method
✅ Test 5: start method
✅ Test 6: complete method
✅ Test 7: fail method
✅ Test 8: skip method
✅ Test 9: getNextStateOnEvent method

✅ All tests passed!
```

**100% Success Rate** - All 9 tests passed on first run

---

## Integration Points

### Database Dependencies
- ✅ `Questionnaire` model (read access)
- ✅ `QuestionnaireResponse` model (read access)
- ✅ `QuestionnaireResponseAnswer` model (read via response)
- ✅ `QuestionnaireQuestion` model (read via answer)

### Authorization
- ✅ Respects roleScope from workflow template
- ✅ ADMIN can complete any response
- ✅ Users can only complete their own responses

### Error Handling
- ✅ Throws `ActionHandlerError` with specific error codes
- ✅ Provides detailed error messages
- ✅ Validates at every step

### Transaction Support
- ✅ Uses `ctx.tx` for all database operations
- ✅ Participates in workflow transaction

---

## Workflow Usage Example

### Creating a Workflow Template with Questionnaire Step

```typescript
// 1. Create a questionnaire first
const questionnaire = await prisma.questionnaire.create({
  data: {
    title: "Client Intake Form",
    description: "Collect client information",
    isActive: true,
    createdById: lawyerId,
    questions: {
      create: [
        {
          questionText: "What is your full name?",
          questionType: "FREE_TEXT",
          order: 0,
          required: true,
        },
        {
          questionText: "Preferred contact method?",
          questionType: "SINGLE_CHOICE",
          order: 1,
          required: true,
          options: ["Email", "Phone", "SMS"],
        },
      ],
    },
  },
});

// 2. Create workflow template with questionnaire step
const template = await prisma.workflowTemplate.create({
  data: {
    name: "Client Onboarding",
    description: "Standard client onboarding process",
    steps: {
      create: [
        {
          order: 0,
          actionType: "POPULATE_QUESTIONNAIRE",
          actionConfig: {
            questionnaireId: questionnaire.id,
            title: "Complete Client Intake Form",
            description: "Please provide your basic information",
            dueInDays: 3,
          },
          roleScope: ["CLIENT"], // Only clients can complete
          required: true,
        },
      ],
    },
  },
});

// 3. When workflow runs, client completes questionnaire via API
// POST /api/questionnaire-responses
// PATCH /api/questionnaire-responses/:id
// POST /api/questionnaire-responses/:id/complete

// 4. Client submits workflow step with response ID
// The handler validates and stores the response data
```

### Accessing Questionnaire Data in Later Steps

```typescript
// In a subsequent workflow step (e.g., WRITE_TEXT action)
// Template can access questionnaire answers:

// Email template example:
const emailTemplate = `
Dear {{matter.client.name}},

Thank you for completing the intake form.

We received the following information:
Name: {{questionnaire_step1_answers.0.answerText}}
Contact Method: {{questionnaire_step1_answers.1.answerJson}}

Best regards,
{{matter.primaryLawyer.name}}
`;
```

---

## Error Codes

| Code | Description | When Thrown |
|------|-------------|-------------|
| `INVALID_CONFIG` | Configuration validation failed | validateConfig() |
| `QUESTIONNAIRE_NOT_FOUND` | Questionnaire doesn't exist or inactive | start() |
| `INVALID_PAYLOAD` | Completion payload validation failed | complete() |
| `RESPONSE_NOT_FOUND` | Response doesn't exist | complete() |
| `QUESTIONNAIRE_MISMATCH` | Response for different questionnaire | complete() |
| `RESPONSE_NOT_COMPLETED` | Response status not COMPLETED | complete() |
| `UNAUTHORIZED` | Actor is not respondent | complete() |

---

## Design Decisions

### 1. Why validate questionnaire on start()?
- **Early validation**: Catch configuration errors immediately
- **Better UX**: User knows questionnaire is valid before attempting
- **Fail fast**: Don't let workflow progress with invalid config

### 2. Why require COMPLETED status?
- **Data integrity**: Ensure all required questions answered
- **Workflow reliability**: Don't allow partial submissions
- **Audit trail**: Clear completion timestamp

### 3. Why store formatted answers in context?
- **Convenience**: Easy access for subsequent steps
- **Template friendly**: Can reference in email/document templates
- **Type safety**: Structured data with question metadata

### 4. Why allow only respondent (or ADMIN) to complete?
- **Security**: Prevent submission of other users' responses
- **Accountability**: Clear who submitted what
- **Audit**: Track who completed each step

### 5. Why not create response in handler?
- **Separation of concerns**: Handler completes workflow steps, API creates responses
- **Flexibility**: Allows response creation before workflow starts
- **Draft support**: Users can save progress before completing step

---

## Files Modified

1. **Created**: `/lib/workflows/handlers/populate-questionnaire.ts` (250 lines)
2. **Updated**: `/lib/workflows/handlers/index.ts` (3 additions)
3. **Created**: `/scripts/test-populate-questionnaire-handler.ts` (366 lines)

**Total**: 616 lines added, 3 lines modified

---

## Next Steps

### Phase 4: Management UI (4-5 hours)
Ready to implement:

**Pages to Create**:
1. `/app/(dashboard)/questionnaires/page.tsx` - List page
2. `/app/(dashboard)/questionnaires/new/page.tsx` - Create page (optional)

**Components to Create**:
1. `/components/questionnaires/QuestionnaireListClient.tsx` - List component with search/filter
2. `/components/questionnaires/QuestionnaireCreateDialog.tsx` - Create/edit dialog
3. `/components/questionnaires/QuestionnaireCard.tsx` - Individual questionnaire card

**Features**:
- List all questionnaires with pagination
- Search by title/description
- Filter by active/inactive
- Create new questionnaire
- Edit existing questionnaire
- Soft delete questionnaire
- View response count
- Quick activate/deactivate

---

## Success Criteria Met

- ✅ Handler implements `IActionHandler` interface
- ✅ All required methods implemented (validateConfig, canStart, start, complete, fail, skip, getNextStateOnEvent)
- ✅ Configuration validation with Zod
- ✅ Database validation on start
- ✅ Response validation on complete
- ✅ Authorization checks (respondent or ADMIN)
- ✅ Workflow context updates with formatted data
- ✅ Error handling with specific error codes
- ✅ Handler registered in action registry
- ✅ Comprehensive test coverage (9 tests)
- ✅ All tests passing (100% success rate)
- ✅ TypeScript compilation successful
- ✅ No lint errors
- ✅ Documentation complete

---

**Phase 3 Status**: ✅ **COMPLETE**  
**Ready for**: Phase 4 - Management UI Implementation  
**Total Progress**: 3/8 phases complete (~37.5%)  
**Estimated Remaining**: 15-22 hours
