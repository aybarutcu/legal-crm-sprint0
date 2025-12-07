# Workflow Template Versioning System

## Overview
Improved workflow template versioning to clearly distinguish between creating a new version of an existing template versus duplicating a template as a completely new template.

## The Problem
Previously, the "Duplicate & Edit" button always created a new template with "(Copy)" appended to the name, even when users wanted to create a new version of an existing template. This led to:
- Confusion about template versions
- Multiple templates with similar names like "Intake (Copy)", "Intake (Copy) (Copy)"
- No clear way to create version 2, 3, etc. of the same template

## How Template Versioning Works

### Database Schema
```prisma
model WorkflowTemplate {
  id      String   @id
  name    String   // Template name (e.g., "Client Intake")
  version Int      // Auto-incremented version number
  isActive Boolean @default(false)
  // ...
}
```

### Version Auto-Increment Logic
When creating a new template with an existing name:
```typescript
const latestVersion = await prisma.workflowTemplate.aggregate({
  where: { name: payload.name },  // Find latest version with same name
  _max: { version: true },
});

const nextVersion = (latestVersion._max.version ?? 0) + 1;
```

**Example**:
- Template "Client Intake" v1 exists
- User creates new version → automatically becomes v2
- User publishes v2 → v1 remains in database, v2 becomes active

## New Button Behavior

### For Active Templates:
| Button | Action | Result |
|--------|--------|--------|
| **Edit Template (New Version)** | Creates new draft version with same name | "Client Intake" v3 (if v2 is active) |
| **Duplicate as New Template** | Creates new template with "(Copy)" suffix | "Client Intake (Copy)" v1 |

### For Draft Templates:
| Button | Action | Result |
|--------|--------|--------|
| **Edit Template** | Opens editor for existing draft | Edits current version in place |
| **Duplicate as New Template** | Creates new template with "(Copy)" suffix | "Client Intake (Copy)" v1 |

## Technical Implementation

### 1. **URL Parameters** (`app/(dashboard)/workflows/templates/new/page.tsx`)
Added `mode` query parameter to distinguish intent:
```typescript
// Create new version: /workflows/templates/new?sourceId=xxx&mode=version
// Duplicate template: /workflows/templates/new?sourceId=xxx&mode=duplicate

const templateName = mode === 'version' 
  ? sourceTemplate.name           // Keep same name → version increment
  : `${sourceTemplate.name} (Copy)`;  // New name → version 1
```

### 2. **Client Functions** (`app/(dashboard)/workflows/templates/_components/client.tsx`)
Separated into two distinct functions:
```typescript
function startNewVersion(template: WorkflowTemplate) {
  router.push(`/workflows/templates/new?sourceId=${template.id}&mode=version`);
}

function duplicateTemplate(template: WorkflowTemplate) {
  router.push(`/workflows/templates/new?sourceId=${template.id}&mode=duplicate`);
}
```

### 3. **UI Components** (`components/workflows/TemplateGroup.tsx`)
Updated button labels and handlers:
```tsx
{template.isActive ? (
  <button onClick={() => startNewVersion(template)}>
    Edit Template (New Version)
  </button>
) : (
  <Link href={`/workflows/templates/${template.id}/edit`}>
    Edit Template
  </Link>
)}
<button onClick={() => duplicateTemplate(template)}>
  Duplicate as New Template
</button>
```

## User Workflows

### Creating a New Version of an Active Template

1. **User sees**: "Client Intake" v2 (Active)
2. **User clicks**: "Edit Template (New Version)" button
3. **System**: 
   - Loads v2's steps and dependencies
   - Generates new step IDs (to avoid conflicts)
   - Sets name to "Client Intake" (same as v2)
   - Opens editor with draft
4. **User**: Makes changes, clicks Save
5. **System**: 
   - Finds latest version (v2)
   - Increments to v3
   - Creates "Client Intake" v3 (Draft)
6. **Result**: 
   - v2 remains Active
   - v3 is Draft, can be edited further
   - Both versions visible in UI under "Client Intake" group

### Duplicating as a New Template

1. **User sees**: "Client Intake" v2 (Active)
2. **User clicks**: "Duplicate as New Template" button
3. **System**:
   - Loads v2's steps and dependencies
   - Generates new step IDs
   - Sets name to "Client Intake (Copy)"
   - Opens editor
4. **User**: Edits name to "VIP Client Intake", clicks Save
5. **System**:
   - Creates "VIP Client Intake" v1 (Draft)
6. **Result**:
   - "Client Intake" v2 unchanged
   - "VIP Client Intake" v1 created as separate template

## Publishing and Activation

- Only **one version** of a template can be active at a time
- Publishing a new version automatically deactivates the previous active version
- All versions remain in the database (audit trail)
- Active templates cannot be edited directly (protected from accidental changes)

## Version Display

Templates are grouped by name in the UI:
```
┌─────────────────────────────────────┐
│ Client Intake                       │
│ 3 versions • 4 steps • Active       │
├─────────────────────────────────────┤
│ ACTIVE VERSION                      │
│ Version 2 • Updated 11/15/2025      │
│ [Edit (New Version)] [Duplicate]    │
├─────────────────────────────────────┤
│ DRAFT VERSIONS                      │
│ Version 3 • Updated 11/20/2025      │
│ [Edit Template] [Duplicate] [Publish]
└─────────────────────────────────────┘
```

## Files Modified
1. `app/(dashboard)/workflows/templates/new/page.tsx` - Added `mode` parameter handling
2. `app/(dashboard)/workflows/templates/_components/client.tsx` - Split into two functions
3. `components/workflows/TemplateGroup.tsx` - Updated button labels and handlers

## Benefits
- ✅ Clear distinction between versioning and duplicating
- ✅ Automatic version incrementing
- ✅ Better organization of template history
- ✅ Prevents accidental modifications to active templates
- ✅ Supports iterative template improvement
- ✅ Full audit trail of all template versions

## Related Documentation
- Previous feature: `docs/features/workflow-template-active-protection.md`
- Schema: `prisma/schema.prisma` (WorkflowTemplate model)
- API versioning: `app/api/workflows/templates/route.ts` (POST handler)
