# Notes System Architecture

## Overview
Implementing a comprehensive notes/activity system where notes are first-class entities with proper audit trail, not just text fields.

## Current State

### Database Schema (Already Implemented)
```prisma
model Note {
  id         String     @id @default(cuid())
  parentType ParentType // MATTER | CONTACT | DOCUMENT
  parentId   String     // ID of parent entity
  authorId   String
  body       String     // The note content
  createdAt  DateTime   @default(now())
  
  author User @relation(fields: [authorId], references: [id])
}

enum ParentType {
  MATTER
  CONTACT
  DOCUMENT
}
```

### Issues to Address

1. **Redundant Field**: `Contact.notes` (String) is redundant - should be removed
2. **Missing UI**: No UI component for viewing/adding Notes
3. **Missing Integration**: Notes not displayed in Matter or Contact detail pages
4. **Missing API**: Need CRUD endpoints for Notes

## Proposed Architecture

### 1. Database Changes

#### Remove Redundant Field
```sql
-- Migration needed
ALTER TABLE "Contact" DROP COLUMN "notes";
```

**Affected Code**:
- `prisma/schema.prisma` - Remove `notes String?` from Contact model
- `lib/validation/contact.ts` - Remove notes from validation schemas
- `components/contact/edit-contact-dialog.tsx` - Remove notes field
- `components/contact/new-contact-dialog.tsx` - Remove notes field
- `app/api/contacts/[id]/route.ts` - Remove notes from response (already returning Note array)

### 2. API Endpoints

#### Notes API (`app/api/notes/`)

**GET /api/notes?parentType=CONTACT&parentId={id}**
- Fetch all notes for a parent entity
- Query params: parentType, parentId
- Optional: pagination, sorting

**POST /api/notes**
```json
{
  "parentType": "CONTACT",
  "parentId": "contact_id",
  "body": "Note content"
}
```

**PATCH /api/notes/[id]**
- Update note body
- Add `updatedAt` field to schema

**DELETE /api/notes/[id]**
- Soft delete with `deletedAt` field
- Or hard delete (decide based on requirements)

### 3. UI Components

#### NotesSection Component
**Location**: `components/notes/NotesSection.tsx`

**Features**:
- Display list of notes with author, timestamp
- Add new note (textarea + submit)
- Edit existing notes (if author = current user)
- Delete notes (if author = current user or admin)
- Real-time relative timestamps ("2 hours ago")

**Props**:
```typescript
interface NotesSectionProps {
  parentType: "MATTER" | "CONTACT" | "DOCUMENT";
  parentId: string;
  currentUserId: string;
  currentUserRole: Role;
}
```

**Layout**:
```
┌─────────────────────────────────────┐
│ Notes                         [+ Add]│
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ John Doe • 2 hours ago          │ │
│ │ Discussed settlement options... │ │
│ │                      [Edit] [×] │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Jane Smith • Yesterday          │ │
│ │ Client called about hearing...  │ │
│ │                      [Edit] [×] │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### NoteItem Component
**Location**: `components/notes/NoteItem.tsx`

Individual note card with:
- Author avatar/name
- Timestamp (relative + absolute on hover)
- Note content
- Edit/Delete actions (conditional)

#### AddNoteDialog Component
**Location**: `components/notes/AddNoteDialog.tsx`

Modal for adding notes:
- Textarea with character limit
- Preview mode
- Submit/Cancel buttons

### 4. Integration Points

#### A. Contact Detail Page
**File**: `app/(dashboard)/contacts/[id]/_components/contact-info-section.tsx`

Add NotesSection:
```tsx
<div className="space-y-6">
  <ClientInfoCard {...props} />
  
  {/* Notes Section */}
  <NotesSection
    parentType="CONTACT"
    parentId={contact.id}
    currentUserId={session.user.id}
    currentUserRole={session.user.role}
  />
  
  {/* Related Matters remains */}
</div>
```

#### B. Matter Detail Page
**File**: `components/matters/MatterDetailClient.tsx`

Add NotesSection in Overview tab:
```tsx
<div className="space-y-6">
  {/* Existing sections */}
  <MatterPartiesSection {...} />
  <MatterDocumentsSection {...} />
  
  {/* Client Notes - Show notes from the client contact */}
  {matter.client && (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold mb-4">Client Notes</h3>
      <NotesSection
        parentType="CONTACT"
        parentId={matter.client.id}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        readOnly={true}  // Or allow editing
      />
    </div>
  )}
  
  {/* Matter Notes */}
  <NotesSection
    parentType="MATTER"
    parentId={matter.id}
    currentUserId={currentUserId}
    currentUserRole={currentUserRole}
  />
</div>
```

#### C. Document Detail Drawer
**File**: `components/documents/DocumentDetailDrawer.tsx`

Optional: Add notes for documents

### 5. Schema Enhancements (Optional)

Consider adding:

```prisma
model Note {
  id         String     @id @default(cuid())
  parentType ParentType
  parentId   String
  authorId   String
  body       String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt  // NEW: Track edits
  deletedAt  DateTime?              // NEW: Soft delete
  isPinned   Boolean    @default(false) // NEW: Pin important notes
  
  author User @relation(fields: [authorId], references: [id])
  
  @@index([parentType, parentId])
  @@index([authorId])
}
```

### 6. Business Rules

#### Permissions
- **View Notes**: All users can view notes on entities they have access to
- **Add Notes**: All users can add notes
- **Edit Notes**: Only author or ADMIN can edit
- **Delete Notes**: Only author or ADMIN can delete
- **Pin Notes**: Only ADMIN or LAWYER can pin

#### Visibility
- **Contact Notes**: Visible in contact detail page AND in matter detail pages where contact is client
- **Matter Notes**: Visible only in matter detail page
- **Document Notes**: Visible in document drawer/detail page

### 7. Migration Plan

#### Phase 1: Preparation (Don't break existing)
1. ✅ Notes model already exists
2. Create Notes API endpoints
3. Create Notes UI components
4. Add NotesSection to pages (initially empty state if no notes)

#### Phase 2: Data Migration
1. Create migration script to convert Contact.notes string to Note records:
```typescript
// scripts/migrate-contact-notes.ts
const contacts = await prisma.contact.findMany({
  where: { notes: { not: null } }
});

for (const contact of contacts) {
  if (contact.notes && contact.notes.trim()) {
    await prisma.note.create({
      data: {
        parentType: 'CONTACT',
        parentId: contact.id,
        authorId: contact.ownerId || 'system_user_id',
        body: contact.notes,
      }
    });
  }
}
```

2. Run migration
3. Verify data

#### Phase 3: Cleanup
1. Remove `notes` field from Contact model
2. Update validation schemas
3. Update forms (remove notes field)
4. Update API responses

### 8. UI/UX Considerations

#### Timeline/Activity View (Future Enhancement)
Combine notes with other activities:
```
┌─────────────────────────────────────┐
│ Activity                            │
├─────────────────────────────────────┤
│ 📝 John Doe added a note            │
│    "Discussed settlement..."         │
│    2 hours ago                      │
├─────────────────────────────────────┤
│ 📄 Jane Smith uploaded document     │
│    "Settlement Agreement Draft.pdf" │
│    Yesterday                        │
├─────────────────────────────────────┤
│ 👤 System updated matter status     │
│    DISCOVERY → SETTLEMENT           │
│    2 days ago                       │
└─────────────────────────────────────┘
```

#### Rich Text Support (Future)
- Markdown support
- @mentions
- #tags
- File attachments to notes

### 9. Implementation Steps (Recommended Order)

#### Step 1: API Layer (Backend First)
1. Create `app/api/notes/route.ts` (GET all, POST new)
2. Create `app/api/notes/[id]/route.ts` (GET one, PATCH, DELETE)
3. Add validation schema `lib/validation/note.ts`
4. Test with Postman/curl

#### Step 2: UI Components
1. Create `components/notes/NoteItem.tsx`
2. Create `components/notes/AddNoteForm.tsx`
3. Create `components/notes/NotesSection.tsx`
4. Test in isolation/Storybook if available

#### Step 3: Integration
1. Add to Contact detail page
2. Add to Matter detail page
3. Test data flow

#### Step 4: Migration
1. Create migration script
2. Test on staging/dev data
3. Run migration
4. Remove old fields

#### Step 5: Cleanup
1. Remove Contact.notes from schema
2. Remove from validation
3. Remove from forms
4. Update documentation

## Files to Create

```
app/api/notes/
  ├── route.ts              (GET all, POST)
  └── [id]/
      └── route.ts          (GET, PATCH, DELETE)

lib/validation/
  └── note.ts               (Zod schemas)

components/notes/
  ├── NoteItem.tsx          (Single note display)
  ├── AddNoteForm.tsx       (Add/Edit form)
  ├── NotesSection.tsx      (Main container)
  └── types.ts              (TypeScript types)

scripts/
  └── migrate-contact-notes.ts  (One-time migration)

tests/
  └── api/
      └── notes.test.ts     (API tests)
```

## Files to Modify

```
prisma/schema.prisma
  - Remove Contact.notes field (after migration)
  - Add Note indexes
  - Add Note.updatedAt, deletedAt (optional)

lib/validation/contact.ts
  - Remove notes from schemas

components/contact/edit-contact-dialog.tsx
  - Remove notes field

components/contact/new-contact-dialog.tsx
  - Remove notes field

app/(dashboard)/contacts/[id]/_components/contact-info-section.tsx
  - Add NotesSection component

components/matters/MatterDetailClient.tsx
  - Add NotesSection for matter notes
  - Add read-only NotesSection for client notes
```

## Benefits of This Architecture

✅ **Audit Trail**: Every note has author and timestamp
✅ **Flexible**: Can attach notes to any entity (matters, contacts, documents)
✅ **Searchable**: Can search notes across all entities
✅ **Activity History**: Notes become part of activity timeline
✅ **Scalable**: Easy to add features like mentions, attachments, etc.
✅ **Secure**: Proper permission checks at API level
✅ **No Data Loss**: Migration preserves existing notes

## Next Steps

1. **Review this architecture** - Confirm it meets requirements
2. **Start with API** - Build and test backend first
3. **Create UI components** - Build reusable note components
4. **Integrate step by step** - Add to one page at a time
5. **Migrate data** - After everything works, migrate old notes
6. **Clean up** - Remove redundant fields

## Questions to Consider

1. Should notes be editable after creation? (Suggest: Yes, with updatedAt tracking)
2. Should notes be deletable? (Suggest: Soft delete only, keep for audit)
3. Should notes support Markdown? (Suggest: Phase 2)
4. Should there be note templates? (Suggest: Phase 2)
5. Should notes be searchable? (Suggest: Yes, add to global search)
6. Should clients see notes? (Suggest: Add visibility field - INTERNAL | CLIENT)
