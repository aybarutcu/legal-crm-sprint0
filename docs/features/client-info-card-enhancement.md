# Client Info Card Enhancement

**Date**: October 18, 2025  
**Status**: ✅ Complete  
**Related**: Phase 2 Matter Detail Header Redesign

## Overview

Enhanced the `ClientInfoCard` component to display comprehensive client information from the Prisma Contact model, replacing the hover-based `ContactDetailsHoverCard` with an expandable design that's mobile-friendly and shows all available contact details.

## Changes Made

### 1. Enhanced Data Model

**Added Contact Fields** (from Prisma schema):
```typescript
type ContactDetails = {
  // Existing fields
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  type?: string;
  status?: string;
  tags?: string[];
  owner?: ContactOwner;
  user?: ContactUser;
  
  // NEW fields from Prisma schema
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
  source?: string | null;
}
```

### 2. New Icons Added

```typescript
import { 
  ChevronDown, ChevronUp, Mail, User as UserIcon, 
  Tag, Building2, ExternalLink, 
  MapPin,      // For address
  Phone,       // For phone number
  Globe,       // For preferred language
  Briefcase    // For company
} from "lucide-react";
```

### 3. Enhanced UI Components

#### Collapsed View (Unchanged)
- Client avatar with initials
- Client name and email
- Quick email action button
- Expand/collapse chevron

#### Expanded View - New Sections

**Contact Details Grid** (2 columns, responsive):
- **Email**: Displays with Mail icon (truncated)
- **Phone**: Clickable `tel:` link with Phone icon (conditional)
- **Company**: Business name with Briefcase icon (conditional)
- **Type**: Contact type (CLIENT, LEAD, etc.)
- **Status**: Contact status (ACTIVE, NEW, etc.)
- **Preferred Language**: Language preference with Globe icon (conditional)
- **Source**: How the client was acquired (conditional)

**Address Section** (Full width, conditional):
- Only shows if any address field is present
- Displays with MapPin icon
- Multi-line format:
  ```
  Street Address
  City, State ZIP
  Country
  ```
- Smart formatting: Joins city/state/zip with commas

**Portal Status Section** (Unchanged):
- Shows invite/activation status
- InviteClientButton for ADMIN/LAWYER roles

**Tags Section** (Unchanged):
- Blue badges for all contact tags

**Owner Section** (Unchanged):
- Shows assigned owner name/email

**View Full Profile Link** (Unchanged):
- Button linking to `/dashboard/contacts/[id]`

## UI/UX Improvements

### Conditional Rendering
- Fields only show if data exists (no empty "—" placeholders for optional fields)
- Address section only appears if any address field is populated
- Phone becomes clickable link for mobile dialing

### Truncation & Overflow
- Email addresses truncated with `truncate` class
- Company names truncated to prevent overflow
- Address section allows multi-line content

### Visual Hierarchy
```
Portal Status (ADMIN/LAWYER only)
├─ Status badge + date
└─ Invite button

Contact Details Grid (2 columns)
├─ Email (always shown if exists)
├─ Phone (conditional, clickable)
├─ Company (conditional)
├─ Type (always shown)
├─ Status (always shown)
├─ Language (conditional)
└─ Source (conditional)

Address (full width, conditional)
├─ Street address
├─ City, State ZIP
└─ Country

Tags (conditional)
Owner (conditional)
View Full Profile Button
```

## Technical Details

### API Data Source
All fields are returned by the existing `/api/contacts/[id]` endpoint:
```typescript
const contact = await prisma.contact.findUnique({
  where: { id: params!.id },
  include: {
    owner: { select: { id: true, name: true, email: true } },
    user: { select: { id: true, email: true, role: true, invitedAt: true, activatedAt: true, isActive: true } }
  }
});
```

### Performance
- **Lazy Loading**: Contact details fetched only when card expanded (first time)
- **Caching**: Data cached in component state after first load
- **Loading States**: Spinner shown during fetch
- **Error Handling**: User-friendly error messages if API fails

### Accessibility
- Clickable phone link: `href="tel:${phone}"`
- Clickable email link: `href="mailto:${email}"`
- Proper semantic HTML structure
- Icon + label pattern for screen readers

## Before vs After

### Before (ContactDetailsHoverCard)
- ❌ Hover-based (poor mobile UX)
- ❌ Limited information shown
- ❌ Overflow issues
- ❌ No address details
- ❌ No company info
- ❌ No language/source info

### After (ClientInfoCard Expanded)
- ✅ Click/tap to expand (mobile-friendly)
- ✅ Comprehensive client details
- ✅ Proper overflow handling
- ✅ Full address display
- ✅ Company information
- ✅ Language & source details
- ✅ Conditional rendering (clean UI)
- ✅ Clickable phone/email links

## Example Data Display

**Scenario**: Client with full profile
```
┌─────────────────────────────────────────────────┐
│ [AB] Alice Brown                                │
│      alice@example.com                    [📧]  │
│                                            [v]   │
├─────────────────────────────────────────────────┤
│ Portal Status: Active • Oct 15, 2025           │
│                              [Send Invite]      │
├─────────────────────────────────────────────────┤
│ Email                    Phone                  │
│ alice@example.com        +1-555-0123           │
│                                                 │
│ Company                  Type                   │
│ Brown Enterprises        CLIENT                 │
│                                                 │
│ Status                   Language               │
│ ACTIVE                   English                │
│                                                 │
│ Source                                          │
│ Referral                                        │
├─────────────────────────────────────────────────┤
│ 📍 Address                                      │
│    123 Main Street                              │
│    New York, NY 10001                           │
│    United States                                │
├─────────────────────────────────────────────────┤
│ Tags: #vip #corporate                           │
│ Owner: John Doe                                 │
│ [View Full Profile →]                           │
└─────────────────────────────────────────────────┘
```

**Scenario**: Client with minimal data
```
┌─────────────────────────────────────────────────┐
│ [JD] John Doe                                   │
│      john@example.com                     [📧]  │
│                                            [v]   │
├─────────────────────────────────────────────────┤
│ Portal Status: Invite sent • Oct 10, 2025      │
├─────────────────────────────────────────────────┤
│ Email                    Type                   │
│ john@example.com         CLIENT                 │
│                                                 │
│ Status                                          │
│ NEW                                             │
├─────────────────────────────────────────────────┤
│ [View Full Profile →]                           │
└─────────────────────────────────────────────────┘
```

## Integration

### Usage in MatterDetailClient
```tsx
<ClientInfoCard
  contactId={matter.client.id}
  clientName={clientName}
  email={matter.client.email}
  currentUserRole={currentUserRole}
/>
```

### Replaced Component
- **Old**: `<ContactDetailsHoverCard />` (hover-based popup)
- **New**: `<ClientInfoCard />` (expandable card)

## Testing Checklist

- [x] Component compiles without errors
- [x] All TypeScript types correctly defined
- [x] Conditional rendering works (phone, company, address, etc.)
- [ ] Phone link opens dialer on mobile
- [ ] Email link opens mail client
- [ ] Expand/collapse animation smooth
- [ ] Loading state displays correctly
- [ ] Error state shows user-friendly message
- [ ] Address formatting handles missing fields gracefully
- [ ] Works with minimal data (only name + email)
- [ ] Works with full data (all fields populated)
- [ ] Responsive on mobile (2-col grid stacks properly)
- [ ] Accessible (keyboard navigation, screen readers)

## Future Enhancements

### Potential Additions
1. **Direct Actions**: Call button with `tel:` link (when phone exists)
2. **Map Integration**: "View on Map" button for addresses
3. **Contact Notes**: Show recent notes in expanded view
4. **Matter History**: List of all matters associated with client
5. **Quick Edit**: Inline editing of contact fields
6. **Social Links**: LinkedIn, Twitter, etc. (add to schema)
7. **Profile Picture**: Upload/display actual photo instead of initials

### Schema Extensions
```prisma
model Contact {
  // Existing fields...
  
  // Social media
  linkedinUrl   String?
  twitterHandle String?
  
  // Communication preferences
  preferredContact String?  // EMAIL, PHONE, SMS
  timezone         String?
  
  // Profile
  profileImageUrl  String?
  bio              String?
}
```

## Files Modified

### Created
- `components/matters/ClientInfoCard.tsx` (329 lines)

### Modified
- `components/matters/MatterDetailClient.tsx`
  - Removed `ContactDetailsHoverCard` import
  - Added `ClientInfoCard` import
  - Replaced client section markup

## Related Documentation

- [Matter Detail Header Redesign](./matter-detail-header-redesign.md)
- [Phase 1 Implementation](./matter-detail-header-phase1-implementation.md)
- [Prisma Schema](../../prisma/schema.prisma) - Contact model definition
- [Contacts API](../../app/api/contacts/[id]/route.ts) - Data source

## Conclusion

The enhanced `ClientInfoCard` provides a comprehensive, mobile-friendly view of all client information available in the system. The expandable design keeps the UI clean when collapsed while providing full details on demand. Conditional rendering ensures only relevant fields are shown, and clickable phone/email links improve usability.

**Result**: Richer client context, better UX, cleaner design. ✅
