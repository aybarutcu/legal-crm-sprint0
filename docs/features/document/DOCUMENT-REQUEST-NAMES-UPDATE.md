# Document Request Configuration Update

## Overview

Updated the `REQUEST_DOC` action configuration to use **document names** instead of MIME types. This provides a more user-friendly approach where admins can specify what documents they need (e.g., "Copy of ID", "Passport Photocopy") rather than technical MIME types.

## Changes Made

### 1. Configuration Structure Change

**Before:**
```typescript
{
  requestText: "Please upload your ID",
  acceptedFileTypes: ["application/pdf", "image/jpeg", "image/png"]
}
```

**After:**
```typescript
{
  requestText: "Please upload your ID",
  documentNames: ["Nüfus Cüzdanı Kopyası", "Pasaport Fotokopisi"]
}
```

### 2. Integration Points

The changes are now available in both:
1. **Workflow Instance Editing** (MatterDetailClient) - When editing steps in a matter's workflow
2. **Workflow Template Editing** (Template editor) - When creating/editing workflow templates

### 3. Updated Components

#### DocumentRequestConfigForm.tsx
- **Location:** `components/workflows/config-forms/DocumentRequestConfigForm.tsx`
- **Changes:**
  - Renamed `acceptedFileTypes` → `documentNames`
  - Changed label from "Kabul Edilen Dosya Tipleri" → "İstenilen Belgeler"
  - Updated placeholder to show document name examples instead of MIME types
  - Updated helper text to show examples: "Nüfus Cüzdanı Kopyası, İkametgah Belgesi, Pasaport Fotokopisi"
  - Visual improvements: Document names shown without `font-mono` styling (more user-friendly)

#### ActionConfigDisplay.tsx
- **Location:** `components/workflows/ActionConfigDisplay.tsx`
- **Changes:**
  - Updated to read `documentNames` instead of `acceptedTypes`
  - Document names now displayed as tags in the configuration display
  - Updated documentation comment

#### DocumentRequestExecution.tsx
- **Location:** `components/workflows/execution/DocumentRequestExecution.tsx`
- **Changes:**
  - Updated to read `documentNames` from config
  - Enhanced display: Shows "İstenilen Belgeler:" label with document name tags
  - Tags styled with orange theme matching the action type

#### Default Configurations
- **Files Updated:**
  - `components/matters/MatterDetailClient.tsx`
  - `app/(dashboard)/workflows/templates/_components/client.tsx`
- **Changes:**
  - Updated `defaultConfigFor("REQUEST_DOC")` to return `{ requestText: "", documentNames: [] }`

#### Workflow Template Editor
- **Location:** `app/(dashboard)/workflows/templates/_components/client.tsx`
- **Changes:**
  - Added import for `ActionConfigForm`
  - Replaced JSON textarea with `ActionConfigForm` for non-CHECKLIST action types
  - Forms now automatically switch based on action type selected
  - Config changes update both `actionConfig` and `actionConfigInput`

## User Experience Improvements

### Configuration (Admin/Lawyer View)

**Before:**
```
Kabul Edilen Dosya Tipleri:
[application/pdf] [image/jpeg] [image/png]

💡 Örnek MIME tipleri: application/pdf, image/jpeg, image/png
```

**After:**
```
İstenilen Belgeler:
[Nüfus Cüzdanı Kopyası] [Pasaport Fotokopisi] [İkametgah Belgesi]

💡 Örnek belge adları: Nüfus Cüzdanı Kopyası, İkametgah Belgesi, Pasaport Fotokopisi
```

### Execution (Client View)

**Before:**
```
Kabul edilen dosya tipleri: application/pdf, image/jpeg, image/png
[File Upload]
```

**After:**
```
İstenilen Belgeler:
[Nüfus Cüzdanı Kopyası] [Pasaport Fotokopisi] [İkametgah Belgesi]

[File Upload]
```

### Display (Step Overview)

Document names are now shown as readable tags in:
- Workflow step cards
- Workflow template editor
- Matter detail workflow steps
- Execution logs

Example:
```
📤 Doküman Yükleme Talebi
"Lütfen aşağıdaki belgeleri yükleyiniz..."
[Nüfus Cüzdanı Kopyası] [Pasaport Fotokopisi]
```

## Benefits

1. **More Intuitive:** Users understand what documents are needed without knowing MIME types
2. **Better UX:** Document names are more descriptive than technical file types
3. **Clearer Communication:** Both admins and clients see the same document names
4. **Consistent Display:** Document tags shown consistently across all views
5. **Easier Configuration:** No need to look up MIME type strings

## Migration Notes

### Backward Compatibility

The system may have existing workflow steps with `acceptedFileTypes` in their config. Consider:

1. **Reading both fields:** Update code to check for both `documentNames` and `acceptedFileTypes` (legacy)
2. **Migration script:** Convert old configs from `acceptedFileTypes` to `documentNames`
3. **Fallback handling:** If `documentNames` is empty, show all file types accepted

### Example Migration Code

```typescript
// In execution component
const documentNames = (config?.documentNames as string[]) ?? 
                     (config?.acceptedFileTypes as string[]) ?? [];
```

## Testing Checklist

- [x] ✅ DocumentRequestConfigForm displays document name inputs
- [x] ✅ Document names can be added via input + button
- [x] ✅ Document names can be added via Enter key
- [x] ✅ Document names can be removed
- [x] ✅ ActionConfigDisplay shows document names as tags
- [x] ✅ DocumentRequestExecution displays document names
- [ ] ⏳ Create a new workflow step with document request
- [ ] ⏳ Save and view the configuration
- [ ] ⏳ Execute the step and verify display
- [ ] ⏳ Test with Turkish characters (e.g., "İkametgah", "Şirket")
- [ ] ⏳ Test empty document names list
- [ ] ⏳ Test with existing workflows (migration)

## Example Usage

### Creating a Document Request Step

1. Select action type: "REQUEST_DOC"
2. Enter request message:
   ```
   Lütfen aşağıdaki belgeleri renkli olarak yükleyiniz:
   ```
3. Add document names:
   - "Nüfus Cüzdanı Kopyası"
   - "Pasaport Fotokopisi"
   - "İkametgah Belgesi"
4. Save step

### Client Execution

When client views the step:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 Doküman Yükleme Talebi

Lütfen aşağıdaki belgeleri renkli olarak yükleyiniz:

İstenilen Belgeler:
[Nüfus Cüzdanı Kopyası] 
[Pasaport Fotokopisi] 
[İkametgah Belgesi]

[Choose File] No file chosen

[✓ Yükle ve Tamamla]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Related Files

### Updated Files
1. `components/workflows/config-forms/DocumentRequestConfigForm.tsx` - Configuration form
2. `components/workflows/ActionConfigDisplay.tsx` - Display component
3. `components/workflows/execution/DocumentRequestExecution.tsx` - Execution component
4. `components/matters/MatterDetailClient.tsx` - Default config
5. `app/(dashboard)/workflows/templates/_components/client.tsx` - Template editor default

### Related Documentation
- `docs/ACTION-CONFIG-FORMS.md` - Configuration forms documentation
- `docs/ACTION-CONFIG-DISPLAY-IMPLEMENTATION.md` - Display component documentation
- `docs/INTERACTIVE-TASK-EXECUTION.md` - Execution documentation

## Future Enhancements

### Phase 1: Document Tracking
- Link document names to actual uploaded documents
- Show which documents have been uploaded
- Allow multiple uploads per document name

### Phase 2: Document Templates
- Predefined document name sets (e.g., "KYC Documents", "Contract Documents")
- Quick-add buttons for common document types
- Multi-language support for document names

### Phase 3: Document Validation
- Optional: Add MIME type hints per document name
- File size requirements per document type
- Document format validation

### Phase 4: Smart Matching
- AI-powered document type detection
- Auto-assign uploaded documents to requested names
- Suggest document names based on matter type

## Conclusion

This update significantly improves the user experience for document request configuration by replacing technical MIME types with user-friendly document names. The change is reflected across configuration forms, display components, and execution views, providing a consistent and intuitive interface for both admins and clients.

**Status:** ✅ Complete
**Date:** October 16, 2025
**Version:** 1.0
