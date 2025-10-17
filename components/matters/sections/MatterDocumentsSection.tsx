/**
 * MatterDocumentsSection Component
 * 
 * Displays and manages documents associated with a matter.
 * Extracted from MatterDetailClient for better modularity and reusability.
 * 
 * Features:
 * - List of documents with icons and metadata
 * - "Upload" button for adding new documents
 * - "View" button to open document details
 * - File size formatting and uploader information
 * - Loading and empty states
 * - Responsive grid layout
 */

import { DocumentTypeIcon } from "@/components/documents/DocumentTypeIcon";
import { formatFileSize } from "@/lib/documents/format-utils";
import { dateFormatter } from "./utils";
import type { MatterDocumentsSectionProps } from "./types";

export function MatterDocumentsSection({
  documents,
  loading,
  onUploadClick,
  onViewDocument,
}: MatterDocumentsSectionProps) {
  return (
    <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
        <button
          type="button"
          onClick={onUploadClick}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
          title="Upload Document"
        >
          Upload
        </button>
      </div>
      <ul className="space-y-2 text-sm text-slate-600">
        {loading ? (
          <li className="text-slate-500 text-xs">Loading...</li>
        ) : documents.length ? (
          documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 hover:bg-slate-100 transition-colors"
            >
              <DocumentTypeIcon mimeType={doc.mime} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate text-xs">
                  {doc.filename}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  <div>{formatFileSize(doc.size)}</div>
                  <div className="truncate">
                    {doc.uploader.name || doc.uploader.email}
                  </div>
                  <div>{dateFormatter.format(new Date(doc.createdAt))}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewDocument(doc)}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex-shrink-0"
              >
                View
              </button>
            </li>
          ))
        ) : (
          <li className="text-slate-400 text-xs">No documents yet.</li>
        )}
      </ul>
    </div>
  );
}
