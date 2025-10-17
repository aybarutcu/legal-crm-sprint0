# Bug Fix: Questionnaire Workflow Config Validation Error

**Date**: October 16, 2025  
**Status**: ✅ Fixed  
**Severity**: Critical - Blocking workflow creation  
**Components Affected**: Workflow Integration (Phase 6)

## Problem

When attempting to start a workflow step with `POPULATE_QUESTIONNAIRE` action type, the system threw a validation error:

```
ActionHandlerError: Invalid POPULATE_QUESTIONNAIRE config: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["title"],
    "message": "Required"
  }
]
```

**Error occurred at**: `/api/workflows/steps/[id]/start` (POST)

## Root Cause

The `PopulateQuestionnaireActionHandler` defines a config schema that requires specific fields:

```typescript
const configSchema = z.object({
  questionnaireId: z.string().min(1, "Questionnaire ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  dueInDays: z.number().int().min(0).optional(),
});
```

However, the `PopulateQuestionnaireConfigForm` component was only saving:
- `questionnaireId`
- `questionnaireName`

The form was missing the required `title` field and optional `description` and `dueInDays` fields.

## Solution

Updated `PopulateQuestionnaireConfigForm` to include all required fields:

### 1. Updated Component Interface

**Before**:
```typescript
interface PopulateQuestionnaireConfigFormProps {
  initialConfig: {
    questionnaireId?: string | null;
    questionnaireName?: string;
  };
  onChange: (config: { questionnaireId: string; questionnaireName: string }) => void;
}
```

**After**:
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

### 2. Added Form Fields

Added three new form fields to the component:

1. **Title Field** (Required):
   - Label: "Step Title"
   - Auto-populated when questionnaire selected
   - Example: "Complete Client Intake Form"
   - Purpose: The workflow step title shown to users

2. **Description Field** (Optional):
   - Textarea for additional instructions
   - Helps guide users on completing the questionnaire

3. **Due In Days Field** (Optional):
   - Number input for deadline
   - Sets how many days from step start until due

### 3. Auto-population Logic

When a questionnaire is selected, the title is auto-populated if empty:

```typescript
const handleSelectionChange = (questionnaireId: string) => {
  setSelectedId(questionnaireId);
  const selected = questionnaires.find((q) => q.id === questionnaireId);
  if (selected && !title) {
    // Auto-populate title if empty
    setTitle(`Complete ${selected.title}`);
  }
};
```

### 4. Updated useEffect Hook

Added a useEffect to trigger onChange when any field changes:

```typescript
useEffect(() => {
  if (selectedId && title) {
    onChange({
      questionnaireId: selectedId,
      title,
      description: description || undefined,
      dueInDays: dueInDays && dueInDays > 0 ? dueInDays : undefined,
    });
  }
}, [selectedId, title, description, dueInDays, onChange]);
```

### 5. Updated Default Configs

Updated default config in two locations:

**`/components/matters/MatterDetailClient.tsx`**:
```typescript
case "POPULATE_QUESTIONNAIRE":
  return { questionnaireId: null, title: "", description: "", dueInDays: undefined };
```

**`/app/(dashboard)/workflows/templates/_components/client.tsx`**:
```typescript
case "POPULATE_QUESTIONNAIRE":
  return { questionnaireId: null, title: "", description: "", dueInDays: undefined };
```

### 6. Updated ActionConfigDisplay

Updated the display component to show the step title instead of questionnaire name:

```typescript
case "POPULATE_QUESTIONNAIRE": {
  const title = config.title as string | undefined;
  const description = config.description as string | undefined;
  
  return (
    <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
      <FileQuestion className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-purple-500 flex-shrink-0 mt-0.5`} />
      <div className="space-y-1">
        <div className="text-slate-700">
          <span className="font-medium text-slate-900">
            {title || "Questionnaire"}
          </span>
        </div>
        {description && (
          <div className="text-slate-600">{description}</div>
        )}
        <div className={`text-slate-500 ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
          Client will complete questionnaire
        </div>
      </div>
    </div>
  );
}
```

## Files Modified

1. `/components/workflows/config-forms/PopulateQuestionnaireConfigForm.tsx`
   - Added title, description, dueInDays state
   - Added three new form fields
   - Updated onChange callback
   - Added auto-population logic

2. `/components/workflows/config-forms/ActionConfigForm.tsx`
   - Updated type cast for initialConfig

3. `/components/matters/MatterDetailClient.tsx`
   - Updated default config for POPULATE_QUESTIONNAIRE

4. `/app/(dashboard)/workflows/templates/_components/client.tsx`
   - Updated default config for POPULATE_QUESTIONNAIRE

5. `/components/workflows/ActionConfigDisplay.tsx`
   - Updated to display title and description
   - Changed from questionnaireName to title

## Testing

To verify the fix:

1. ✅ Navigate to `/workflows/templates`
2. ✅ Create a new workflow template
3. ✅ Add a step with "Questionnaire" action type
4. ✅ Select a questionnaire from dropdown
5. ✅ Verify title auto-populates
6. ✅ Fill in optional description and due date
7. ✅ Save the workflow template
8. ✅ Instantiate workflow on a matter
9. ✅ Start the questionnaire step - should succeed without validation error

## Prevention

**Key Learnings**:
1. Always align config form fields with handler validation schema
2. Review handler's configSchema when creating new config forms
3. Include all required fields, even if they seem redundant
4. Separate "workflow step title" from "questionnaire name" conceptually
5. Use auto-population to improve UX while maintaining required fields

## Related Files

- Handler: `/lib/workflows/handlers/populate-questionnaire.ts`
- Config Form: `/components/workflows/config-forms/PopulateQuestionnaireConfigForm.tsx`
- Validation Schema: `/lib/validation/workflow.ts`

## Impact

**Before Fix**: ❌ Could not start questionnaire workflow steps  
**After Fix**: ✅ Full workflow creation and execution with questionnaires working

**Affected Users**: Admins and lawyers creating workflows with questionnaire steps  
**Risk Level**: None - Fix is backward compatible as existing configs would be invalid anyway
