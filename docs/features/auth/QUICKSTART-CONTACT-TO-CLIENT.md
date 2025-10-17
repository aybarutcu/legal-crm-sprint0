# Contact to Client Conversion - Quick Start Guide

## Implementation Complete ✅

The contact-to-client conversion workflow has been implemented. Here's how to use it:

## Files Created

1. **`lib/contact-to-client.ts`** - Core logic
2. **`app/api/contacts/convert-to-client/route.ts`** - API endpoints
3. **`components/contact/ConvertToClientButton.tsx`** - UI component
4. **`docs/contact-to-client-workflow.md`** - Full documentation

## Quick Integration Examples

### 1. Add "Convert to Client" Button in Matter Creation

```tsx
// app/(dashboard)/matters/[id]/page.tsx
import { ConvertToClientButton } from "@/components/contact/ConvertToClientButton";

export default async function MatterDetailPage({ params }: { params: { id: string } }) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.id },
    include: { client: true }
  });

  return (
    <div>
      <h1>{matter.title}</h1>
      
      {/* Show button if client doesn't have portal access yet */}
      {matter.client.type === "LEAD" && (
        <ConvertToClientButton
          contactId={matter.client.id}
          matterId={matter.id}
          contactName={`${matter.client.firstName} ${matter.client.lastName}`}
        />
      )}
    </div>
  );
}
```

### 2. Automatic Conversion When Creating Matter

```tsx
// app/api/matters/route.ts
import { convertContactToClient } from "@/lib/contact-to-client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await req.json();

  // Create matter
  const matter = await prisma.matter.create({
    data: {
      title: body.title,
      type: body.type,
      clientId: body.clientId,
      ownerId: session.user.id
    }
  });

  // Automatically convert contact to client and send invitation
  try {
    await convertContactToClient({
      contactId: body.clientId,
      matterId: matter.id,
      invitedById: session.user.id,
      sendInvitation: true
    });
  } catch (error) {
    console.error("Failed to convert contact to client:", error);
    // Continue - matter was created successfully
  }

  return NextResponse.json({ matter });
}
```

### 3. Portal Access Check Middleware

```tsx
// middleware.ts or app/(portal)/portal/layout.tsx
import { canAccessMatter } from "@/lib/contact-to-client";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "CLIENT") {
    redirect("/portal/login");
  }

  return <div>{children}</div>;
}

// For specific matter pages:
export default async function PortalMatterPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  const canAccess = await canAccessMatter(session.user.id, params.id);
  if (!canAccess) {
    redirect("/portal/unauthorized");
  }

  // Show matter details...
}
```

### 4. Get Client's Matters in Portal

```tsx
// app/(portal)/portal/matters/page.tsx
import { getClientMatters } from "@/lib/contact-to-client";

export default async function ClientMattersPage() {
  const session = await getServerSession(authOptions);
  
  const matters = await getClientMatters(session.user.id);

  return (
    <div>
      <h1>My Matters</h1>
      {matters.map(matter => (
        <div key={matter.id}>
          <h2>{matter.title}</h2>
          <p>Status: {matter.status}</p>
          <p>Documents: {matter._count.documents}</p>
          <p>Tasks: {matter._count.tasks}</p>
          <a href={`/portal/matters/${matter.id}`}>View Details</a>
        </div>
      ))}
    </div>
  );
}
```

### 5. Contact List with Status Indicators

```tsx
// components/contact/ContactList.tsx
import { hasPortalAccess } from "@/lib/contact-to-client";

export async function ContactListItem({ contact }: { contact: Contact }) {
  const hasAccess = await hasPortalAccess(contact.id);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3>{contact.firstName} {contact.lastName}</h3>
        <p>{contact.email}</p>
        <span className={`badge ${contact.type === 'CLIENT' ? 'bg-green-500' : 'bg-gray-500'}`}>
          {contact.type}
        </span>
      </div>
      
      {contact.type === 'CLIENT' && (
        <div>
          {hasAccess ? (
            <span className="text-green-600">✓ Portal Active</span>
          ) : (
            <span className="text-orange-600">⏳ Pending Activation</span>
          )}
        </div>
      )}
    </div>
  );
}
```

## Environment Variables Required

Add to your `.env` file:

```env
# App URL for invitation links
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SMTP for sending invitation emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourlegalfirm.com
```

## Testing the Flow

### 1. Start Development Server
```bash
npm run dev
```

### 2. Create a Lead Contact
- Go to Contacts page
- Create new contact with type "LEAD"
- Make sure they have an email address

### 3. Create a Matter for the Lead
- Go to Matters page
- Create new matter
- Select the LEAD contact as client

### 4. Convert to Client
- On the matter detail page, click "Convert to Client" button
- Check email for invitation

### 5. Activate Portal Account
- Click link in email
- Set password
- Log in to portal

### 6. Verify Portal Access
- Log in at `/portal/login`
- Should see only the matters where they are the primary client

## Current Schema Status

✅ Database schema is up to date  
✅ All migrations applied successfully  
✅ No pending migrations  

**Migrations:**
- `20251020140000_init` - Initial schema
- `20251023080005_sprint6_client_portal` - Portal features
- `20251107090000_workflow_engine_foundations` - Workflows
- `20251015083049_enhanced_schema_improvements` - Schema enhancements (NEW)

## Next Steps

1. **Integrate the ConvertToClientButton** in your matter creation/detail pages
2. **Test the email invitation flow** (configure SMTP)
3. **Customize the email templates** in `lib/contact-to-client.ts`
4. **Add UI indicators** for portal access status
5. **Implement portal pages** using `canAccessMatter()` and `getClientMatters()`

## Support

For detailed documentation, see:
- **Full Workflow:** `docs/contact-to-client-workflow.md`
- **Schema Changes:** `docs/schema-enhancements.md`

For questions or issues, check the troubleshooting section in the full documentation.
