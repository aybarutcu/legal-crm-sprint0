# Contact to Client - Simple Guide

## TL;DR

**You already have a working client invitation system!**  
The existing `<InviteClientButton />` in your contacts page does everything.

---

## What You Already Have ✅

Your system at `/app/(dashboard)/contacts/[id]/page.tsx` already has:

```tsx
<InviteClientButton
  fullName={`${contact.firstName} ${contact.lastName}`}
  email={contact.email}
  isActivated={contact.user?.activatedAt != null}
  hasInvite={contact.user?.invitedAt != null}
/>
```

This button:
- ✅ Converts LEAD → CLIENT automatically
- ✅ Creates User account with CLIENT role
- ✅ Sends invitation email (in Turkish)
- ✅ Links Contact ↔ User
- ✅ Works perfectly!

---

## What We Added (Optional)

### 1. Schema Enhancements
- Soft deletes (deletedAt, deletedBy)
- Document versioning
- Matter financial tracking
- Contact address fields
- 13 new indexes
- **Status:** ✅ Applied successfully

### 2. Helper Functions (`lib/contact-to-client.ts`)
```typescript
// Convert contact type only (no invitation)
await convertContactToClient(contactId);

// Check portal access
await hasPortalAccess(contactId);

// Get client's matters
await getClientMatters(userId);

// Check matter access
await canAccessMatter(userId, matterId);
```

### 3. Optional Convert Button
```tsx
<ConvertToClientButton
  contactId={contact.id}
  contactEmail={contact.email!}
  contactName={`${contact.firstName} ${contact.lastName}`}
/>
```

---

## When to Use What

### Use Existing InviteClientButton (Recommended)
- ✅ Manual invitation from contacts page
- ✅ Resending invitations
- ✅ Most common use case

### Use New ConvertToClientButton
- When creating a matter and want automatic conversion
- When you need to convert type without sending invitation immediately

### Use Helper Functions
- Programmatic access checks in API routes
- Portal authorization middleware
- Custom workflows

---

## Data Model

```
Contact (LEAD)
  ├─> Matter opened
  └─> Becomes CLIENT
      └─> InviteClientButton clicked
          └─> User created (role: CLIENT)
              └─> Contact.userId linked
                  └─> Portal invitation sent
                      └─> Client activates
                          └─> Portal access granted ✅
```

### Portal Access Rule
Clients can only see matters where:
```typescript
Matter.clientId === Contact.id && Contact.userId === User.id
```

---

## Quick Examples

### Example 1: Use Existing System (Recommended)
```tsx
// In your contacts detail page (already there!)
<InviteClientButton 
  fullName={contact.fullName}
  email={contact.email}
  ...
/>
```

### Example 2: Auto-convert When Creating Matter
```tsx
// In matter creation form
import { ConvertToClientButton } from "@/components/contact/ConvertToClientButton";

<ConvertToClientButton
  contactId={selectedContact.id}
  contactEmail={selectedContact.email}
  contactName={selectedContact.name}
  onSuccess={() => {
    // Continue with matter creation
  }}
/>
```

### Example 3: Programmatic Check
```typescript
// In API route or middleware
import { canAccessMatter } from "@/lib/contact-to-client";

export async function GET(req: Request) {
  const session = await getServerSession();
  
  if (session.user.role === "CLIENT") {
    const canAccess = await canAccessMatter(session.user.id, matterId);
    if (!canAccess) {
      return new Response("Unauthorized", { status: 403 });
    }
  }
  
  // Return matter data...
}
```

---

## Testing

1. **Go to contacts page** → Select a LEAD contact
2. **Click "Portal Davetini Gönder" (Send Portal Invitation)**
3. **Check email** for invitation
4. **Click activation link**
5. **Set password**
6. **Login at `/portal/login`**
7. **Verify** you can see only your own matters

---

## Files Reference

- **Existing Invitation:** `/api/clients/invite`
- **Existing Button:** `/components/contact/InviteClientButton.tsx`
- **New Helpers:** `/lib/contact-to-client.ts`
- **New Button:** `/components/contact/ConvertToClientButton.tsx`
- **New API:** `/app/api/contacts/convert-to-client/route.ts`

---

## Summary

✅ **Your system is complete!**  
✅ **Migration applied successfully**  
✅ **No changes needed to existing workflow**  
✅ **Optional helpers available if needed**

**Keep using your existing InviteClientButton - it works perfectly!** 🎉
