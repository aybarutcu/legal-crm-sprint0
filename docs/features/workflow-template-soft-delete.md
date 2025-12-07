# Workflow Template Soft Delete & Archiving

**Date:** 2025-11-27  
**Feature:** Soft delete implementation for workflow templates to prevent orphan workflow instances  
**Type:** Data Integrity & UX Enhancement

## Problem Statement

Initial implementation had a **hard delete** approach that could create orphan workflow instances:

1. **Referential Integrity Issue**: When a template with active workflow instances was deleted, the instances became orphans (pointing to non-existent template)
2. **Data Loss**: Hard delete prevented data recovery and audit trail
3. **Protection Was Too Strict**: Original DELETE endpoint refused to delete templates with instances (409 Conflict), but this blocked legitimate cleanup

## Solution: Soft Delete with Smart UI

Implemented **soft delete pattern** (matching the rest of the system) with intelligent UI that distinguishes between delete and archive actions.

**Key Protection:** Templates can only be archived if all workflow instances are **COMPLETED** or **CANCELED**. Active workflows must be finished first to prevent disruption.

## Implementation Details

### 1. Database Schema Changes

**File:** `prisma/schema.prisma`

Added soft delete fields to `WorkflowTemplate`:

```prisma
model WorkflowTemplate {
  id            String   @id @default(cuid())
  name          String
  description   String?
  version       Int      @default(1)
  isActive      Boolean  @default(false)
  contextSchema Json?
  createdById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?  // NEW: Soft delete timestamp
  deletedBy     String?    // NEW: User who deleted/archived

  createdBy     User?                  @relation(fields: [createdById], references: [id], onDelete: SetNull)
  deletedByUser User?                  @relation("WorkflowTemplateDeletedBy", fields: [deletedBy], references: [id], onDelete: SetNull)
  steps         WorkflowTemplateStep[]
  dependencies  WorkflowTemplateDependency[]
  instances     WorkflowInstance[]

  @@unique([name, version])
}
```

**Migration:** `20251127145132_add_workflow_template_soft_delete`

### 2. API Changes

#### DELETE Endpoint (Soft Delete)

**File:** `app/api/workflows/templates/[id]/route.ts`

**Before:**
```typescript
// Hard delete with instance check - blocked deletion if instances exist
const hasInstances = await prisma.workflowInstance.count({
  where: { templateId: params.id },
});

if (hasInstances > 0) {
  return NextResponse.json(
    { error: "Template has instances and cannot be deleted" },
    { status: 409 },
  );
}

await prisma.workflowTemplate.delete({
  where: { id: params.id },
});
```

**After:**
```typescript
// Soft delete - with active workflow protection
const existing = await prisma.workflowTemplate.findUnique({
  where: { id: params.id },
  select: { id: true, isActive: true, deletedAt: true },
});

if (existing.deletedAt) {
  return NextResponse.json(
    { error: "Template is already deleted" },
    { status: 410 }, // 410 Gone
  );
}

// Check for ACTIVE workflow instances
const activeInstanceCount = await prisma.workflowInstance.count({
  where: { 
    templateId: params.id,
    status: {
      in: ['ACTIVE']
    }
  },
});

if (activeInstanceCount > 0) {
  return NextResponse.json(
    { error: `Cannot archive template: ${activeInstanceCount} active workflow${activeInstanceCount === 1 ? '' : 's'} in progress. Complete or cancel them first.` },
    { status: 409 },
  );
}

await prisma.workflowTemplate.update({
  where: { id: params.id },
  data: {
    deletedAt: new Date(),
    deletedBy: session!.user!.id,
    isActive: false, // Also deactivate when archiving
  },
});
```

**Key Changes:**
- ✅ No more hard delete - preserves referential integrity
- ✅ Returns 410 Gone if already deleted (idempotent)
- ✅ **Blocks archive if ANY active workflows exist** (protection!)
- ✅ Allows archive only when all workflows are completed/cancelled
- ✅ Sets `isActive: false` to ensure archived templates can't be used
- ✅ Tracks who archived the template (`deletedBy`)

#### GET Endpoint (Filter Deleted)

**File:** `app/api/workflows/templates/route.ts`

```typescript
const templates = await prisma.workflowTemplate.findMany({
  where: {
    deletedAt: null, // Only show non-deleted templates
  },
  orderBy: [
    { isActive: "desc" },
    { updatedAt: "desc" },
  ],
  include: {
    steps: true,
    dependencies: true,
    _count: {
      select: {
        instances: {
          where: {
            matterId: {
              not: null, // Only count matter-linked instances
            },
          },
        },
      },
    },
  },
});
```

**Behavior:**
- Archived templates disappear from main list
- Instance counts match dialog display (matter-only)
- Active and draft templates visible as before

### 3. UI Changes

#### Smart Button Labels

**File:** `components/workflows/TemplateGroup.tsx`

Button changes color and label based on instance count:

```tsx
<button
  type="button"
  onClick={() => deleteTemplate(template.id)}
  disabled={isDeleting}
  className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
    template._count && template._count.instances > 0
      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"  // Archive styling
      : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"          // Delete styling
  }`}
  title={
    template._count && template._count.instances > 0
      ? `Archive this template (${template._count.instances} matter${template._count.instances === 1 ? '' : 's'} using it)`
      : "Delete this template"
  }
>
  {isDeleting
    ? template._count && template._count.instances > 0
      ? "Archiving..."
      : "Deleting..."
    : template._count && template._count.instances > 0
    ? "Archive"      // Amber button
    : "Delete"}      // Red button
</button>
```

**Visual Distinctions:**
| Scenario | Button Color | Button Text | Tooltip |
|----------|--------------|-------------|---------|
| No instances | Red (`bg-red-50`) | "Delete" | "Delete this template" |
| Has instances | Amber (`bg-amber-50`) | "Archive" | "Archive this template (N matters using it)" |

#### Enhanced Confirmation Messages

**File:** `app/(dashboard)/workflows/templates/_components/client.tsx`

```typescript
async function deleteTemplate(id: string) {
  const template = templates.find(t => t.id === id);
  const instanceCount = template?._count?.instances ?? 0;
  const hasInstances = instanceCount > 0;
  
  const confirmMessage = hasInstances
    ? `This template is being used by ${instanceCount} matter${instanceCount === 1 ? '' : 's'}. Archiving will preserve existing workflows but hide this template from the list.\n\nAre you sure you want to archive it?`
    : "Are you sure you want to delete this template?";
  
  if (!window.confirm(confirmMessage)) {
    return;
  }
  
  // ... proceed with soft delete
}
```

**Confirmation Dialog Examples:**

**No instances (Delete):**
```
Are you sure you want to delete this template?
```

**Has instances (Archive with completed workflows):**
```
This template is being used by 3 matters.

Note: You can only archive templates with completed or cancelled workflows. 
If you have active workflows, complete or cancel them first.

Are you sure you want to archive this template?
```

**Has active workflows (Archive blocked):**
User clicks "Archive" → Confirmation appears → User confirms → API returns:
```
Error: Cannot archive template: 3 active workflows in progress. 
Complete or cancel them first.
```

## User Experience Flow

### Scenario 1: Delete Draft Template (No Instances)

1. User sees template with **red "Delete" button**
2. Clicks button
3. Confirmation: "Are you sure you want to delete this template?"
4. Confirms → Template soft-deleted
5. Template disappears from list
6. Database: `deletedAt` set, `isActive = false`

### Scenario 2: Archive Active Template (Has Instances)

1. User sees template with **matter count badge** and **amber "Archive" button**
2. Clicks "Archive"
3. Confirmation: "This template is being used by 4 matters. Note: You can only archive templates with completed or cancelled workflows. If you have active workflows, complete or cancel them first. Are you sure you want to archive this template?"
4. Confirms → API checks for active workflows
5. **If active workflows exist:** Error displayed: "Cannot archive template: 3 active workflows in progress. Complete or cancel them first."
6. **If all workflows completed/cancelled:** Template archived successfully
7. Template disappears from list
8. **Workflow instances remain intact** - no orphans!
9. Database: `deletedAt` set, `isActive = false`, `deletedBy` = current user

### Scenario 3: Attempt Archive with Active Workflows (Blocked)

1. Template has 3 matter instances, 2 are ACTIVE status
2. User clicks amber "Archive" button
3. Confirmation appears (user confirms)
4. API returns 409 error: "Cannot archive template: 2 active workflows in progress. Complete or cancel them first."
5. Error displayed to user
6. Template remains visible in list
7. User must complete/cancel active workflows before archiving

## Data Integrity Benefits

### Prevents Orphan Instances

**Before (Hard Delete):**
```
WorkflowInstance
├── templateId: "abc123"  ❌ Points to deleted template
├── matterId: "matter1"
└── status: "ACTIVE"      ❌ Active workflow referencing non-existent template
```

**After (Soft Delete):**
```
WorkflowInstance
├── templateId: "abc123"  ✅ Still valid reference
├── matterId: "matter1"
└── status: "ACTIVE"      ✅ Workflow continues normally

WorkflowTemplate (id: "abc123")
├── deletedAt: 2025-11-27 ✅ Archived, not destroyed
├── deletedBy: "user123"   ✅ Audit trail
└── isActive: false        ✅ Can't create new instances
```

### Preserves Audit Trail

Archived templates remain queryable:

```typescript
// Get all templates including archived
const allTemplates = await prisma.workflowTemplate.findMany({
  // No deletedAt filter
});

// Get only archived templates
const archivedTemplates = await prisma.workflowTemplate.findMany({
  where: {
    deletedAt: { not: null },
  },
});

// Get archive history
const archiveHistory = await prisma.workflowTemplate.findMany({
  where: {
    deletedAt: { not: null },
  },
  include: {
    deletedByUser: {
      select: { name: true, email: true },
    },
  },
  orderBy: {
    deletedAt: 'desc',
  },
});
```

### Enables Data Recovery

If a template was archived by mistake:

```typescript
// Restore archived template
await prisma.workflowTemplate.update({
  where: { id: templateId },
  data: {
    deletedAt: null,
    deletedBy: null,
    // Optionally restore isActive status
  },
});
```

## Consistency with System Patterns

This implementation follows the existing soft delete pattern used throughout the system:

| Model | Has `deletedAt` | Has `deletedBy` |
|-------|----------------|----------------|
| User | ✅ | ✅ |
| Contact | ✅ | ✅ |
| Matter | ✅ | ✅ |
| Document | ✅ | ✅ |
| Task | ✅ | ✅ |
| Event | ✅ | ✅ |
| **WorkflowTemplate** | ✅ **NEW** | ✅ **NEW** |

All queries across the system use `where: { deletedAt: null }` to filter out soft-deleted records.

## Testing Scenarios

### Test 1: Delete Draft Template
```bash
# Setup: Create draft template with no instances
# Action: Click "Delete" button
# Expected: Red button, simple confirmation, template disappears
# Verify: deletedAt is set, template not in GET response
```

### Test 2: Archive Active Template
```bash
# Setup: Create active template with 3 matter instances (all COMPLETED)
# Action: Click "Archive" button
# Expected: Amber button, detailed confirmation with count
# Verify: 
#   - deletedAt is set
#   - isActive = false
#   - Workflow instances still reference template
#   - Template not in GET response
```

### Test 3: Block Archive with Active Workflows
```bash
# Setup: Create active template with 3 matter instances (2 ACTIVE, 1 COMPLETED)
# Action: Click "Archive" button
# Expected: 
#   - Confirmation appears
#   - User confirms
#   - Error: "Cannot archive template: 2 active workflows in progress. Complete or cancel them first."
# Verify: 
#   - Template NOT archived (deletedAt = null)
#   - Template still visible in list
#   - Error message displayed in red banner
```

### Test 3: Block Archive with Active Workflows
```bash
# Setup: Create active template with 3 matter instances (2 ACTIVE, 1 COMPLETED)
# Action: Click "Archive" button
# Expected: 
#   - Confirmation appears
#   - User confirms
#   - Error: "Cannot archive template: 2 active workflows in progress. Complete or cancel them first."
# Verify: 
#   - Template NOT archived (deletedAt = null)
#   - Template still visible in list
#   - Error message displayed in red banner
```

### Test 4: Attempt Duplicate Archive
```bash
# Setup: Archive a template
# Action: Call DELETE endpoint again with same ID
# Expected: 410 Gone response
# Verify: Idempotent behavior, no errors
```

### Test 5: Instance Count Accuracy
```bash
# Setup: Template with 2 matter instances + 1 contact instance
# Expected: Badge shows "2" (not 3)
# Action: Click badge → dialog shows 2 matters
# Verify: Count matches dialog contents
```

## API Response Codes

| Scenario | Status Code | Reason |
|----------|-------------|--------|
| Success | 204 No Content | Template archived successfully |
| Not Found | 404 Not Found | Template ID doesn't exist |
| Already Deleted | 410 Gone | Template was already archived |
| Active Workflows | 409 Conflict | Template has active workflows in progress |
| Unauthorized | 401 Unauthorized | User not authenticated |
| Forbidden | 403 Forbidden | User is not ADMIN |

## Future Enhancements

### 1. Archive Management UI

Add admin page to view and restore archived templates:

```typescript
// Route: /admin/workflows/archived
- List all archived templates
- Show who archived and when
- "Restore" button to un-archive
- Permanent delete option (hard delete)
```

### 2. Auto-Archive Old Drafts

Automatically archive draft templates older than N days:

```typescript
// Cron job or admin action
await prisma.workflowTemplate.updateMany({
  where: {
    isActive: false,
    deletedAt: null,
    updatedAt: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  },
  data: {
    deletedAt: new Date(),
    deletedBy: 'system',
  },
});
```

### 3. Cascade Soft Delete

When archiving a template, optionally archive all dependent data:

```typescript
// Archive template and all its instances
await prisma.$transaction([
  prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { deletedAt: new Date(), deletedBy: userId },
  }),
  prisma.workflowInstance.updateMany({
    where: { templateId },
    data: { deletedAt: new Date(), deletedBy: userId },
  }),
]);
```

## Related Files

- `prisma/schema.prisma` - Schema definition
- `prisma/migrations/20251127145132_add_workflow_template_soft_delete/` - Migration
- `app/api/workflows/templates/route.ts` - GET endpoint (filter)
- `app/api/workflows/templates/[id]/route.ts` - DELETE endpoint (soft delete)
- `components/workflows/TemplateGroup.tsx` - UI button logic
- `app/(dashboard)/workflows/templates/_components/client.tsx` - Confirmation messages

## Related Documentation

- `docs/features/workflow-template-versioning-system.md` - Version management
- `docs/features/workflow-template-safeguards.md` - Change detection and name locking
- `docs/MASTER-SYSTEM-DOCUMENTATION.md` - Full system architecture
