# Workflow Template Active State Protection

## Overview
Enhanced workflow template management to prevent editing active templates and provide visibility into template usage across matters.

## Changes Implemented

### 1. **Edit Template Button Disabled for Active Templates**
- **Location**: `components/workflows/TemplateGroup.tsx`
- **Behavior**: 
  - Active templates show a disabled "Edit Template" button
  - Tooltip message: "Active templates cannot be edited directly. Use 'Duplicate & Edit' to create a new version."
  - Draft templates can still be edited normally
- **Rationale**: Prevents modifying templates that are in use by workflow instances, avoiding breaking changes to running workflows

### 2. **Matter Usage Badge**
- **Location**: `components/workflows/TemplateInstancesDialog.tsx` (new component)
- **Features**:
  - Blue badge showing count of matters using the template
  - Format: "X Matter(s)" button
  - Only displayed when `instanceCount > 0`
  - Positioned between "Publish" and "Delete" buttons

### 3. **Template Instances Dialog**
- **Component**: `TemplateInstancesDialog`
- **Triggered by**: Clicking the matter count badge
- **Displays**:
  - Full-screen modal with list of all matters using the template
  - For each matter:
    - Matter title with link to matter detail page
    - Client name
    - Matter type
    - Matter status (OPEN/IN_PROGRESS/CLOSED)
    - Workflow instance status (ACTIVE/COMPLETED/FAILED/CANCELLED)
    - Workflow start date
  - Loading state while fetching data
  - Empty state if no instances found

### 4. **API Enhancements**

#### Updated Endpoint: `GET /api/workflows/templates`
- **Change**: Added `_count` to include relation
- **Returns**: Template objects with instance count
```typescript
{
  _count: {
    select: {
      instances: true
    }
  }
}
```

#### New Endpoint: `GET /api/workflows/templates/[id]/instances`
- **Purpose**: Fetch all workflow instances for a specific template
- **Returns**: Array of instances with matter details
```typescript
{
  id: string;
  status: string;
  createdAt: string;
  matter: {
    id: string;
    title: string;
    type: string;
    status: string;
    client: {
      firstName: string;
      lastName: string;
    };
  };
}[]
```

### 5. **Type Updates**
- **File**: `components/workflows/types.ts`
- **Change**: Added optional `_count` field to `WorkflowTemplate` type
```typescript
_count?: {
  instances: number;
};
```

## User Experience Flow

### Scenario 1: Editing a Draft Template
1. User sees "Edit Template" button (enabled, white background)
2. Clicks button → navigates to edit page
3. Can modify template freely

### Scenario 2: Attempting to Edit Active Template
1. User sees "Edit Template" button (disabled, gray background)
2. Hover shows tooltip explaining why it's disabled
3. User clicks "Duplicate & Edit" instead
4. Creates new draft version from active template

### Scenario 3: Viewing Template Usage
1. User sees blue badge: "3 Matters"
2. Clicks badge → modal opens
3. Sees list of 3 matters with:
   - Matter titles (clickable links)
   - Client names
   - Status badges
   - Start dates
4. Clicks external link icon → opens matter in new context
5. Clicks "Close" → returns to templates list

## Error Prevention

### Active Template Protection
- **Backend**: Returns 409 Conflict when attempting to PATCH active template
  ```json
  {"error": "Template is active and cannot be modified"}
  ```
- **Frontend**: Button is disabled, preventing the request entirely
- **Result**: Two-layer protection against accidental modifications

### Delete Protection
- **Existing**: Templates with instances cannot be deleted (409 Conflict)
- **Enhanced**: Users can now see which matters are using the template before attempting deletion

## UI/UX Details

### Button States
| Template State | Edit Button | Publish Button | Matters Badge | Delete Button |
|---------------|-------------|----------------|---------------|---------------|
| Draft, 0 instances | Enabled | Shown | Hidden | Enabled |
| Draft, N instances | Enabled | Shown | Shown | Disabled |
| Active, 0 instances | Disabled | Hidden | Hidden | Enabled |
| Active, N instances | Disabled | Hidden | Shown | Disabled |

### Color Coding
- **Edit (Draft)**: White background, slate border
- **Edit (Active)**: Gray background, slate border, disabled cursor
- **Matters Badge**: Blue background (`bg-blue-50`), blue text (`text-blue-700`)
- **Workflow Status**:
  - ACTIVE: Blue (`bg-blue-100`)
  - COMPLETED: Green (`bg-emerald-100`)
  - FAILED: Red (`bg-red-100`)
  - CANCELLED: Gray (`bg-slate-100`)

### Modal Layout
```
┌─────────────────────────────────────────────┐
│ Matters Using "Template Name"         [X]  │
│ 3 workflow instances across 3 matters      │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Matter Title               [external ↗] │ │
│ │ Client: John Doe • Corporate           │ │
│ │ [IN_PROGRESS] [Workflow: ACTIVE]       │ │
│ │                    Started: 11/15/2025 │ │
│ └─────────────────────────────────────────┘ │
│ ... (more matter cards)                    │
├─────────────────────────────────────────────┤
│                              [Close] Button │
└─────────────────────────────────────────────┘
```

## Files Modified
1. `app/api/workflows/templates/route.ts` - Added `_count` to GET endpoint
2. `app/api/workflows/templates/[id]/instances/route.ts` - New endpoint
3. `components/workflows/TemplateGroup.tsx` - Edit button logic, instances badge
4. `components/workflows/TemplateInstancesDialog.tsx` - New dialog component
5. `components/workflows/types.ts` - Added `_count` field
6. `lib/validation/workflow.ts` - Already fixed to accept `null` for `conditionConfig`

## Testing Checklist
- [x] Edit button disabled for active templates
- [x] Edit button enabled for draft templates
- [x] Tooltip shows on disabled edit button
- [x] Matters badge shows correct count
- [x] Matters badge hidden when count is 0
- [x] Dialog opens when clicking matters badge
- [x] Dialog loads instances from API
- [x] Dialog displays matter details correctly
- [x] External links navigate to matter pages
- [x] Dialog closes on backdrop click
- [x] Dialog closes on "Close" button click
- [x] Build succeeds without errors
- [x] Production server starts successfully

## Related Documentation
- Copilot Instructions: `.github/copilot-instructions.md` (Workflow System Architecture)
- Previous Fix: `docs/bug-fixes/workflow-template-validation-422.md`
- Schema: `prisma/schema.prisma` (WorkflowTemplate, WorkflowInstance relations)
