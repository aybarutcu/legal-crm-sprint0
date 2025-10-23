# Workflow Instance Editor - Canvas Implementation

**Date**: October 23, 2025  
**Type**: Architecture Fix  
**Impact**: Breaking Change (Dev Only - Corrected Implementation)

---

## Summary

Replaced the incorrectly implemented form-based workflow instance editor with a React Flow canvas editor, matching the architecture used in the workflow template editor. This ensures consistency across the application and provides users with a visual workflow editing experience.

---

## What Was Changed

### 1. **Replaced Form Editor with Canvas Editor**
**File**: `app/(dashboard)/workflows/instances/[id]/edit/_components/`

**Before** (`workflow-instance-editor-client.tsx` - ~500 lines):
- ❌ Form-based step list editor
- ❌ Manual up/down buttons for reordering
- ❌ Side panel for editing individual steps
- ❌ Text-heavy interface with poor visualization

**After** (`workflow-instance-canvas-editor.tsx` - ~380 lines):
- ✅ React Flow canvas with visual nodes
- ✅ Drag-and-drop positioning
- ✅ Visual dependency connections
- ✅ Property panel for step configuration
- ✅ Auto-layout for new workflows

### 2. **Updated Page Component**
**File**: `app/(dashboard)/workflows/instances/[id]/edit/page.tsx`

Changed import and component usage:
```tsx
// Before
import { WorkflowInstanceEditorClient } from "./_components/workflow-instance-editor-client";

// After
import { WorkflowInstanceCanvasEditor } from "./_components/workflow-instance-canvas-editor";
```

---

## Architecture Alignment

### Template Editor (Already Canvas)
**Location**: `/workflows/templates/[id]/edit`  
**Component**: `WorkflowTemplateEditor.tsx`  
**UI**: React Flow canvas with node palette

### Instance Editor (Now Canvas)
**Location**: `/workflows/instances/[id]/edit`  
**Component**: `WorkflowInstanceCanvasEditor.tsx`  
**UI**: React Flow canvas (matching template editor)

**Consistency**: ✅ Both editors now use the same visual paradigm

---

## Key Differences: Template vs Instance Editor

### Workflow Template Editor
- Creates reusable templates
- Steps have **persistent canvas positions** (positionX, positionY in DB)
- Can add new action types from node palette
- Saves to `WorkflowTemplateStep` table

### Workflow Instance Editor
- Edits specific workflow executions
- Steps have **no persistent positions** (auto-layout each time)
- Cannot add new steps (based on template)
- Only edits metadata: title, assignment, due date, priority, notes
- Cannot edit COMPLETED or IN_PROGRESS steps (preserves history)
- Saves to `WorkflowInstanceStep` table

---

## Implementation Details

### Canvas Step Conversion
```typescript
// Convert instance steps to canvas format
const canvasSteps = instance.steps.map((step) => ({
  id: step.id,
  order: step.order,
  title: step.title,
  actionType: step.actionType,
  roleScope: step.roleScope,
  required: step.required,
  actionConfig: step.actionData, // Different field name
  dependsOn: step.dependsOn.map(id => convertToOrder(id)), // ID → order
  dependencyLogic: step.dependencyLogic,
  conditionType: step.conditionType,
  conditionConfig: step.conditionConfig,
  positionX: undefined, // No persistence for instances
  positionY: undefined,
}));
```

### Dependency Handling
- **Template**: Uses `order` numbers (e.g., depends on step 2)
- **Instance**: Uses step `id` strings (e.g., depends on "ckx...abc")
- **Conversion**: Canvas uses orders, so we convert IDs ↔ orders

### Save Flow
```typescript
// User edits on canvas → onChange updates local state
handleCanvasChange(updatedSteps) {
  // Convert canvas steps back to instance format
  // Convert dependsOn orders back to step IDs
  // Preserve metadata (actionState, startedAt, etc.)
}

// User clicks "Save Changes"
handleSave() {
  // PATCH /api/workflows/instances/[id]/edit
  // Sends all steps with updated data
  // Redirects back to matter/contact detail
}
```

---

## User Experience Changes

### Before (Form Editor)
1. User clicks "Edit Workflow" button
2. Opens page with vertical list of steps
3. Clicks edit icon on individual step → side panel opens
4. Updates fields in form
5. Clicks "Update Step" → saves one step
6. Repeats for each step
7. Clicks "Save Changes" → saves all

### After (Canvas Editor)
1. User clicks "Edit Workflow" button
2. Opens page with visual flow canvas
3. Sees entire workflow at a glance
4. Clicks any node → property panel opens
5. Updates fields inline
6. Drags nodes to visualize better (positions not persisted)
7. Clicks "Save Changes" → saves all

**Benefits**:
- ✅ Visual understanding of workflow structure
- ✅ See dependencies as connecting lines
- ✅ Edit multiple steps without closing panel
- ✅ Consistent UX with template editor
- ✅ Industry-standard workflow visualization

---

## Files Modified

### Created
- ✅ `workflow-instance-canvas-editor.tsx` (new canvas-based editor)
- ✅ `docs/features/workflow/WORKFLOW-INSTANCE-CANVAS-EDITOR.md` (this file)

### Modified
- ✅ `app/(dashboard)/workflows/instances/[id]/edit/page.tsx` - Changed component import

### Backed Up
- ✅ `workflow-instance-editor-client.tsx.bak` (old form editor)

### Deleted
- ❌ None (old file backed up for reference)

---

## Database Schema Considerations

### WorkflowInstanceStep Model
**Note**: Unlike `WorkflowTemplateStep`, the instance step model does **not** have `positionX` and `positionY` fields.

**Rationale**:
- Template positions are reusable across all instances
- Instance positions would clutter the DB without benefit
- Auto-layout works well for visualization
- If needed later, can add fields via migration

**Current Schema** (relevant fields):
```prisma
model WorkflowInstanceStep {
  id              String
  instanceId      String
  order           Int
  title           String
  actionType      ActionType
  roleScope       RoleScope
  actionState     ActionState
  actionData      Json?
  dependsOn       String[]  // Array of step IDs
  dependencyLogic DependencyLogic
  conditionType   ConditionType?
  conditionConfig Json?
  // NO positionX or positionY fields
}
```

---

## API Compatibility

### GET /api/workflows/instances/[id]/edit
**No changes required** - Already returns all necessary data

### PATCH /api/workflows/instances/[id]/edit
**Payload format unchanged**:
```json
{
  "steps": [
    {
      "id": "ckx...",
      "order": 0,
      "title": "Updated Title",
      "actionType": "CHECKLIST",
      "roleScope": "LAWYER",
      "required": true,
      "actionData": {...},
      "assignedToId": "user123",
      "dueDate": "2025-10-30",
      "priority": "HIGH",
      "notes": "Updated notes",
      "dependsOn": ["ckx..."],
      "dependencyLogic": "ALL",
      "conditionType": "ALWAYS",
      "conditionConfig": null
      // No positionX or positionY in payload
    }
  ]
}
```

---

## Testing Checklist

### Manual Testing
- ✅ Navigate to matter detail page
- ✅ Click "Edit Workflow" button on a workflow instance
- ✅ Should open canvas editor (not form list)
- ✅ See workflow steps as visual nodes
- ✅ Click a node → property panel appears
- ✅ Edit step title → changes reflected in node
- ✅ Create dependency by dragging from green dot
- ✅ Delete dependency by selecting edge and pressing Delete
- ✅ Click "Save Changes" → redirects to matter page
- ✅ Verify changes persisted

### Edge Cases
- ✅ COMPLETED steps should not be editable (grayed out)
- ✅ IN_PROGRESS steps should not be editable
- ✅ PENDING/READY steps should be fully editable
- ✅ Canvas should show dependency arrows correctly
- ✅ Circular dependencies should be prevented (canvas validation)

---

## Rollback Plan

If issues arise, restore the form editor:

```bash
# Restore backed up file
mv app/\(dashboard\)/workflows/instances/\[id\]/edit/_components/workflow-instance-editor-client.tsx.bak \
   app/\(dashboard\)/workflows/instances/\[id\]/edit/_components/workflow-instance-editor-client.tsx

# Update page import
# Change: import { WorkflowInstanceCanvasEditor } from "./_components/workflow-instance-canvas-editor";
# To:     import { WorkflowInstanceEditorClient } from "./_components/workflow-instance-editor-client";

# Change component usage in return statement
```

---

## Metrics

### Code Changes
- **Old Editor**: 502 lines (form-based)
- **New Editor**: 380 lines (canvas-based)
- **Reduction**: 122 lines (-24.3%)

### Files
- **Created**: 1 (canvas editor)
- **Modified**: 1 (page import)
- **Backed Up**: 1 (old editor)
- **Deleted**: 0

### User Experience
- **Clicks to edit step**: 2 (same)
- **Visual feedback**: ✅ Significantly improved
- **Learning curve**: ✅ Reduced (consistent with template editor)
- **Error prevention**: ✅ Better (visual cycle detection)

---

## Related Documentation

- `docs/features/workflow/VISUAL-WORKFLOW-BUILDER-PLAN.md` - Original canvas plan
- `docs/features/workflow/FORM-EDITOR-CLEANUP.md` - Template form editor removal
- `docs/features/workflow/WORKFLOW-INSTANCE-EDITOR.md` - Original instance editor spec (form-based, now outdated)
- `components/workflows/WorkflowCanvas.tsx` - Shared canvas component

---

## Conclusion

The workflow instance editor now matches the template editor's visual paradigm, providing users with a consistent, industry-standard workflow editing experience. The canvas-based approach improves workflow comprehension, reduces cognitive load, and aligns with modern workflow management UX patterns.

**Status**: ✅ Complete  
**Production Risk**: ✅ None (dev-only correction)  
**User Impact**: ✅ Positive (better UX consistency)
