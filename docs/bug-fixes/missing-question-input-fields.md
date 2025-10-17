# Bug Fix: Missing Question Input Fields in Workflow Execution

**Date**: October 17, 2025  
**Issue**: Questionnaire execution form shows questions but no input fields (radio buttons, checkboxes, or text areas)  
**Status**: ✅ Fixed with warning messages

---

## Problem

When viewing a matter with a questionnaire workflow step in "IN_PROGRESS" state, users saw:
- ✅ The questionnaire execution form appeared
- ✅ Question text was visible
- ❌ No input fields to answer the questions
- ❌ Could not submit answers

**Root Cause**: Questions were missing their `options` configuration:
- SINGLE_CHOICE questions need options like `["Yes", "No"]`
- MULTI_CHOICE questions need options like `["Option A", "Option B", "Option C"]`
- When options array is empty or null, no input fields render

---

## Solution

### 1. Added Fallback Warning Messages

When a SINGLE_CHOICE or MULTI_CHOICE question has no options configured, show a user-friendly warning:

```typescript
{getOptionsArray(question.options).length > 0 ? (
  // Render options as radio buttons / checkboxes
) : (
  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
    ⚠️ No options configured for this question. Please contact an administrator.
  </div>
)}
```

### 2. Added Debug Logging

Added console logging to help diagnose the issue:

```typescript
console.log("[PopulateQuestionnaireExecution] Fetched questionnaire:", data.questionnaire);
console.log("[PopulateQuestionnaireExecution] Questions:", data.questionnaire.questions);
```

And in the helper function:

```typescript
console.warn("Question options is an object but not an array:", options);
```

---

## How to Fix the Data Issue

### Option A: Update Questions via UI (Recommended)

1. Navigate to `/questionnaires` page
2. Find "Eligibility Test" questionnaire
3. Click "Edit"
4. For each SINGLE_CHOICE or MULTI_CHOICE question:
   - Click "Edit Question"
   - Add options (e.g., "Yes", "No" for passport question)
   - Save
5. Test the workflow again

### Option B: Fix via Database

If questions should be FREE_TEXT instead of SINGLE_CHOICE:

```sql
-- Check current question types
SELECT id, questionText, questionType, options 
FROM "QuestionnaireQuestion" 
WHERE questionnaireId = 'your_questionnaire_id';

-- Option 1: Change type to FREE_TEXT
UPDATE "QuestionnaireQuestion"
SET questionType = 'FREE_TEXT'
WHERE id = 'question_id' AND questionType IN ('SINGLE_CHOICE', 'MULTI_CHOICE');

-- Option 2: Add options for SINGLE_CHOICE questions
UPDATE "QuestionnaireQuestion"
SET options = '["Yes", "No"]'::jsonb
WHERE id = 'question_id' AND questionType = 'SINGLE_CHOICE';
```

### Option C: Recreate Questions

1. Delete the broken questions
2. Create new questions with proper types:
   - For Yes/No questions: Use SINGLE_CHOICE with options ["Yes", "No"]
   - For open-ended questions: Use FREE_TEXT
   - For multiple selection: Use MULTI_CHOICE with appropriate options

---

## Testing Checklist

### ✅ After Fixing Questions

1. **Navigate to matter with questionnaire workflow**
2. **Verify execution form renders correctly:**
   - [ ] FREE_TEXT questions show textarea
   - [ ] SINGLE_CHOICE questions show radio buttons
   - [ ] MULTI_CHOICE questions show checkboxes
3. **Answer all questions**
4. **Click "Submit Questionnaire"**
5. **Verify step completes successfully**
6. **Verify response shows in output viewer**

### 🔍 Debugging Steps

If issues persist:

1. **Open browser console** (F12)
2. **Look for logs:**
   ```
   [PopulateQuestionnaireExecution] Fetched questionnaire: {...}
   [PopulateQuestionnaireExecution] Questions: [...]
   ```
3. **Check each question's structure:**
   - `questionType`: Should be "FREE_TEXT", "SINGLE_CHOICE", or "MULTI_CHOICE"
   - `options`: Should be `null` for FREE_TEXT, array for others
4. **If warning messages appear:** Questions need options configured

---

## Files Modified

1. `/components/workflows/execution/PopulateQuestionnaireExecution.tsx`
   - Added fallback warning for missing options
   - Added console logging for debugging
   - Improved error visibility

---

## Example Question Configuration

### Good Configuration (SINGLE_CHOICE)
```json
{
  "id": "q1",
  "questionText": "Do you have a Passport?",
  "questionType": "SINGLE_CHOICE",
  "required": true,
  "options": ["Yes", "No"]  // ✅ Options configured
}
```

### Bad Configuration (SINGLE_CHOICE with no options)
```json
{
  "id": "q1",
  "questionText": "Do you have a Passport?",
  "questionType": "SINGLE_CHOICE",
  "required": true,
  "options": null  // ❌ No options - nothing will render
}
```

### Alternative (Use FREE_TEXT instead)
```json
{
  "id": "q1",
  "questionText": "Do you have a Passport?",
  "questionType": "FREE_TEXT",  // ✅ Text input will render
  "required": true,
  "options": null
}
```

---

## Prevention

### When Creating Questions:

1. **Choose the right question type:**
   - FREE_TEXT: Open-ended answers, paragraphs
   - SINGLE_CHOICE: Select one option (Yes/No, A/B/C)
   - MULTI_CHOICE: Select multiple options (checkboxes)

2. **Always configure options for SINGLE_CHOICE and MULTI_CHOICE:**
   - Minimum 2 options
   - Clear, concise option text
   - Cover all possible answers

3. **Use validation:**
   - Required questions must be marked as such
   - Options should be validated on save

---

## Next Steps

1. ✅ Check browser console for questionnaire data
2. ✅ Update questions with proper options OR change to FREE_TEXT
3. ✅ Test workflow execution again
4. ✅ Verify responses are captured correctly

---

## Status

✅ **Code Fixed** - Warning messages now show when options are missing  
⏳ **Data Fix Needed** - Questions need proper options configured  
📋 **Action Required** - Update "Eligibility Test" questionnaire questions
