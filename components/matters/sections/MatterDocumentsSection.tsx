/**
 * MatterDocumentsSection Component
 * 
 * Displays and manages documents associated with a matter.
 * Extracted from MatterDetailClient for better modularity and reusability.
 * 
 * Features:
 * - List of documents with icons and metadata
 * - "Upload" button for adding new documents
 * - Clickable document list items to open preview drawer
 * - Highlight documents attached to selected workflow step
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
  highlightedDocumentIds = [],
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
          documents.map((doc) => {
            const isHighlighted = highlightedDocumentIds.includes(doc.id);
            return (
              <li
                key={doc.id}
                onClick={() => onViewDocument(doc)}
                className={`flex items-start gap-2 rounded-lg p-2 transition-all cursor-pointer ${
                  isHighlighted
                    ? "bg-blue-50 border-2 border-blue-300 ring-2 ring-blue-100 hover:bg-blue-100"
                    : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <DocumentTypeIcon mimeType={doc.mime} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate text-xs">
                    {/* Show tag name (requested document name) if available and linked to workflow */}
                    {doc.workflowStepId && doc.tags && doc.tags.length > 0 
                      ? doc.tags[0] 
                      : doc.filename}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <div>{formatFileSize(doc.size)}</div>
                    {/* Show actual filename as secondary info if tag is displayed */}
                    {doc.workflowStepId && doc.tags && doc.tags.length > 0 && (
                      <div className="truncate text-[10px] italic">
                        {doc.filename}
                      </div>
                    )}
                    <div className="truncate">
                      {doc.uploader.name || doc.uploader.email}
                    </div>
                    <div>{dateFormatter.format(new Date(doc.createdAt))}</div>
                  </div>
                </div>
              </li>
            );
          })
        ) : (
          <li className="text-slate-400 text-xs">No documents yet.</li>
        )}
      </ul>
    </div>
  );
}
