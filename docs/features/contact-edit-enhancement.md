# Contact Management - Edit and Create Enhancement

## Summary
Implemented comprehensive contact edit functionality and enhanced the contact creation form with all available contact properties.

## Changes Made

### 1. New Component: EditContactDialog
**File**: `components/contact/edit-contact-dialog.tsx`

A comprehensive dialog for editing existing contacts with all fields:

**Features**:
- Pre-populated form fields with current contact data
- Organized in 3 sections: Basic Info, Address Info, Additional Info
- Role-based access control (ADMIN/LAWYER only)
- Automatic page refresh after successful update
- Proper error handling and validation

**Fields Included**:
- Basic Information: firstName, lastName, email, phone, company, type, status, source
- Address Information: address, city, state, zip, country
- Additional Information: preferredLanguage, tags, notes

### 2. Enhanced Component: NewContactDialog
**File**: `components/contact/new-contact-dialog.tsx`

**Added Missing Fields**:
- ✅ phone (was missing)
- ✅ company (was missing)
- ✅ source (was missing)
- ✅ address (was missing)
- ✅ city (was missing)
- ✅ state (was missing)
- ✅ zip (was missing)
- ✅ country (was missing)
- ✅ preferredLanguage (was missing)
- ✅ notes (was missing)

**UI Improvements**:
- Changed dialog width from `max-w-lg` to `max-w-2xl` for better field display
- Added scrollable container with `max-h-[90vh]` and `overflow-y-auto`
- Organized fields into 3 logical sections with headers
- Improved field grouping and layout

### 3. Updated Component: ClientInfoCard
**File**: `components/matters/ClientInfoCard.tsx`

**New Prop**: `onEditClick?: () => void`

**Behavior**:
- When `onEditClick` is provided: Edit button becomes a button that triggers the callback
- When `onEditClick` is NOT provided: Edit button remains a link to contact detail page
- This allows context-specific edit behavior (dialog vs. navigation)

### 4. Updated Component: ContactInfoSection
**File**: `app/(dashboard)/contacts/[id]/_components/contact-info-section.tsx`

**Changes**:
- Added `EditContactDialog` integration
- State management for dialog open/close
- Pass `onEditClick` callback to `ClientInfoCard` to open edit dialog
- Auto-refresh page after successful contact update

**Flow**:
1. User clicks "Edit Contact" button in ClientInfoCard
2. Edit dialog opens with pre-populated data
3. User makes changes and submits
4. API updates contact
5. Dialog closes and page refreshes automatically

### 5. Updated Component: MatterDetailClient
**File**: `components/matters/MatterDetailClient.tsx`

**Changes**:
- Added `EditContactDialog` integration
- Added `handleEditContactClick` function to fetch full contact data
- State management for dialog and contact data
- Pass `onEditClick` callback to `ClientInfoCard` to trigger data fetch and open dialog
- Auto-refresh page after successful contact update

**Why Fetch Contact Data?**:
The `matter.client` object only includes basic fields (id, firstName, lastName, email, phone). To edit all contact properties, we need to fetch the full contact record when the edit button is clicked.

**Flow**:
1. User clicks "Edit Contact" button in ClientInfoCard on matter detail page
2. `handleEditContactClick` fetches full contact data from `/api/contacts/[id]`
3. Contact data is stored in state
4. Edit dialog opens with pre-populated data
5. User makes changes and submits
6. API updates contact
7. Dialog closes and page refreshes automatically

## Form Validation

Both forms validate:
- **Required fields**: firstName, lastName (marked with *)
- **Email format**: Uses HTML5 email type validation
- **Optional fields**: All other fields are optional and properly handled

## Error Handling

Both dialogs handle:
- ✅ 422 Validation errors
- ✅ 401/403 Authorization errors
- ✅ Network errors
- ✅ Display user-friendly Turkish error messages

## Role-Based Access Control

- **Edit Contact**: Only ADMIN and LAWYER roles can edit
- **Create Contact**: All authenticated users can create (existing behavior)
- Permission check is done at component level (ContactInfoSection)

## API Integration

### Create Contact
- **Endpoint**: `POST /api/contacts`
- **All fields**: Now sends all contact properties

### Update Contact
- **Endpoint**: `PATCH /api/contacts/[id]`
- **All fields**: Sends all contact properties for update

## Testing Checklist

✅ **New Contact Form**:
- [ ] All fields display correctly
- [ ] Form is scrollable for long content
- [ ] Required fields (firstName, lastName) validation works
- [ ] Email validation works
- [ ] Tags are split by comma
- [ ] Empty optional fields are properly handled (sent as undefined)
- [ ] Success creates contact and refreshes list
- [ ] Error messages display correctly

✅ **Edit Contact Dialog**:
- [ ] Opens when clicking Edit button on contact detail page
- [ ] All fields pre-populate with current values
- [ ] Tags array is converted to comma-separated string
- [ ] Form is scrollable
- [ ] Required fields validation works
- [ ] Success updates contact and refreshes page
- [ ] Error messages display correctly
- [ ] Only ADMIN/LAWYER can see and use edit button

✅ **Permission Checks**:
- [ ] ADMIN can edit contacts
- [ ] LAWYER can edit contacts
- [ ] PARALEGAL cannot edit contacts (button hidden)
- [ ] CLIENT cannot edit contacts (button hidden)

## UI/UX Improvements

1. **Consistent Dialog Sizes**: Both dialogs use `max-w-2xl` for consistency
2. **Scrollable Content**: Long forms are scrollable with `max-h-[90vh]`
3. **Section Headers**: Fields grouped logically with headers
4. **Better Field Organization**: 
   - 2-column grid for related fields (firstName/lastName, city/state, etc.)
   - Full-width for single fields (address, notes)
   - 3-column grid for type/status/source
5. **Textarea for Notes**: Uses proper textarea with 4 rows for better UX
6. **Test IDs**: All form fields have data-testid attributes for E2E testing

## Next Steps (Optional Enhancements)

### High Priority
1. **E2E Tests**: Add Playwright tests for:
   - Creating contact with all fields
   - Editing contact
   - Permission checks for edit button

### Medium Priority
2. **Field Enhancements**:
   - Phone number formatting/validation
   - Country dropdown instead of text input
   - Rich text editor for notes (if needed)
   - Tag picker component (instead of comma-separated)

3. **Validation Improvements**:
   - ZIP code format validation by country
   - State/province dropdown based on country
   - Email uniqueness check (if required)

### Low Priority
4. **UI Polish**:
   - Loading skeleton while fetching contact data for edit
   - Confirmation dialog before closing with unsaved changes
   - Success toast notification after save
   - Optimistic UI updates

## Files Changed

```
✨ NEW:
- components/contact/edit-contact-dialog.tsx (467 lines)

📝 UPDATED:
- components/contact/new-contact-dialog.tsx (expanded form)
- components/matters/ClientInfoCard.tsx (added onEditClick prop)
- components/matters/MatterDetailClient.tsx (integrated edit dialog with data fetching)
- app/(dashboard)/contacts/[id]/_components/contact-info-section.tsx (integrated edit dialog)
```

## Database Schema Alignment

All form fields now match the Prisma Contact model:
```prisma
model Contact {
  // ✅ Basic fields
  firstName         String
  lastName          String
  email             String?
  phone             String?
  company           String?
  type              ContactType
  status            ContactStatus
  source            String?
  tags              String[]
  
  // ✅ Address fields
  address           String?
  city              String?
  state             String?
  zip               String?
  country           String?
  
  // ✅ Additional fields
  notes             String?
  preferredLanguage String?
  
  // System fields (not in forms)
  ownerId           String?
  userId            String?
  createdAt         DateTime
  updatedAt         DateTime
  deletedAt         DateTime?
  deletedBy         String?
}
```

## Usage Example

### In Contact Detail Page (Current Implementation)
```tsx
<ContactInfoSection
  contact={contact}
  currentUserRole={currentUserRole}
  onRefresh={() => router.refresh()}
/>
```

### In Matter Detail Page (Updated Implementation)
```tsx
// Fetch full contact data before opening dialog
const handleEditContactClick = useCallback(async () => {
  const response = await fetch(`/api/contacts/${matter.client.id}`);
  if (response.ok) {
    const contact = await response.json();
    setEditContactData(contact);
    setEditContactDialogOpen(true);
  }
}, [matter.client.id]);

<ClientInfoCard
  contactId={contact.id}
  clientName={fullName}
  email={contact.email}
  phone={contact.phone}
  currentUserRole={currentUserRole}
  onEditClick={canEdit ? handleEditContactClick : undefined}
/>

{editContactData && (
  <EditContactDialog
    contactId={contact.id}
    initialData={editContactData}
    open={editContactDialogOpen}
    onClose={() => {
      setEditContactDialogOpen(false);
      setEditContactData(null);
    }}
    onUpdated={() => router.refresh()}
  />
)}
```

### Anywhere Else (If Needed)
```tsx
const [editOpen, setEditOpen] = useState(false);

<ClientInfoCard
  contactId={contact.id}
  clientName={fullName}
  email={contact.email}
  phone={contact.phone}
  currentUserRole={currentUserRole}
  onEditClick={() => setEditOpen(true)}
/>

<EditContactDialog
  contactId={contact.id}
  initialData={contact}
  open={editOpen}
  onClose={() => setEditOpen(false)}
  onUpdated={() => router.refresh()}
/>
```

## Notes

- All text is in Turkish (matching existing UI)
- Form styling matches the existing design system
- Both dialogs use the same validation patterns and error handling
- Tags are stored as string array in DB but handled as comma-separated string in UI
- Empty optional fields are converted to `undefined` before API submission (Prisma handles this correctly)
