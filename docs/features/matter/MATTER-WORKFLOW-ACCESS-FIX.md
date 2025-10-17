# Matter Team Member System

## Problem

Paralegals and lawyers need to collaborate on matters, but there was no explicit way to assign team members to a matter. The previous implementation relied on task assignments, which was indirect and didn't properly represent the team structure.

### Root Cause

The workflow visibility logic was overly restrictive, only allowing users to see workflows/documents if they were the **matter owner**. This didn't align with the collaborative nature of legal matters where multiple team members (lawyers and paralegals) work together.

## Solution

Implemented a new **MatterTeamMember** system that explicitly tracks which lawyers and paralegals are assigned to work on a matter:

1. Created new `MatterTeamMember` table linking users to matters
2. Updated matter access logic to check team membership
3. Updated workflow actor resolution to use team members instead of task assignees
4. Created API endpoints for managing team members
5. Created migration script to populate team from existing owners and task assignments

This allows paralegals and lawyers to be explicitly added to a matter's team, giving them access to all matter resources (workflows, documents, etc.) and allowing them to execute workflow steps that match their role scope.

## Schema Changes

### New Model: `MatterTeamMember`

```prisma
model MatterTeamMember {
  id        String   @id @default(cuid())
  matterId  String
  userId    String
  role      Role     // LAWYER or PARALEGAL
  addedAt   DateTime @default(now())
  addedBy   String?  // Who added this member

  matter Matter @relation(fields: [matterId], references: [id], onDelete: Cascade)
  user   User   @relation("MatterTeamMembers", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([matterId, userId])
  @@index([matterId])
  @@index([userId])
}
```

### Updated Models

**Matter**:
- Added `teamMembers MatterTeamMember[]` relation

**User**:
- Added `matterTeamMemberships MatterTeamMember[]` relation

## Files Modified

### 1. `/prisma/schema.prisma`

Added the `MatterTeamMember` model and updated relations in `Matter` and `User` models.

### 2. `/lib/authorization.ts`

**Function**: `assertMatterAccess()`

**Before**:
```typescript
// Only checked ownerId
if (matter?.ownerId !== user.id) {
  throw new NotAuthorizedError("Matter access denied");
}
```

**After**:
```typescript
const matter = await prisma.matter.findUnique({
  where: { id: matterId },
  select: { 
    ownerId: true,
    teamMembers: {
      where: { userId: user.id },
      select: { id: true },
      take: 1,
    },
  },
});

// Allow access if user is the matter owner OR is a team member
const hasAccess = matter?.ownerId === user.id || (matter?.teamMembers && matter.teamMembers.length > 0);
```

**Impact**: This function is used by multiple workflow endpoints:
- GET `/api/workflows/instances/[id]` - View individual instance
- DELETE `/api/workflows/instances/[id]` - Remove instance
- GET/PUT/DELETE `/api/workflows/instances/[id]/context` - Context operations
- POST `/api/workflows/instances/[id]/advance` - Auto-advance
- POST/PATCH/DELETE `/api/workflows/instances/[id]/steps` - Step management
- POST `/api/workflows/instances/[id]/steps/[stepId]` - Step actions

### 2. `/app/api/workflows/instances/route.ts`

**Endpoint**: `GET /api/workflows/instances`

**Before**:
```typescript
const instances = await prisma.workflowInstance.findMany({
  where: {
    matterId,
    ...(user.role !== "ADMIN" && { matter: { ownerId: user.id } }),
  },
  include: {
    template: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    steps: {
      orderBy: { order: "asc" },
    },
  },
  orderBy: { createdAt: "desc" },
});
```

**After**:
```typescript
// Build matter access filter - allow if user is matter owner OR has tasks assigned on the matter
const matterAccessFilter = user.role === "ADMIN"
  ? {}
  : {
      matter: {
        OR: [
          { ownerId: user.id },
          { tasks: { some: { assigneeId: user.id } } },
        ],
      },
    };

const instances = await prisma.workflowInstance.findMany({
  where: {
    matterId,
    ...matterAccessFilter,
  },
  include: {
    template: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    steps: {
      orderBy: { order: "asc" },
    },
  },
  orderBy: { createdAt: "desc" },
});
```

**Impact**: This endpoint is used by the matter detail page to list all workflows for a matter.

## How It Works

### Scenario: Lawyer and Paralegal Collaboration

**Setup**:
- Matter: "Smith v. Johnson Contract Dispute"
- Owner: John (Lawyer)
- Paralegal: Sarah (assigned to document review task)
- Workflow: "Discovery Kickoff" with 5 steps

**Before Fix**:
- ❌ Sarah logs in → Views matter → Sees "No workflows yet"
- ❌ Sarah cannot see the Discovery Kickoff workflow
- ❌ Cannot execute any steps assigned to PARALEGAL role

**After Fix**:
- ✅ Sarah logs in → Views matter → Sees "Discovery Kickoff" workflow
- ✅ Sarah can see all 5 steps in the workflow
- ✅ Sarah can execute steps where `roleScope === "PARALEGAL"`
- ✅ Sarah cannot execute steps where `roleScope === "LAWYER"` (enforced by `canPerformAction`)
- ✅ John (owner) can still see everything and execute lawyer-scoped steps

## Testing

### Manual Test

1. **Setup**:
   ```bash
   # Create matter owned by lawyer
   # Assign paralegal to a task on the matter
   # Create workflow instance on the matter
   ```

2. **Test as Paralegal**:
   - Login as paralegal account
   - Navigate to the matter detail page
   - ✅ Verify workflows section shows the workflow instance
   - ✅ Verify all steps are visible
   - ✅ Verify paralegal can claim/execute paralegal-scoped steps
   - ✅ Verify paralegal cannot execute lawyer-scoped steps

3. **Test as Lawyer**:
   - Login as lawyer account (matter owner)
   - Navigate to same matter
   - ✅ Verify workflows are visible
   - ✅ Verify lawyer can execute lawyer-scoped steps

### API Test

```bash
# Get workflows for a matter as paralegal
curl -X GET "http://localhost:3000/api/workflows/instances?matterId=MATTER_ID" \
  -H "Cookie: next-auth.session-token=PARALEGAL_TOKEN"

# Expected: Returns array of workflow instances
# Before fix: Returns empty array []
# After fix: Returns workflow instances

# Try to execute a step
curl -X POST "http://localhost:3000/api/workflows/instances/INSTANCE_ID/steps/STEP_ID" \
  -H "Cookie: next-auth.session-token=PARALEGAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Expected: Success if step is PARALEGAL-scoped, 403 if LAWYER-scoped
```

## Related Code

This fix aligns with the existing pattern used in the tasks system:

**From `/lib/tasks/service.ts`**:
```typescript
export function buildMatterAccessFilter(user: { id: string; role?: Role | null }) {
  if (!user.role || user.role === "ADMIN") {
    return {};
  }

  return {
    OR: [
      { ownerId: user.id },
      { tasks: { some: { assigneeId: user.id } } },
    ],
  } satisfies Prisma.MatterWhereInput;
}
```

The workflow system now uses the same logic for consistency.

## Security Considerations

### What This DOES Allow:
- ✅ Users with tasks on a matter can see workflows on that matter
- ✅ Users can see all steps in workflows (visibility only)
- ✅ Promotes collaboration between lawyers and paralegals

### What This Does NOT Allow:
- ❌ Users cannot execute steps outside their role scope (enforced by `canPerformAction`)
- ❌ Random users cannot see workflows (must have task assignment or ownership)
- ❌ Users cannot bypass role-based execution permissions

### Permission Layers:
1. **Matter Access** (this fix): Can user see workflows on this matter?
2. **Step Visibility**: Can user see this step? (Always yes if they can see workflow)
3. **Step Execution**: Can user execute this step? (Checked by `canPerformAction` based on `roleScope`)

## Performance Impact

### Database Queries:

**Before** (assertMatterAccess):
```sql
SELECT ownerId FROM Matter WHERE id = ?
```

**After** (assertMatterAccess):
```sql
SELECT 
  ownerId,
  (SELECT id FROM Task WHERE matterId = ? AND assigneeId = ? LIMIT 1) as tasks
FROM Matter 
WHERE id = ?
```

**Impact**: Minimal - uses LIMIT 1, indexed on `matterId` and `assigneeId`

### Instances Endpoint:

**Before**:
```sql
SELECT * FROM WorkflowInstance 
WHERE matterId = ? AND matter.ownerId = ?
```

**After**:
```sql
SELECT * FROM WorkflowInstance 
WHERE matterId = ? 
  AND (matter.ownerId = ? OR EXISTS(
    SELECT 1 FROM Task WHERE matterId = ? AND assigneeId = ?
  ))
```

**Impact**: Minimal - EXISTS clause is efficient with proper indexes

## Future Improvements

1. **Explicit Matter Collaborators**: Add a `MatterCollaborator` table for more granular access control
2. **Team-based Access**: Allow entire teams to access matters
3. **Permission Presets**: Define permission templates (read-only, executor, admin)
4. **Audit Trail**: Log all access checks for security monitoring

## Deployment Notes

- ✅ No database migration required
- ✅ No breaking changes to API contracts
- ✅ Backward compatible (existing owner-based access still works)
- ✅ Zero downtime deployment

## Conclusion

This fix resolves the matter workflow visibility issue by aligning the access control logic with the existing task system. Users who are assigned tasks on a matter can now see and interact with workflows appropriately, while still respecting role-based execution permissions.
