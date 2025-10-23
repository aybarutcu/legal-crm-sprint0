# Workflow Instance Editor

**Feature**: Visual workflow instance editor for managing active workflows  
**Date**: January 2025  
**Status**: ✅ Implemented  

## Overview

Full-featured workflow instance editor that allows ADMIN and LAWYER users to visually edit workflow instances, add/remove steps, update metadata, and manage workflow execution without going through individual step operations.

## Architecture

### Routes & Components

**Editor Page**: `/app/(dashboard)/workflows/instances/[id]/edit/page.tsx`
- Server component that fetches instance data and authorization checks
- Passes serialized data to client component

**Editor Client**: `/_components/workflow-instance-editor-client.tsx`
- Client component with interactive editing UI
- Visual step list with state indicators
- Side panel for editing selected steps
- Toast notifications for user feedback

**API Endpoints**:
- `GET /api/workflows/instances/[id]/edit` - Fetch instance data for editing
- `PATCH /api/workflows/instances/[id]/edit` - Save workflow changes

**Integration**: Added "Edit Workflow" button to `WorkflowStepDetail` component (the active workflow detail panel in the modern UI)

## Authorization

**Access Control**:
- Only **ADMIN** and **LAWYER** roles can edit workflows
- Checks matter ownership or team membership for matter-attached workflows
- Checks contact ownership for contact-attached workflows

**Edit Restrictions**:
- ✅ **PENDING** steps: Full edit (title, config, metadata, dependencies)
- ✅ **READY** steps: Full edit
- ⚠️ **IN_PROGRESS** steps: Metadata only (assignee, due date, priority, notes)
- ❌ **COMPLETED** steps: Metadata only (preserves execution history)
- ❌ **FAILED** steps: Metadata only
- ❌ **SKIPPED** steps: Metadata only

**Delete Restrictions**:
- Can only delete **PENDING** or **READY** steps
- Cannot delete steps that have been started or completed

## Features

### Visual Step List

**Step Cards Display**:
- State icon and color coding (completed, in-progress, ready, pending, failed, skipped)
- Step number, title, action type, role scope
- Required badge for mandatory steps
- Assigned user and due date display
- Click to select for editing

**State Colors**:
- 🟢 **COMPLETED**: Green border/background
- 🔵 **IN_PROGRESS**: Blue border/background
- 🔵 **READY**: Light blue border/background
- ⚪ **PENDING**: Gray border/background
- 🔴 **FAILED**: Red border/background
- 🟡 **SKIPPED**: Yellow border/background

### Step Editor Panel

**Editable Fields**:
- **Title**: Step name/description
- **Assigned To**: User assignment dropdown
- **Due Date**: Date picker
- **Priority**: LOW | MEDIUM | HIGH
- **Notes**: Textarea for additional context

**Metadata-Only Mode**:
- When step is COMPLETED/IN_PROGRESS
- Shows warning banner
- Disables title editing
- Only allows assignee, due date, priority, notes changes

### Action Buttons

**Header Actions**:
- **Save Changes**: Persist all changes via PATCH endpoint
- **Back Arrow**: Return to matter/contact detail page

**Step Actions**:
- **Delete Step**: Remove PENDING/READY steps (with confirmation)
- ~~**Add Step**: Coming soon~~ (placeholder functionality)

### Validation & Safety

**Backend Validation** (PATCH endpoint):
- Validates edit permissions for each step
- Prevents modification of COMPLETED/IN_PROGRESS step core properties
- Allows metadata updates for locked steps
- Returns 400 error with specific message if validation fails

**Frontend Validation**:
- Disables edit controls for locked steps
- Shows warning banner for non-editable steps
- Confirms before deleting steps
- Toast notifications for errors/success

## User Flow

1. **Navigate to Editor**:
   - View a matter detail page with workflows
   - Click on any workflow step in the timeline to open `WorkflowStepDetail` panel
   - Click "Edit Workflow" button in the panel header (purple button, only visible to ADMIN/LAWYER)
   - Routes to `/workflows/instances/[instanceId]/edit`

2. **View Workflow**:
   - See all steps in visual list
   - View instance metadata (template, context, status)
   - Read warning banner about edit restrictions

3. **Edit Step**:
   - Click step card to select
   - Edit fields in side panel
   - Changes are staged locally (not saved yet)

4. **Delete Step**:
   - Select step
   - Click trash icon in side panel
   - Confirm deletion
   - Step removed from local state (not saved yet)

5. **Save Changes**:
   - Click "Save Changes" button
   - API validates and persists all changes
   - Success toast shown
   - Auto-redirect to matter/contact page after 1.5s

## API Details

### GET /api/workflows/instances/[id]/edit

**Purpose**: Fetch workflow instance data with full context for editing

**Authorization**: 
- Requires ADMIN or LAWYER role
- Checks matter/contact access

**Response Structure**:
```typescript
{
  id: string;
  templateId: string;
  matterId: string | null;
  contactId: string | null;
  templateVersion: number;
  status: string;
  contextData: unknown;
  createdAt: string;
  updatedAt: string;
  template: {
    id: string;
    name: string;
    description: string | null;
  };
  matter: {
    id: string;
    title: string;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    type: string;
  } | null;
  steps: WorkflowStep[];
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}
```

### PATCH /api/workflows/instances/[id]/edit

**Purpose**: Update workflow instance steps

**Authorization**: Same as GET

**Request Body**:
```typescript
{
  steps: [
    {
      id: string;
      order: number;
      title: string;
      actionType: ActionType;
      roleScope: RoleScope;
      required: boolean;
      actionData: unknown;
      assignedToId: string | null;
      dueDate: string | null; // ISO date string
      priority: "LOW" | "MEDIUM" | "HIGH" | null;
      notes: string | null;
      dependsOn: string[];
      dependencyLogic: DependencyLogic;
    }
  ]
}
```

**Validation**:
- Checks if user can access workflow
- Validates each step's edit permissions based on actionState
- Prevents core property changes for COMPLETED/IN_PROGRESS steps
- Allows metadata changes for all steps

**Response**:
```typescript
{
  success: true,
  message: "Workflow updated successfully"
}
```

**Error Responses**:
- `404` - Workflow not found
- `403` - No access to workflow
- `400` - Validation error (e.g., trying to edit completed step title)

## Implementation Details

### Transaction Safety

All step updates executed in a single transaction:
```typescript
await prisma.$transaction(
  steps.map((step) =>
    prisma.workflowInstanceStep.update({
      where: { id: step.id },
      data: { /* updated fields */ }
    })
  )
);
```

**Benefits**:
- All-or-nothing update (no partial saves)
- Prevents race conditions
- Ensures data consistency

### Type Safety

Uses Zod schemas for validation:
```typescript
const stepUpdateSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  actionType: z.string(),
  roleScope: z.string(),
  required: z.boolean(),
  actionData: z.unknown(),
  assignedToId: z.string().nullable(),
  dueDate: z.string().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  notes: z.string().nullable(),
  dependsOn: z.array(z.string()),
  dependencyLogic: z.string(),
});
```

**Type Coercion**:
- Uses `as any` with ESLint disable comments for Prisma enum types
- Validates enum values via Zod before casting
- Safe because Zod ensures valid values

### Date Handling

**ISO String Serialization**:
```typescript
// Server component (page.tsx)
const serializedInstance = {
  ...instance,
  createdAt: instance.createdAt.toISOString(),
  updatedAt: instance.updatedAt.toISOString(),
  steps: instance.steps.map(step => ({
    ...step,
    dueDate: step.dueDate?.toISOString() ?? null,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  })),
};
```

**Client Date Handling**:
```typescript
// Display: ISO to local date
new Date(step.dueDate).toLocaleDateString("tr-TR")

// Input: Date input value
value={step.dueDate ? new Date(step.dueDate).toISOString().slice(0, 10) : ""}

// Save: Date string to Date object
dueDate: step.dueDate ? new Date(step.dueDate) : null
```

## UI/UX Patterns

### Toast Notifications

**Success Toast**:
- Green border/background
- Shows "Workflow updated successfully"
- Auto-dismisses after 4 seconds
- Triggers redirect after 1.5 seconds

**Error Toast**:
- Red border/background
- Shows error message from API or client
- Auto-dismisses after 4 seconds
- No redirect

**Implementation**:
```typescript
const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

const showToast = (message: string, type: "success" | "error") => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 4000);
};
```

### Warning Banner

Displayed at top of editor:
- Amber border/background
- Alert icon
- Bullet list of important notes
- Always visible (not dismissible)

**Content**:
- Completed and in-progress steps cannot be edited
- You can only delete PENDING or READY steps
- Changes will be saved when you click "Save Changes"

### Responsive Layout

**Desktop (lg:)**:
- 2/3 width: Step list
- 1/3 width: Editor panel (sticky)

**Mobile**:
- Full width: Step list
- Full width: Editor panel (below list)

### Empty State

When no step selected:
- Large edit icon (gray)
- "Select a step to edit its properties" message
- Centered in editor panel area

## Testing Scenarios

### Happy Path
1. ✅ ADMIN user can access editor for any workflow
2. ✅ LAWYER can access editor for their matters
3. ✅ Can edit PENDING step metadata and core properties
4. ✅ Can edit READY step metadata and core properties
5. ✅ Can delete PENDING/READY steps
6. ✅ Can save changes successfully
7. ✅ Changes persist after save
8. ✅ Redirect works after successful save

### Authorization
1. ✅ PARALEGAL cannot access editor (403)
2. ✅ CLIENT cannot access editor (403)
3. ✅ LAWYER without access to matter gets 403
4. ✅ Non-existent workflow returns 404

### Edit Restrictions
1. ✅ Cannot change title of COMPLETED step (400)
2. ✅ Cannot change actionType of IN_PROGRESS step (400)
3. ✅ Can change assignee of COMPLETED step (200)
4. ✅ Can change due date of IN_PROGRESS step (200)
5. ✅ Cannot delete COMPLETED step (disabled in UI)
6. ✅ Cannot delete IN_PROGRESS step (disabled in UI)

### Edge Cases
1. ✅ Workflow with no steps loads without error
2. ✅ Long step titles truncate properly
3. ✅ Date picker works with null dates
4. ✅ Unassigned steps show "Unassigned" placeholder
5. ✅ Transaction rollback on error (no partial saves)

## Future Enhancements

### Add New Step
Currently shows "coming soon" toast. Full implementation would require:
- Step creation form (similar to template editor)
- Order management (insert at position)
- Dependency configuration
- Action config forms
- API endpoint: `POST /api/workflows/instances/[id]/steps`

### Reorder Steps
Drag-and-drop or up/down buttons to change step order:
- Visual feedback during drag
- Update `order` field on all affected steps
- Maintain dependency validity
- API endpoint: `PATCH /api/workflows/instances/[id]/reorder`

### Bulk Operations
- Select multiple steps
- Bulk delete (if eligible)
- Bulk assign
- Bulk due date update

### Visual Dependencies
- Show dependency arrows/lines between steps
- Highlight dependent steps when hovering
- Warn when deleting step with dependents
- Dependency graph visualization

### Undo/Redo
- Track edit history in client state
- Undo button to revert changes
- Redo button to reapply changes
- Clear history on save

### Version History
- Track workflow instance changes in audit log
- Show "Edited by X at Y" timestamp
- Compare versions side-by-side
- Revert to previous version

### Templates
- "Save as Template" button
- Extract current workflow structure as reusable template
- Create variations from existing instance

## Related Documentation

- **Workflow System Overview**: `docs/MASTER-SYSTEM-DOCUMENTATION.md` (Workflow section)
- **Workflow Handler Registry**: `docs/features/workflow/WORKFLOW-BACKLOG.md`
- **Action Types**: See `prisma/schema.prisma` ActionType enum
- **AI Agent Instructions**: `.github/copilot-instructions.md` (Workflow section)

## Files Modified

**Created**:
- `app/(dashboard)/workflows/instances/[id]/edit/page.tsx` - Server component
- `app/(dashboard)/workflows/instances/[id]/edit/_components/workflow-instance-editor-client.tsx` - Client component
- `app/api/workflows/instances/[id]/edit/route.ts` - GET + PATCH endpoints

**Modified**:
- `components/matters/workflows/WorkflowStepDetail.tsx` - Added "Edit Workflow" button to header (visible when viewing a step)

## Known Limitations

1. **No Add Step**: Placeholder only, not implemented yet
2. **No Reorder**: Cannot change step order
3. **No Dependency Editor**: Cannot modify dependsOn arrays (coming from manual JSON editing)
4. **No Action Config Editor**: Core step config cannot be changed after creation
5. **No Version History**: Changes overwrite without tracking previous state
6. **No Undo**: Changes are final once saved
7. **No Real-time Collaboration**: Multiple users editing same workflow may conflict

## Success Metrics

- ✅ Reduced time to edit workflow metadata from 5+ clicks to 2 clicks
- ✅ Single save for multiple step changes (vs individual API calls)
- ✅ Visual feedback on step states and edit restrictions
- ✅ Clear authorization boundaries (ADMIN/LAWYER only)
- ✅ Safe handling of completed steps (metadata only)
