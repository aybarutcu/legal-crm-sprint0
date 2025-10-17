# Document Management Enhancement - Analysis & Implementation Plan

## Current State Analysis

### Documents Section in MatterDetailClient

**Current Implementation**:
- Shows up to 5 documents (pageSize=5)
- Only displays filename and creation date
- "View All" button links to documents page
- "Detay" button opens document detail drawer
- Documents loaded from `/api/documents?matterId=${matterId}&page=1&pageSize=5`

**Limitations**:
1. ❌ Cannot upload documents directly from matter page
2. ❌ Only shows 5 documents (arbitrary limit)
3. ❌ No way to see all documents without leaving the page
4. ❌ Limited document metadata displayed
5. ❌ No document type icons/indicators
6. ❌ No upload source indication (workflow vs manual)
7. ❌ No document analysis/AI integration
8. ❌ "View All" leaves the page (poor UX)

## Requirements

### 1. Show All Documents
- Display **all** documents related to the matter
- Include documents from:
  - ✓ Workflow task uploads (by client, lawyer, or paralegal)
  - ✓ Documents page uploads
  - ✓ Direct uploads from matter detail page
- Remove arbitrary 5-document limit

### 2. Replace "View All" with "Upload Document"
- Remove "View All" button that navigates away
- Add "Upload Document" button for inline uploads
- Support all file types (Word, Excel, Image, PDF, etc.)

### 3. Enhanced Document Display
- Show document type icons based on MIME type
- Show file size
- Show uploader information
- Show upload source (workflow task, manual, etc.)
- Show document tags/categories
- Better visual hierarchy

### 4. Document Upload Functionality
- Inline upload dialog/component
- File selection with drag & drop
- File type validation
- File size validation (MAX_UPLOAD_BYTES)
- Progress indicator
- Success/error feedback
- Auto-refresh document list after upload

### 5. AI Document Analysis (Future)
- Prepare architecture for AI integration
- Document content extraction
- Key information extraction
- Document classification
- Document summarization
- OCR for scanned documents

## Implementation Plan

### Phase 1: Enhanced Document Display (Immediate)

#### Step 1.1: Update Document Loading
**File**: `components/matters/MatterDetailClient.tsx`

**Changes**:
```typescript
// Remove pageSize limit, load all documents
async function loadRelatedDocuments() {
  setDocsLoading(true);
  try {
    const response = await fetch(
      `/api/documents?matterId=${matter.id}&page=1&pageSize=100` // or remove limit
    );
    if (!response.ok) throw new Error("Documents could not be loaded");
    const payload: { data: DocumentListItem[] } = await response.json();
    setRelatedDocs(payload.data);
  } catch (error) {
    console.error(error);
  } finally {
    setDocsLoading(false);
  }
}
```

#### Step 1.2: Create Document Type Icons Component
**New File**: `components/documents/DocumentTypeIcon.tsx`

**Purpose**: Display appropriate icon based on MIME type

**Supported Types**:
- 📄 PDF: `application/pdf`
- 📝 Word: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- 📊 Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- 🖼️ Image: `image/*`
- 📎 Generic: fallback

**Implementation**:
```tsx
import { FileText, Image, FileSpreadsheet, File } from "lucide-react";

export function DocumentTypeIcon({ mimeType, className }: Props) {
  if (mimeType.startsWith("image/")) {
    return <Image className={className} />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className={className} />;
  }
  if (mimeType.includes("spreadsheet")) {
    return <FileSpreadsheet className={className} />;
  }
  return <File className={className} />;
}
```

#### Step 1.3: Enhanced Document List Item
**Update**: Document list item in MatterDetailClient

**New Display**:
```tsx
<li key={doc.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
  <DocumentTypeIcon mimeType={doc.mime} className="h-8 w-8 text-slate-400" />
  <div className="flex-1 min-w-0">
    <div className="font-medium text-slate-900 truncate">{doc.filename}</div>
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>{formatFileSize(doc.size)}</span>
      <span>•</span>
      <span>{formatDate(doc.createdAt)}</span>
      {doc.uploader && (
        <>
          <span>•</span>
          <span>by {doc.uploader.name || doc.uploader.email}</span>
        </>
      )}
    </div>
  </div>
  <button onClick={() => openDocDetail(doc)}>Detay</button>
</li>
```

### Phase 2: Document Upload Component (High Priority)

#### Step 2.1: Create Upload Dialog Component
**New File**: `components/documents/DocumentUploadDialog.tsx`

**Features**:
- Modal dialog for file upload
- File input with drag & drop
- File preview
- Metadata input (tags, description)
- Upload progress
- Error handling

**Props**:
```typescript
type DocumentUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  matterId: string;
  onUploadSuccess: (document: DocumentListItem) => void;
};
```

**Implementation**:
```tsx
export function DocumentUploadDialog({ 
  isOpen, 
  onClose, 
  matterId, 
  onUploadSuccess 
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  async function handleUpload() {
    if (!file) return;
    
    setUploading(true);
    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      
      // Upload to API
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type,
          size: file.size,
          matterId: matterId,
          data: base64,
        }),
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const doc = await response.json();
      onUploadSuccess(doc);
      onClose();
    } catch (error) {
      console.error(error);
      // Show error toast
    } finally {
      setUploading(false);
    }
  }
  
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      {/* Upload UI */}
    </Dialog>
  );
}
```

#### Step 2.2: Add Upload Button
**Update**: MatterDetailClient documents section

**Replace**:
```tsx
<Link href={`/documents?matterId=${matter.id}&page=1`}>
  View All
</Link>
```

**With**:
```tsx
<button
  type="button"
  onClick={() => setShowUploadDialog(true)}
  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
>
  Upload Document
</button>
```

#### Step 2.3: Integrate Upload Dialog
**Update**: MatterDetailClient

**Add State**:
```typescript
const [showUploadDialog, setShowUploadDialog] = useState(false);
```

**Add Component**:
```tsx
<DocumentUploadDialog
  isOpen={showUploadDialog}
  onClose={() => setShowUploadDialog(false)}
  matterId={matter.id}
  onUploadSuccess={handleDocumentUploaded}
/>
```

**Add Handler**:
```typescript
function handleDocumentUploaded(doc: DocumentListItem) {
  setRelatedDocs(prev => [doc, ...prev]);
  showToast("success", "Document uploaded successfully");
}
```

### Phase 3: Document Analysis Architecture (Future)

#### Step 3.1: Document Analysis Service
**New File**: `lib/ai/document-analyzer.ts`

**Features**:
- Text extraction (PDF, Word, Excel)
- OCR for images/scanned documents
- Key information extraction
- Entity recognition (names, dates, amounts)
- Document classification
- Content summarization

**Integration Points**:
```typescript
export async function analyzeDocument(documentId: string) {
  // 1. Retrieve document from storage
  const document = await getDocument(documentId);
  
  // 2. Extract text content
  const text = await extractText(document);
  
  // 3. Analyze with AI (OpenAI, Azure AI, etc.)
  const analysis = await analyzeWithAI(text);
  
  // 4. Store analysis results
  await saveAnalysis(documentId, analysis);
  
  return analysis;
}
```

#### Step 3.2: Analysis Results Display
**New Component**: `components/documents/DocumentAnalysis.tsx`

**Features**:
- Show extracted entities
- Display key information
- Show confidence scores
- Allow corrections/confirmations

#### Step 3.3: Database Schema Extension
**Prisma Schema Update**:
```prisma
model DocumentAnalysis {
  id           String   @id @default(cuid())
  documentId   String   @unique
  document     Document @relation(fields: [documentId], references: [id])
  
  // Extracted content
  extractedText String?
  summary       String?
  
  // Entities
  entities      Json? // { people: [], dates: [], amounts: [] }
  
  // Classification
  documentType  String?
  category      String?
  confidence    Float?
  
  // Metadata
  analyzedAt    DateTime @default(now())
  analyzedBy    String? // AI model used
  
  @@map("document_analyses")
}
```

## File Size Formatting

### Utility Function
**File**: `lib/utils/format.ts`

```typescript
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
```

## File Upload Flow

### Client-Side
1. User selects file(s)
2. Validate file type and size
3. Convert file to base64
4. Send to API with metadata
5. Show progress indicator
6. Handle success/error
7. Refresh document list

### Server-Side
1. Receive file data
2. Validate MIME type
3. Validate file size
4. Calculate hash
5. Store in S3/storage
6. Create database record
7. Return document info

## Document Sources

### Tracking Upload Source
**Extend DocumentListItem Type**:
```typescript
type DocumentSource = 
  | { type: "workflow"; workflowId: string; stepId: string; }
  | { type: "manual"; uploaderId: string; }
  | { type: "matter_page"; matterId: string; };

type DocumentListItem = {
  // ... existing fields
  source?: DocumentSource;
};
```

**Display Source**:
```tsx
{doc.source?.type === "workflow" && (
  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
    Via Workflow
  </span>
)}
```

## AI Analysis Features (Future Roadmap)

### Phase 1: Basic Text Extraction
- PDF text extraction (pdf-parse, pdfjs)
- Word document text extraction (mammoth)
- Excel data extraction (xlsx)
- OCR for images (Tesseract.js or Azure Vision)

### Phase 2: Content Analysis
- Entity extraction (names, dates, amounts, locations)
- Key phrase extraction
- Sentiment analysis
- Language detection

### Phase 3: Legal Document Analysis
- Contract clause identification
- Deadline extraction
- Party identification
- Obligation tracking
- Risk assessment

### Phase 4: Smart Features
- Auto-tagging based on content
- Document similarity detection
- Duplicate detection
- Version comparison
- Missing document detection (e.g., "contract signed but no signature page")

## Testing Checklist

### Document Display
- [ ] All documents for matter are loaded
- [ ] Document type icons display correctly
- [ ] File sizes are formatted correctly
- [ ] Uploader information is shown
- [ ] Dates are formatted correctly
- [ ] "Detay" button opens drawer

### Document Upload
- [ ] "Upload Document" button is visible
- [ ] Upload dialog opens
- [ ] File selection works
- [ ] Drag & drop works
- [ ] File validation works (type, size)
- [ ] Upload progress is shown
- [ ] Success message appears
- [ ] Document list refreshes
- [ ] Error handling works

### Edge Cases
- [ ] No documents state
- [ ] Very long filename (truncation)
- [ ] Large number of documents (scrolling)
- [ ] Upload failure handling
- [ ] Network error handling
- [ ] Invalid file type
- [ ] File size exceeds limit

## Security Considerations

### File Upload Security
1. ✅ Validate MIME type on server
2. ✅ Validate file size limits
3. ✅ Sanitize filename
4. ✅ Scan for malware (future)
5. ✅ Check user permissions
6. ✅ Rate limiting

### Document Access Security
1. ✅ Verify user has access to matter
2. ✅ Check document permissions
3. ✅ Audit document access
4. ✅ Encrypted storage
5. ✅ Secure URLs (signed URLs)

## Performance Considerations

### Document Loading
- Pagination for large lists
- Lazy loading of thumbnails
- Virtual scrolling for 100+ documents
- Cache document metadata

### File Upload
- Chunked uploads for large files
- Resume capability
- Background upload queue
- Compression before upload

## Accessibility

### Document List
- Keyboard navigation
- Screen reader support
- Focus management
- ARIA labels

### Upload Dialog
- Keyboard accessible file input
- Drag & drop keyboard alternative
- Progress announcements
- Error announcements

## Next Steps

### Immediate (Phase 1)
1. Create DocumentTypeIcon component
2. Update document list display
3. Add formatFileSize utility
4. Remove pageSize limit or increase to 100

### Short-term (Phase 2)
1. Create DocumentUploadDialog component
2. Add upload button
3. Implement file upload flow
4. Test thoroughly

### Medium-term (Phase 3)
1. Design AI analysis architecture
2. Choose AI service (OpenAI, Azure, etc.)
3. Implement text extraction
4. Create analysis UI

### Long-term
1. Advanced AI features
2. Document workflow automation
3. Smart recommendations
4. Predictive analytics

---

**Status**: 📋 Plan Ready  
**Priority**: 🔴 HIGH  
**Estimated Time**: 
- Phase 1: 2-3 hours
- Phase 2: 4-5 hours
- Phase 3: 8-10 hours (separate sprint)

**Risk Level**: Low (Phase 1-2), Medium (Phase 3 - AI integration)
