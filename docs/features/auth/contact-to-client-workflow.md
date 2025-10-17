# Contact to Client Conversion Workflow

## Overview

This document describes the workflow for converting a LEAD contact to a CLIENT with portal access when a matter is opened.

## Workflow Stages

### 1. LEAD Stage
- Contact exists in the system
- Type: `LEAD`
- Status: `NEW`, `QUALIFIED`, etc.
- No User account
- No portal access

### 2. Matter Creation
When a matter is opened for a contact:
- Contact type is converted to `CLIENT`
- Contact status is set to `ACTIVE`
- A User account is created with role `CLIENT`
- Contact is linked to User via `userId`
- Portal invitation email is sent

### 3. Client Portal Access
After activation:
- Client can log in to portal
- Can only see matters where they are the primary client (`Matter.clientId`)
- Can view documents, tasks, events
- Can upload documents
- Can sign documents electronically
- Can make payments

## Data Model

### Contact Model
```prisma
model Contact {
  id      String      @id
  type    ContactType @default(LEAD)  // LEAD → CLIENT
  userId  String?     @unique         // Link to User account
  
  clientMatters Matter[] @relation("MatterClient")  // Primary client
  partyMatters  MatterContact[]                     // Other party roles
}
```

### Matter Model
```prisma
model Matter {
  id       String @id
  clientId String  // Primary client (has portal access)
  
  client  Contact       @relation("MatterClient")
  parties MatterContact[]  // All parties including opposing
}
```

### MatterContact Model
```prisma
model MatterContact {
  matterId  String
  contactId String
  role      PartyRole  // PLAINTIFF, DEFENDANT, WITNESS, OPPOSING_COUNSEL
}
```

## Key Concepts

### Primary Client vs. Parties

1. **Primary Client** (`Matter.clientId`)
   - Your paying client
   - Gets portal access
   - Can see all matter information
   - Receives notifications

2. **Other Parties** (`MatterContact`)
   - Plaintiff/Defendant (in litigation)
   - Witnesses
   - Opposing counsel
   - No portal access (unless also a client)

### Example Scenario

**Divorce Case:**
- Primary Client: John Doe (your client) → Has portal access
- MatterContact: Jane Doe (opposing party, DEFENDANT) → No portal access
- MatterContact: Dr. Smith (witness, WITNESS) → No portal access
- MatterContact: Attorney Brown (OPPOSING_COUNSEL) → No portal access

## API Endpoints

### POST `/api/contacts/convert-to-client`

Convert a LEAD to CLIENT and send portal invitation.

**Request:**
```json
{
  "contactId": "contact_123",
  "matterId": "matter_456",
  "sendInvitation": true
}
```

**Response:**
```json
{
  "success": true,
  "contact": { /* Contact object */ },
  "user": {
    "id": "user_789",
    "email": "client@example.com",
    "role": "CLIENT"
  },
  "invitationSent": true
}
```

### PUT `/api/contacts/convert-to-client`

Resend portal invitation to an existing client.

**Request:**
```json
{
  "contactId": "contact_123"
}
```

## Usage

### 1. In Matter Creation Flow

```typescript
// When creating a new matter
const matter = await prisma.matter.create({
  data: {
    title: "Divorce Case",
    type: "FAMILY",
    clientId: contactId,  // Your client
    ownerId: lawyerId
  }
});

// Automatically convert to client and send invitation
const result = await convertContactToClient({
  contactId,
  matterId: matter.id,
  invitedById: lawyerId,
  sendInvitation: true
});
```

### 2. Manual Conversion (UI Button)

```typescript
import { ConvertToClientButton } from "@/components/contact/ConvertToClientButton";

<ConvertToClientButton
  contactId={contact.id}
  matterId={matter.id}
  contactName={`${contact.firstName} ${contact.lastName}`}
  onSuccess={() => {
    // Refresh or redirect
  }}
/>
```

### 3. Check Portal Access

```typescript
import { hasPortalAccess, canAccessMatter } from "@/lib/contact-to-client";

// Check if contact has portal access
const hasAccess = await hasPortalAccess(contactId);

// Check if user can access specific matter
const canAccess = await canAccessMatter(userId, matterId);
```

### 4. Get Client Matters

```typescript
import { getClientMatters } from "@/lib/contact-to-client";

// Get all matters for a client user
const matters = await getClientMatters(userId);
```

## Portal Authorization

### Middleware Check

```typescript
// middleware.ts or portal route
import { canAccessMatter } from "@/lib/contact-to-client";

const session = await getServerSession();
if (session.user.role === "CLIENT") {
  const canAccess = await canAccessMatter(session.user.id, matterId);
  if (!canAccess) {
    return redirect("/portal/unauthorized");
  }
}
```

### Query Filter

```typescript
// Only show matters where user is the primary client
const contact = await prisma.contact.findUnique({
  where: { userId: session.user.id }
});

const matters = await prisma.matter.findMany({
  where: {
    clientId: contact.id  // Only primary client matters
  }
});
```

## Email Templates

### Invitation Email

Sent when contact is converted to client:

**Subject:** Client Portal Access - Legal CRM

**Content:**
- Welcome message
- Matter title
- Activation link (expires in 7 days)
- List of portal features
- Contact information

### Reminder Email

Sent when resending invitation:

**Subject:** Client Portal Access - Reminder

**Content:**
- Reminder to activate
- New activation link
- Expiration notice

## Security Considerations

1. **Portal Access Control**
   - Clients can only see their own matters (`Matter.clientId`)
   - Cannot see matters where they are listed as opposing party
   - Cannot see other clients' information

2. **Invitation Tokens**
   - Cryptographically secure random tokens
   - Expire after 7 days
   - One-time use only

3. **Password Requirements**
   - Enforced during activation
   - Minimum length, complexity rules
   - Hashed with bcrypt

4. **Session Management**
   - Separate portal session from lawyer/admin
   - Limited permissions (CLIENT role)
   - Can be suspended by admin

## Migration Path

### For Existing Contacts

If you have existing contacts that need portal access:

```typescript
// Batch conversion script
const leadsWithMatters = await prisma.contact.findMany({
  where: {
    type: "LEAD",
    clientMatters: {
      some: {}  // Has at least one matter
    }
  },
  include: {
    clientMatters: true
  }
});

for (const contact of leadsWithMatters) {
  const firstMatter = contact.clientMatters[0];
  await convertContactToClient({
    contactId: contact.id,
    matterId: firstMatter.id,
    invitedById: adminId,
    sendInvitation: true
  });
}
```

## Testing Checklist

- [ ] Convert LEAD to CLIENT
- [ ] Verify User account created with CLIENT role
- [ ] Verify invitation email sent
- [ ] Activate account via invitation link
- [ ] Log in to portal
- [ ] Verify only own matters visible
- [ ] Try to access another client's matter (should fail)
- [ ] Resend invitation
- [ ] Convert contact that already has User account
- [ ] Convert contact with existing email (link accounts)

## Troubleshooting

### Issue: Contact has no email
**Solution:** Add email to contact before converting

### Issue: User with email already exists
**Solution:** System automatically links the accounts

### Issue: Invitation not received
**Solution:** Use "Resend Invitation" button

### Issue: Client sees wrong matters
**Solution:** Check `Matter.clientId` is set correctly

### Issue: Portal activation fails
**Solution:** Check token hasn't expired (7 days)

## Future Enhancements

1. **Multiple Matter Access**
   - Allow clients to see matters where they are party (optional)
   - Configurable per matter

2. **Guest Portal Access**
   - Temporary access for specific documents
   - No full account required

3. **Batch Invitations**
   - Convert multiple contacts at once
   - Bulk email sending

4. **Custom Invitation Templates**
   - Per-firm branding
   - Custom messaging

5. **Portal Activity Tracking**
   - Last login time
   - Document views
   - Engagement metrics
