# Workflow Template Versioning Safeguards

**Date:** 2025-11-27  
**Feature:** Three-layer protection system for workflow template versioning  
**Related:** `workflow-template-versioning-system.md`

## Overview

Implemented three critical safeguards to prevent accidental template creation, duplicate saves, and user confusion during workflow template versioning.

## Problem Statement

Initial versioning implementation had several UX issues:

1. **Name Changes Break Versioning**: Users could change the template name when creating a "new version", which would actually create a new template instead of incrementing the version number.

2. **No Change Detection**: System would create new template records even if nothing was modified, leading to:
   - Duplicate templates with identical content
   - Unnecessary version increments
   - Database bloat

3. **No User Feedback**: No warnings or guidance when user actions would have unexpected consequences.

## Implementation

### 1. Name Field Locking (Version Mode)

**File:** `components/workflows/WorkflowTemplateEditor.tsx`

#### Changes:
- Added `versioningMode?: 'version' | 'duplicate'` prop
- Name input disabled when `versioningMode === 'version'`
- Visual indicators:
  - Blue label: "(Locked - creating new version)"
  - Gray background with disabled styling
  - Tooltip explaining why field is locked
  - Help text below field

#### Code:
```tsx
<input
  type="text"
  value={draft.name}
  onChange={(e) => handleNameChange(e.target.value)}
  disabled={versioningMode === 'version'}
  className={`w-full px-4 py-3 border-2 rounded-lg ... ${
    versioningMode === 'version' 
      ? 'border-gray-200 bg-gray-100 cursor-not-allowed text-gray-600' 
      : 'border-gray-300'
  }`}
  title={versioningMode === 'version' ? 'Name is locked...' : ''}
/>
```

#### User Experience:
- **Version Mode**: Name field is locked, shows "Client Intake" (grayed out)
- **Duplicate Mode**: Name field is editable, shows "Client Intake (Copy)"

### 2. Change Detection

**File:** `components/workflows/WorkflowTemplateEditor.tsx`

#### Implementation:
```tsx
// Store initial draft snapshot on component mount
const [initialDraftSnapshot] = useState<WorkflowTemplateDraft>(() => {
  if (initialDraft) {
    return {
      ...initialDraft,
      steps: normaliseSteps(initialDraft.steps),
      dependencies: initialDraft.dependencies ?? [],
    };
  }
  return emptyDraft;
});

// Deep comparison function
function hasChanges(): boolean {
  // Compare name, description, isActive
  if (draft.name !== initialDraftSnapshot.name) return true;
  if (draft.description !== initialDraftSnapshot.description) return true;
  if ((draft.isActive ?? false) !== (initialDraftSnapshot.isActive ?? false)) return true;

  // Compare steps (deep comparison)
  if (draft.steps.length !== initialDraftSnapshot.steps.length) return true;
  
  const stepsChanged = draft.steps.some((step, idx) => {
    const initialStep = initialDraftSnapshot.steps[idx];
    if (!initialStep) return true;
    
    return (
      step.title !== initialStep.title ||
      step.actionType !== initialStep.actionType ||
      step.roleScope !== initialStep.roleScope ||
      step.required !== initialStep.required ||
      JSON.stringify(step.actionConfig) !== JSON.stringify(initialStep.actionConfig) ||
      step.positionX !== initialStep.positionX ||
      step.positionY !== initialStep.positionY
    );
  });
  
  if (stepsChanged) return true;

  // Compare dependencies
  if (draft.dependencies.length !== initialDraftSnapshot.dependencies.length) return true;
  const depsChanged = JSON.stringify(draft.dependencies) !== JSON.stringify(initialDraftSnapshot.dependencies);
  
  return depsChanged;
}
```

#### Validation in Save:
```tsx
async function saveTemplate() {
  if (!draft.name.trim()) {
    setError("Template name is required");
    return;
  }

  // Check if anything changed (only for edit mode or when creating from source)
  if (initialDraft && !hasChanges()) {
    setError("No changes detected. Please modify the template before saving.");
    return;
  }

  // ... proceed with save
}
```

#### User Experience:
- User clicks "Save Template" without making changes
- Red error banner appears: "No changes detected. Please modify the template before saving."
- No API call is made
- Prevents duplicate template creation

### 3. Name Change Warning Modal

**File:** `components/workflows/WorkflowTemplateEditor.tsx`

#### State Management:
```tsx
const [showNameChangeWarning, setShowNameChangeWarning] = useState(false);
const [pendingNameChange, setPendingNameChange] = useState<string | null>(null);
```

#### Handler Logic:
```tsx
function handleNameChange(newName: string) {
  // If in version mode and name is different from original, show warning
  if (versioningMode === 'version' && initialDraft && newName !== initialDraft.name) {
    setPendingNameChange(newName);
    setShowNameChangeWarning(true);
  } else {
    setDraft({ ...draft, name: newName });
  }
}

function confirmNameChange() {
  if (pendingNameChange !== null) {
    setDraft({ ...draft, name: pendingNameChange });
  }
  setShowNameChangeWarning(false);
  setPendingNameChange(null);
}

function cancelNameChange() {
  setShowNameChangeWarning(false);
  setPendingNameChange(null);
}
```

#### Modal UI:
```tsx
{showNameChangeWarning && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <div>
            <h3>Warning: Name Change Detected</h3>
            <p>You are currently creating a new version of "{initialDraft?.name}".</p>
            <p>Changing the name to "{pendingNameChange}" will create a new template instead.</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs">
                <strong>New Version:</strong> Same name → version auto-increments<br/>
                <strong>New Template:</strong> Different name → version starts at 1
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <button onClick={cancelNameChange}>Cancel</button>
          <button onClick={confirmNameChange}>
            Change Name (Create New Template)
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### User Experience:
1. User somehow bypasses the disabled field (e.g., browser dev tools)
2. Modal appears with amber warning icon
3. Clear explanation of consequences
4. Two options:
   - **Cancel**: Revert to original name, keep versioning
   - **Confirm**: Accept new name, create new template instead

## How Versioning Mode is Passed

**File:** `app/(dashboard)/workflows/templates/new/page.tsx`

```tsx
export default async function NewWorkflowTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode; // 'version' or 'duplicate'
  
  // ... fetch source template if sourceId provided
  
  return (
    <WorkflowTemplateEditor 
      mode="create" 
      initialDraft={initialDraft}
      versioningMode={mode as 'version' | 'duplicate' | undefined}
    />
  );
}
```

**Triggered From:**
- `components/workflows/TemplateGroup.tsx`
- `app/(dashboard)/workflows/templates/_components/client.tsx`

```tsx
// Version mode (locked name)
function startNewVersion(templateId: string) {
  router.push(`/workflows/templates/new?sourceId=${templateId}&mode=version`);
}

// Duplicate mode (editable name with "(Copy)")
function duplicateTemplate(templateId: string) {
  router.push(`/workflows/templates/new?sourceId=${templateId}&mode=duplicate`);
}
```

## Test Scenarios

### Scenario 1: Version Creation with Locked Name
1. Navigate to workflow templates
2. Click "Edit Template (New Version)" on active template
3. **Expected**: Name field is disabled and grayed out
4. **Expected**: Helper text shows "💡 The name is locked to create version N+1..."
5. Modify a step, click "Save Template"
6. **Expected**: Creates new version with incremented version number

### Scenario 2: Change Detection
1. Click "Edit Template (New Version)"
2. Don't make any changes
3. Click "Save Template"
4. **Expected**: Red error: "No changes detected. Please modify the template before saving."
5. Modify description
6. Click "Save Template"
7. **Expected**: Successfully creates new version

### Scenario 3: Name Change Warning (Edge Case)
1. Click "Edit Template (New Version)"
2. Use browser dev tools to enable the name input
3. Change name from "Client Intake" → "Modified Intake"
4. **Expected**: Warning modal appears
5. Click "Cancel"
6. **Expected**: Name reverts to "Client Intake"
7. Try again, click "Change Name (Create New Template)"
8. **Expected**: Name changes, will create new template on save

### Scenario 4: Duplicate Template (Normal Flow)
1. Click "Duplicate as New Template"
2. **Expected**: Name field is editable, shows "Client Intake (Copy)"
3. Edit name to "Client Intake - Modified"
4. **Expected**: No warning, name changes normally
5. Save template
6. **Expected**: Creates new template with version 1

## Benefits

### 1. Prevents Accidental Template Creation
- Users can't accidentally create new templates when intending to create versions
- Clear visual feedback about what action will be taken

### 2. Reduces Database Bloat
- Change detection prevents saving identical templates
- Only creates new records when actual modifications exist

### 3. Improves User Understanding
- Locked field clearly indicates versioning behavior
- Warning modal educates users about name/version relationship
- Help text provides guidance

### 4. Maintains Data Integrity
- Version numbers increment correctly
- No orphaned or duplicate templates
- Clear audit trail of template evolution

## Technical Details

### Component Props Flow
```
client.tsx (button click)
  ↓ router.push with mode parameter
new/page.tsx (server component)
  ↓ passes versioningMode prop
WorkflowTemplateEditor.tsx (client component)
  ↓ conditional rendering based on mode
```

### State Management
```typescript
// Immutable snapshot for comparison
const [initialDraftSnapshot] = useState<WorkflowTemplateDraft>(() => {...});

// Mutable current draft
const [draft, setDraft] = useState<WorkflowTemplateDraft>(() => {...});

// Modal state
const [showNameChangeWarning, setShowNameChangeWarning] = useState(false);
const [pendingNameChange, setPendingNameChange] = useState<string | null>(null);
```

### Deep Comparison Strategy
- **Shallow comparison**: name, description, isActive
- **Array length check**: steps, dependencies
- **Deep comparison**: step properties, action configs
- **JSON stringify**: dependencies (complex nested structure)

## Files Modified

1. `components/workflows/WorkflowTemplateEditor.tsx`
   - Added `versioningMode` prop
   - Implemented `hasChanges()` function
   - Added `handleNameChange()` with warning logic
   - Added name change warning modal
   - Updated name input with conditional styling

2. `app/(dashboard)/workflows/templates/new/page.tsx`
   - Passed `versioningMode` prop to editor
   - Extracted `mode` from searchParams

## Related Documentation

- `docs/features/workflow-template-versioning-system.md` - Core versioning logic
- `docs/features/workflow-template-active-protection.md` - Button visibility rules
- `docs/MASTER-SYSTEM-DOCUMENTATION.md` - Full system architecture

## Future Enhancements

1. **Undo/Redo Support**: Track change history for better UX
2. **Visual Diff View**: Show what changed before saving
3. **Auto-save Drafts**: Periodically save work in progress
4. **Version Comparison**: Side-by-side comparison of template versions
5. **Rollback**: Ability to revert to previous version

## Notes

- The locked name field is only enforced in UI, not at API level
- API still uses name matching for version calculation
- Users bypassing UI protections will see warning modal
- Change detection is client-side only (no server validation yet)
