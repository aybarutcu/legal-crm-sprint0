"use client";

import { useEffect, useState } from "react";
import { FileUp, Download, AlertCircle } from "lucide-react";
import { DocumentTypeIcon } from "@/components/documents/DocumentTypeIcon";

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy?: {
    name: string;
  };
}

interface DocumentViewerProps {
  documentIds: string[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function DocumentViewer({ documentIds }: DocumentViewerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const results = await Promise.all(
          documentIds.map(async (id) => {
            const res = await fetch(`/api/documents/${id}`);
            if (!res.ok) throw new Error(`Failed to fetch document ${id}`);
            const data = await res.json();
            return data.document;
          })
        );
        setDocuments(results);
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    if (documentIds.length > 0) {
      void fetchDocuments();
    } else {
      setLoading(false);
    }
  }, [documentIds]);

  if (loading) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-green-600 animate-pulse" />
          <p className="text-sm text-slate-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-slate-400" />
          <p className="text-sm text-slate-600">No documents uploaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileUp className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-slate-900">Uploaded Documents</h4>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          {documents.length}
        </span>
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-3 hover:border-green-300 transition-colors"
          >
            <DocumentTypeIcon mimeType={doc.mimeType} className="h-5 w-5 flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{doc.filename}</p>
              <p className="text-xs text-slate-500">
                {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.uploadedAt)}
                {doc.uploadedBy && ` by ${doc.uploadedBy.name}`}
              </p>
            </div>

            <a
              href={`/api/documents/${doc.id}/download`}
              download
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-green-100 text-slate-600 hover:text-green-700 transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
