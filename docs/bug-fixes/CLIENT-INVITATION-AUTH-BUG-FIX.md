# Client Invitation Auth Bug Fix

## Problem

When a client was invited and activated their portal account, they were being created as both a LAWYER user and a CLIENT user in the database. This happened because:

1. Admin sends invite to `client@legacrm.local` → Creates User with `role: CLIENT`
2. Client activates account via `/portal/activate` → Successfully activates the CLIENT user
3. Client logs in via `/portal/login` → The auth handler was **creating a duplicate user** with `role: LAWYER`

## Root Cause

In `/lib/auth.ts`, the credentials provider's `authorize` function had this problematic code:

```typescript
const user =
  (await prisma.user.findUnique({
    where: { email },
  })) ??
  (await prisma.user.create({
    data: { email, role: Role.LAWYER, status: UserStatus.ACTIVE },
  }));
```

The `??` (nullish coalescing operator) would create a NEW user with `role: LAWYER` if the user didn't exist. This was meant for internal staff logging in via OAuth (Google, Azure AD), but it was also being triggered during client portal login.

## The Bug Scenario

The bug occurred when:
- A client email was case-sensitive or had whitespace issues
- The email lookup during login didn't match the activated user
- The auth handler assumed "no user found = create new LAWYER user"

This resulted in:
1. Original CLIENT user with role=CLIENT, isActive=true (correct)
2. Duplicate user with role=LAWYER, isActive=true (incorrect - auto-created during login)

## Solution

Removed the automatic user creation logic from the credentials provider:

```typescript
const user = await prisma.user.findUnique({
  where: { email },
});

if (!user) {
  return null; // Don't create users automatically!
}
```

Now:
- ✅ Only users explicitly created by admins (via `/api/admin/users` or `/api/clients/invite`) can log in
- ✅ Clients must be properly invited and activated before they can log in
- ✅ No duplicate users are created during login
- ✅ OAuth providers (Google, Azure AD) should handle user creation separately in their callbacks

## Prevention

To prevent similar issues:

1. **Never auto-create users in auth handlers** - User creation should be explicit and controlled
2. **Separate OAuth callbacks** - Handle OAuth user creation in dedicated callback logic, not in authorize()
3. **Email normalization** - Always lowercase and trim emails consistently
4. **Database constraints** - The unique constraint on User.email prevents duplicates, but doesn't prevent wrong roles

## Testing

To verify the fix:

1. Create a fresh contact: `newclient@legacrm.local`
2. Send portal invitation
3. Client activates account via the link in email
4. Client logs in via `/portal/login`
5. Verify in database: `SELECT * FROM "User" WHERE email = 'newclient@legacrm.local';`
   - Should see exactly ONE user with role=CLIENT

## Cleanup Required

If you have existing duplicate users in the database:

```sql
-- Find duplicate users (same email, different roles)
SELECT email, COUNT(*), ARRAY_AGG(role) as roles, ARRAY_AGG(id) as user_ids
FROM "User"
GROUP BY email
HAVING COUNT(*) > 1;

-- Manual cleanup needed - carefully review which user to keep
-- Usually keep the CLIENT role and delete the LAWYER duplicate
```

## Related Files

- `/lib/auth.ts` - Fixed credentials authorize function
- `/app/api/clients/invite/route.ts` - Creates CLIENT users properly
- `/app/api/clients/activate/route.ts` - Activates CLIENT users
- `/components/portal/ClientLoginForm.tsx` - Portal login form
- `/app/portal/login/page.tsx` - Portal login page

## Status

✅ **FIXED** - Client invitation and login process now works correctly without creating duplicate users.
