"use client";

import { CheckCircle2, Clock, FileUp } from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";

interface DocumentUploadStatus {
  documentName: string;
  uploaded: boolean;
  documentId?: string;
  uploadedAt?: string;
}

interface RequestDocViewerProps {
  config: {
    requestText?: string;
    documentNames?: string[];
  };
  data: {
    documentsStatus?: DocumentUploadStatus[];
    allDocumentsUploaded?: boolean;
    status?: string;
  };
}

export function RequestDocViewer({ config, data }: RequestDocViewerProps) {
  const requestText = config.requestText || "";
  const documentsStatus = data.documentsStatus || [];
  const allDocumentsUploaded = data.allDocumentsUploaded || false;

  // Extract uploaded document IDs
  const uploadedDocumentIds = documentsStatus
    .filter((status) => status.uploaded && status.documentId)
    .map((status) => status.documentId!);

  console.log('[RequestDocViewer] Rendering with:', {
    documentsStatus,
    uploadedDocumentIds,
    allDocumentsUploaded
  });

  // If documents are uploaded, show the DocumentViewer
  if (uploadedDocumentIds.length > 0) {
    return (
      <div className="space-y-4">
        {requestText && (
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-sm text-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <FileUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-900">Document Request</span>
            </div>
            <p className="text-slate-600">{requestText}</p>
          </div>
        )}
        <DocumentViewer 
          documentIds={uploadedDocumentIds} 
          showUploader={true}
          showVersion={true}
        />
      </div>
    );
  }

  // Fallback: Show status list (shouldn't happen for COMPLETED steps)
  return (
    <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-green-600" />
          <h4 className="font-semibold text-green-900">Requested Documents</h4>
        </div>
        {allDocumentsUploaded && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            All Uploaded
          </span>
        )}
      </div>

      {requestText && (
        <div className="mb-3 rounded-lg border border-green-200 bg-white p-3 text-sm text-slate-700">
          {requestText}
        </div>
      )}

      <div className="space-y-2">
        {documentsStatus.map((status, index) => {
          const isUploaded = status.uploaded ?? false;

          return (
            <div
              key={index}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                isUploaded
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                {isUploaded ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-400" />
                )}
                <span className={`text-sm font-medium ${
                  isUploaded ? "text-emerald-900" : "text-slate-700"
                }`}>
                  {status.documentName}
                </span>
              </div>

              {isUploaded && status.uploadedAt && (
                <span className="text-xs text-emerald-600">
                  {new Date(status.uploadedAt).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}

              {!isUploaded && (
                <span className="text-xs text-slate-500">Pending</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
