# Master Folder Flag Implementation

## Overview
Simplified master folder detection from complex relationship-based logic to a simple boolean flag in the database schema.

## What Changed

### 1. Database Schema (`prisma/schema.prisma`)
Added `isMasterFolder` boolean field to `DocumentFolder` model:
```prisma
model DocumentFolder {
  // ... existing fields
  
  /// True for auto-created matter/contact main folders that cannot be renamed or deleted
  isMasterFolder Boolean @default(false)
  
  @@index([isMasterFolder])
  // ... other indices
}
```

**Migration:** `20251206232424_add_is_master_folder`
- Adds column with NOT NULL DEFAULT false
- Creates index on isMasterFolder for efficient queries

### 2. Folder Auto-Creation
Updated both matter and contact folder creation to set the flag:

**Matter Folder** (`app/api/matters/route.ts` line 107):
```typescript
// Create matter-specific folder under "Matters" (during matter creation)
await tx.documentFolder.create({
  data: {
    name: matter.title,
    matterId: matter.id,
    parentFolderId: mattersRootFolder.id,
    createdById: session!.user!.id,
    accessScope: "PUBLIC",
    color: "green",
    isMasterFolder: true, // NEW: Mark as master folder
  },
});
```

**Matter Folder Fallback** (`app/api/documents/route.ts` line 186):
```typescript
// Fallback: If matter folder doesn't exist during document upload, create it
matterFolder = await prisma.documentFolder.create({
  data: {
    name: matter.title,
    matterId: payload.matterId,
    parentFolderId: mattersRootFolder.id,
    createdById: user.id,
    accessScope: "PUBLIC",
    color: "blue",
    isMasterFolder: true, // NEW: Mark as master folder
  },
});
```

**Contact Folder** (`app/api/documents/route.ts` line 246):
```typescript
// Contact folders are created during first document upload
contactFolder = await prisma.documentFolder.create({
  data: {
    name: contactName,
    contactId: payload.contactId,
    parentFolderId: contactsRootFolder.id,
    createdById: user.id,
    accessScope: "PUBLIC",
    color: "green",
    isMasterFolder: true, // NEW: Mark as master folder
  },
});
```

### 3. API Protection Logic
**Before (Complex):**
```typescript
async function isMasterFolder(folderId: string): Promise<boolean> {
  const folder = await prisma.documentFolder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: {
      parentFolderId: true,
      matterId: true,
      contactId: true,
      parentFolder: {
        select: {
          parentFolderId: true,
        },
      },
    },
  });

  if (!folder) return false;
  if (!folder.parentFolderId) return false;
  if (!folder.matterId && !folder.contactId) return false;
  if (folder.parentFolder?.parentFolderId !== null) return false;

  return true;
}
```

**After (Simple):**
```typescript
// Just check the field
if (folder.isMasterFolder) {
  return NextResponse.json(
    { error: "Master folders cannot be renamed/deleted..." },
    { status: 403 }
  );
}
```

Updated in `app/api/folders/[id]/route.ts`:
- **PATCH endpoint** (lines 148-172): Prevents rename, access scope change, access metadata change
- **DELETE endpoint** (lines 260-266): Prevents deletion
- Removed async `isMasterFolder()` helper function entirely
- Added `isMasterFolder: true` to both PATCH and DELETE folder queries

### 4. Frontend Components

**EditFolderDialog** (`components/documents/EditFolderDialog.tsx`):

Before:
```typescript
const isMasterFolder = !!(
  folderData?.parentFolderId && 
  (folderData?.matterId || folderData?.contactId) &&
  folderData?.parentFolder?.parentFolderId === null
);
```

After:
```typescript
const isMasterFolder = folderData?.isMasterFolder ?? false;
```

**FolderCard** (`components/documents/FolderCard.tsx`):

Before:
```typescript
const isMasterFolder = !!(
  folder.parentFolderId && 
  (folder.matterId || folder.contactId) &&
  folder.parentFolder?.parentFolderId === null
);
```

After:
```typescript
const isMasterFolder = folder.isMasterFolder ?? false;
```

Both components updated their TypeScript interfaces to include `isMasterFolder?: boolean;`.

### 5. Migration Script
Created `scripts/set-master-folder-flags.ts` to update existing master folders:
- Identifies folders with `matterId` or `contactId` whose parent has no parent (system root children)
- Supports `--dry-run` mode
- Updated **6 existing master folders** in the database

## Benefits

### Performance
- **Before:** Required async database query with join to check parent folder
- **After:** Simple boolean field check (no query needed if folder already loaded)
- Indexed for efficient filtering

### Code Simplicity
- **Before:** Complex multi-condition logic duplicated across API and UI
- **After:** Single boolean check
- Easier to understand and maintain

### Reliability
- **Before:** Relationship-based detection could fail if data inconsistent
- **After:** Explicit flag set at creation time
- Single source of truth

## Migration Path

1. ✅ Added schema field
2. ✅ Created migration: `npx prisma migrate dev --name add_is_master_folder`
3. ✅ Regenerated Prisma client
4. ✅ Updated matter folder creation
5. ✅ Updated contact folder creation
6. ✅ Updated existing folders with script
7. ✅ Simplified API protection logic
8. ✅ Simplified frontend components

## Testing Checklist

- [ ] Create new matter → verify folder has `isMasterFolder: true`
- [ ] Create new contact → verify folder has `isMasterFolder: true`
- [ ] Try to rename master folder via UI → should show error alert
- [ ] Try to delete master folder via UI → should show error alert
- [ ] Try to rename master folder via API → should return 403
- [ ] Try to delete master folder via API → should return 403
- [ ] Try to change access scope on master folder → should return 403
- [ ] Create subfolder under master folder → should have `isMasterFolder: false`
- [ ] Verify subfolder can be renamed and deleted normally

## Files Changed

### Schema
- `prisma/schema.prisma` - Added isMasterFolder field and index

### API
- `app/api/matters/route.ts` - Set flag during matter folder creation (line 107)
- `app/api/documents/route.ts` - Set flag during folder auto-creation fallback
- `app/api/folders/[id]/route.ts` - Simplified protection logic, removed async helper

### Components
- `components/documents/EditFolderDialog.tsx` - Simplified detection logic
- `components/documents/FolderCard.tsx` - Simplified detection logic

### Scripts
- `scripts/set-master-folder-flags.ts` - Migration script for existing data

## Backwards Compatibility

- ✅ Default value `false` means existing folders work correctly
- ✅ Migration script updates existing master folders
- ✅ API responses automatically include new field (Prisma includes all scalar fields)
- ✅ Frontend components safely check with `?? false` fallback

## Future Enhancements

1. **Validation:** Add check to prevent manual setting of `isMasterFolder: true` outside of auto-creation
2. **Audit:** Log when master folder flag is set
3. **UI Indicator:** Show badge or icon on master folders in folder tree
4. **Bulk Operations:** Exclude master folders from bulk delete operations
