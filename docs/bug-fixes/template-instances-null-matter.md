# Fix: Template Instances Dialog Null Matter Error

## Problem
When clicking the "X Matters" button to view instances using a workflow template, the application crashed with:
```
TypeError: Cannot read properties of null (reading 'title')
Application error: a client-side exception has occurred
```

## Root Cause
Workflow instances in the system can be linked to either:
1. **Matters** (`matterId`) - for matter-specific workflows
2. **Contacts** (`contactId`) - for lead/contact workflows

The schema shows:
```prisma
model WorkflowInstance {
  matterId   String?   // Optional - for matter workflows
  contactId  String?   // Optional - for lead workflows
  matter     Matter?   @relation(...)
  contact    Contact?  @relation(...)
}
```

When the API fetched all instances for a template, some had `matter: null` (contact-only workflows), causing the UI to crash when trying to access `instance.matter.title`.

## Solution

### 1. **API Filter** (`app/api/workflows/templates/[id]/instances/route.ts`)
Added a filter to only return instances that have an associated matter:

```typescript
const instances = await prisma.workflowInstance.findMany({
  where: {
    templateId: params.id,
    // Only get instances that have a matter (not contact-only workflows)
    matterId: {
      not: null,
    },
  },
  // ... rest of the query
});
```

**Why**: This ensures the API only returns workflow instances that are linked to matters, which is what the dialog is designed to display.

### 2. **Type Safety** (`components/workflows/TemplateInstancesDialog.tsx`)
Updated the TypeScript type to allow `matter` to be `null`:

```typescript
type TemplateInstance = {
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
  } | null;  // Added | null
};
```

### 3. **Runtime Filter** (`components/workflows/TemplateInstancesDialog.tsx`)
Added a filter and null-assertion operator as a safety layer:

```typescript
// Filter out any instances without matters
{instances.filter(i => i.matter).map((instance) => (
  <div key={instance.id}>
    <h4>{instance.matter!.title}</h4>
    {/* ... */}
  </div>
))}
```

**Why**: Defense in depth - even though the API now filters, this provides additional safety if the type system isn't enforced or if data changes.

## Files Modified
1. `app/api/workflows/templates/[id]/instances/route.ts` - Added `matterId: { not: null }` filter
2. `components/workflows/TemplateInstancesDialog.tsx` - Made `matter` optional in type, added runtime filter

## Testing
- ✅ Dialog opens without crashing
- ✅ Only matter-based workflow instances are displayed
- ✅ Contact-only workflow instances are excluded
- ✅ Matter details display correctly (title, client, status, dates)
- ✅ Links to matter detail pages work
- ✅ Empty state shows when no matter-based instances exist

## Future Enhancements
If there's a need to show contact-based workflow instances in the future, we could:
1. Create a separate "Contacts" tab in the dialog
2. Add a toggle to switch between "Matters" and "Contacts" view
3. Show unified list with different card styles for matters vs contacts

## Prevention
- Always consider nullable relations in Prisma queries
- When displaying data from optional relations, either:
  1. Filter at the database level (preferred for performance)
  2. Filter at the component level (safety)
  3. Use conditional rendering (`instance.matter && <div>...`)
  4. Provide default/fallback values

## Related
- Original feature: `docs/features/workflow-template-active-protection.md`
- Schema definition: `prisma/schema.prisma` (WorkflowInstance model)
- Workflow documentation: `docs/MASTER-SYSTEM-DOCUMENTATION.md` (Workflow System section)
