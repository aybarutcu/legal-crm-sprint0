# Document Versioning System V2

**Status**: ✅ Implemented  
**Date**: December 7, 2025  
**Version**: 2.0

---

## Overview

The document versioning system has been redesigned to use `displayName` as the primary identifier for versions instead of `filename`. This provides a more intuitive user experience where users can upload different files as versions of the same logical document.

---

## Key Changes from V1

### V1 (Old System)
- **Version Identifier**: `filename` + `matterId` + `contactId`
- **Limitation**: Required same filename for all versions
- **Use Case**: Limited to file replacements only

### V2 (New System)
- **Version Identifier**: `displayName` + `folderId` + `matterId` + `contactId`
- **Flexibility**: Different filenames can be versions of same document
- **Use Case**: Logical document versioning (e.g., "Employment Contract" can have v1.pdf, v2.docx, v3_final.pdf)

---

## Versioning Logic

### Version Identifiers

Two documents are considered versions of each other if they match:

1. **displayName** (required, primary identifier)
2. **folderId** (must be same folder or both null)
3. **matterId** (must match or both null)
4. **contactId** (must match or both null)

**Important**: `filename` is NOT used as a version identifier.

### Version Chain Structure

```typescript
// Version 1 (original)
{
  id: "abc123",
  filename: "contract_draft.pdf",
  displayName: "Employment Contract",
  version: 1,
  parentDocumentId: null,
  folderId: "folder123",
  matterId: "matter456"
}

// Version 2
{
  id: "def456",
  filename: "contract_final.docx",  // Different filename OK!
  displayName: "Employment Contract", // Same displayName
  version: 2,
  parentDocumentId: "abc123",       // Links to version 1
  folderId: "folder123",            // Same folder
  matterId: "matter456"             // Same matter
}
```

All versions link to the **first version** via `parentDocumentId`.

---

## API Changes

### 1. Upload Endpoint (`POST /api/uploads`)

**Request Body**:
```json
{
  "filename": "actual_file.pdf",
  "displayName": "My Document",  // NEW: Version identifier
  "mime": "application/pdf",
  "size": 123456,
  "folderId": "folder-id",       // Optional
  "matterId": "matter-id",       // Optional
  "contactId": "contact-id"      // Optional
}
```

**Version Calculation**:
```typescript
const where = {
  displayName: payload.displayName ?? payload.filename,
  folderId: payload.folderId ?? null,
  matterId: payload.matterId ?? null,
  contactId: payload.contactId ?? null,
  deletedAt: null
};
```

### 2. Document Create Endpoint (`POST /api/documents`)

**Request Body**:
```json
{
  "documentId": "uuid",
  "filename": "file.pdf",
  "displayName": "My Document",  // NEW: Required for versioning
  "mime": "application/pdf",
  "size": 123456,
  "storageKey": "documents/uuid/v2/file.pdf",
  "version": 2,
  "parentDocumentId": "parent-uuid",  // Links to v1
  "folderId": "folder-id",
  "matterId": "matter-id",
  "contactId": "contact-id",
  "tags": ["tag1", "tag2"],
  "accessScope": "PUBLIC",
  "accessMetadata": null
}
```

**Version Validation**:
```typescript
const where = {
  displayName: payload.displayName ?? payload.filename,
  folderId: targetFolderId,
  matterId: payload.matterId ?? null,
  contactId: payload.contactId ?? null,
  deletedAt: null
};

// Check if version number matches expected
const aggregate = await prisma.document.aggregate({ _max: { version: true }, where });
const expectedVersion = getNextDocumentVersion(aggregate._max.version);

if (payload.version !== expectedVersion) {
  return NextResponse.json({ error: "Version mismatch" }, { status: 409 });
}
```

---

## Schema Updates

### `lib/validation/document.ts`

```typescript
export const documentUploadSchema = z.object({
  filename: z.string().min(1),
  displayName: z.string().min(1).optional(),  // NEW
  mime: mimeSchema,
  size: z.number().int().positive(),
  matterId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  folderId: z.string().min(1).optional(),     // NEW
});

export const documentCreateSchema = z.object({
  documentId: z.string().min(1),
  filename: z.string().min(1),
  displayName: z.string().min(1).optional(),   // NEW
  mime: mimeSchema,
  size: z.number().int().positive(),
  storageKey: z.string().min(1),
  version: z.number().int().positive().optional(),
  parentDocumentId: z.string().min(1).optional(),
  matterId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  folderId: z.string().min(1).optional(),
  workflowStepId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  accessScope: z.enum(["PUBLIC", "ROLE_BASED", "USER_BASED", "PRIVATE"]).optional(),
  accessMetadata: z.record(z.unknown()).optional(),
});
```

---

## Frontend Changes

### EditDocumentDialog Component

**Version Upload Flow**:

1. User selects file in "Upload New Version" tab
2. System uses current `displayName` from form as version identifier
3. Calls `/api/uploads` with:
   - `filename`: New file's actual name
   - `displayName`: Current displayName (version identifier)
   - `folderId`, `matterId`, `contactId`: Same as original
4. Uploads file to S3
5. Creates document with `parentDocumentId` linking to original
6. Applies access control from form (USER_BASED grants if applicable)
7. Drawer switches to display new version

**Key Code**:
```typescript
const uploadUrlRes = await fetch("/api/uploads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    filename: uploadFile.name,          // New file name
    displayName: displayName || document.displayName || document.filename,  // Version ID
    contentType: uploadFile.type,
    size: uploadFile.size,
    mime: uploadFile.type,
    matterId: document.matterId,
    contactId: document.contactId,
    folderId: document.folderId,
  }),
});

const versionPayload = {
  documentId: documentId,
  filename: uploadFile.name,
  displayName: displayName || document.displayName || document.filename,
  mime: uploadFile.type,
  size: uploadFile.size,
  storageKey: storageKey,
  parentDocumentId: document.id,       // Link to original
  matterId: document.matterId,
  contactId: document.contactId,
  folderId: document.folderId,
  tags: tags,                          // From form
  accessScope: accessScope,            // From form
  accessMetadata: accessScope === "ROLE_BASED" ? { allowedRoles: selectedRoles } : null,
  version: uploadVersion,
};
```

---

## User Experience

### Creating a New Version

1. User opens document detail drawer
2. Clicks "Edit" button
3. Switches to "Upload New Version" tab
4. Sees info message: "This will create version X of the document. The original file will be preserved as version Y."
5. Selects file (can have different name/format)
6. Can optionally edit displayName, tags, or access control in "Details & Access" tab
7. Clicks "Save Changes"
8. New version created with incremented version number
9. Drawer automatically switches to show new version
10. Versions list shows all versions with version numbers

### Version Conflict Detection (Future Enhancement)

When uploading a completely new document (not via Edit dialog):

1. User uploads file
2. System checks for existing documents with same `displayName` in same folder
3. If match found, prompts: "A document named 'X' already exists. Create as new version?"
4. User chooses:
   - **New Version**: System creates version N+1 with `parentDocumentId` set
   - **New Document**: User must change displayName or choose different folder

---

## Migration Considerations

### Existing Documents

- Documents without `displayName` will use `filename` as fallback
- Existing version chains (based on filename) remain valid
- No data migration required
- System is backward compatible

### Master Folders

- Master folders (`/Matters/{title}`, `/Contacts/{name}`) auto-created
- Documents uploaded to master folder get auto-populated `matterId`/`contactId`
- Folder name changes sync when matter/contact names change

---

## Testing Scenarios

### Scenario 1: Basic Versioning
1. Upload document "Contract.pdf" with displayName "Employment Contract"
2. Edit → Upload new version "Contract_v2.docx" (different filename)
3. Verify version 2 created with same displayName
4. Verify `parentDocumentId` points to version 1

### Scenario 2: Cross-Format Versioning
1. Upload "draft.pdf" as "Project Proposal"
2. Upload "revised.docx" as version 2 (same displayName)
3. Upload "final.xlsx" as version 3 (same displayName)
4. Verify all three linked via `parentDocumentId`

### Scenario 3: Folder Isolation
1. Upload "Report.pdf" as "Monthly Report" in Folder A
2. Upload "Report.pdf" as "Monthly Report" in Folder B
3. Verify two independent documents (different folderIds)
4. Edit version in Folder A → should not affect Folder B

### Scenario 4: Matter Scoping
1. Upload "Evidence.pdf" to Matter A with displayName "Photo Evidence"
2. Upload "Evidence.pdf" to Matter B with displayName "Photo Evidence"
3. Verify two independent documents (different matterIds)

---

## Benefits

✅ **User-Friendly**: Users think in terms of document names, not filenames  
✅ **Flexible**: Different file formats can be versions of same document  
✅ **Organized**: Versions grouped by folder and matter/contact  
✅ **Intuitive**: "Employment Contract v1, v2, v3" vs "contract.pdf, contract_v2.pdf, contract_final.pdf"  
✅ **Future-Proof**: Supports conflict detection and version prompts  

---

## Files Modified

### API Layer
- ✅ `app/api/uploads/route.ts` - Version calculation by displayName
- ✅ `app/api/documents/route.ts` - Version validation by displayName
- ✅ `lib/validation/document.ts` - Added displayName to schemas

### Frontend
- ✅ `components/documents/EditDocumentDialog.tsx` - Version upload with displayName
- ✅ `components/documents/types.ts` - Already had folderId

### Documentation
- ✅ `docs/MASTER-SYSTEM-DOCUMENTATION.md` - Updated versioning section
- ✅ `docs/features/DOCUMENT-VERSIONING-V2.md` - This document

---

## Next Steps (Future Enhancements)

1. **Conflict Detection UI**: Prompt when uploading new document with duplicate displayName
2. **Version Comparison**: Show diffs between versions
3. **Version Rollback**: Restore previous version as new version
4. **Bulk Version Operations**: Delete/download all versions
5. **Version Comments**: Add notes explaining what changed in each version
6. **Display Name Validation**: Prevent special characters, enforce uniqueness within scope

---

## Questions & Answers

**Q: What happens to documents without displayName?**  
A: They use filename as fallback for versioning.

**Q: Can I rename a document and keep the version chain?**  
A: Yes, edit displayName in "Details & Access" tab - this changes the version identifier.

**Q: What if I upload same file to different folders?**  
A: They're independent documents because folderId differs.

**Q: Can versions have different access controls?**  
A: Yes, each version can have its own accessScope and grants.

**Q: How do I see all versions of a document?**  
A: Open document drawer → "Versions" section lists all versions.

---

**End of Document**
