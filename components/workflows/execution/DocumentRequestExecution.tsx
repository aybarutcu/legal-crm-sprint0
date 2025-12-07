"use client";

import { Upload, CheckCircle2, Clock } from "lucide-react";
import { DocumentViewer } from "@/components/workflows/output/DocumentViewer";

interface DocumentUploadStatus {
  requestId: string;
  documentName: string;
  uploaded: boolean;
  documentId?: string;
  uploadedAt?: string;
  version?: number;
}

interface DocumentRequestExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
    actionState?: string;
  };
  onAddDocument?: (requestId: string, documentName: string) => void;
  isLoading: boolean;
}

export function DocumentRequestExecution({
  step,
  onAddDocument,
  isLoading,
}: DocumentRequestExecutionProps) {
  // actionData contains both config and runtime data merged
  // Config fields: requestText, documentNames, acceptedFileTypes
  // Runtime data fields: status, documentsStatus, allDocumentsUploaded
  const actionData = step.actionData as Record<string, unknown> | null;
  
  // Try to get config from actionData.config first (nested), then from root level
  const config = (actionData?.config as Record<string, unknown>) ?? actionData ?? {};
  
  const requestText = (config.requestText as string) ?? (actionData?.requestText as string) ?? "";
  const documentNames = (config.documentNames as string[]) ?? (actionData?.documentNames as string[]) ?? [];
  const documentsStatus = (actionData?.documentsStatus as DocumentUploadStatus[]) ?? [];
  const allDocumentsUploaded = (actionData?.allDocumentsUploaded as boolean) ?? false;
  
  // Only allow uploads when step is IN_PROGRESS
  const canUpload = step.actionState === "IN_PROGRESS";

  // Create a map of document statuses for easy lookup
  const statusMap = new Map<string, DocumentUploadStatus>();
  documentsStatus.forEach((status) => {
    statusMap.set(status.requestId, status);
  });
  
  // Extract uploaded document IDs for DocumentViewer (COMPLETED state)
  const uploadedDocumentIds = documentsStatus
    .filter((status) => status.uploaded && status.documentId)
    .map((status) => status.documentId!);
  
  console.log('[DocumentRequestExecution] Step state:', step.actionState);
  console.log('[DocumentRequestExecution] Documents status:', JSON.stringify(documentsStatus, null, 2));
  console.log('[DocumentRequestExecution] Uploaded document IDs:', uploadedDocumentIds);
  console.log('[DocumentRequestExecution] Condition check:', {
    isCompleted: step.actionState === "COMPLETED",
    hasDocIds: uploadedDocumentIds.length > 0,
    willShowViewer: step.actionState === "COMPLETED" && uploadedDocumentIds.length > 0
  });
  
  // If step is COMPLETED, show DocumentViewer instead
  if (step.actionState === "COMPLETED" && uploadedDocumentIds.length > 0) {
    console.log('[DocumentRequestExecution] RENDERING DocumentViewer with IDs:', uploadedDocumentIds);
    return <DocumentViewer documentIds={uploadedDocumentIds} />;
  }
  
  console.log('[DocumentRequestExecution] NOT rendering DocumentViewer - showing upload UI instead');

  return (
    <div className="mt-3 rounded-lg border-2 border-orange-200 bg-orange-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h5 className="font-semibold text-orange-900">Doküman Yükleme Talebi</h5>
        {allDocumentsUploaded && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Tamamlandı
          </span>
        )}
      </div>

      {requestText && (
        <div className="mb-3 rounded-lg border border-orange-200 bg-white p-3 text-sm text-slate-700">
          {requestText}
        </div>
      )}

      {documentsStatus.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">İstenilen Belgeler:</p>
          <div className="space-y-2">
            {documentsStatus.map((status) => {
              const isUploaded = status.uploaded ?? false;

              return (
                <div
                  key={status.requestId}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    isUploaded
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-orange-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-orange-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      isUploaded ? "text-emerald-900" : "text-slate-900"
                    }`}>
                      {status.documentName}
                      {status.version && status.version > 0 && (
                        <span className="ml-2 text-xs text-slate-500">(v{status.version})</span>
                      )}
                    </span>
                  </div>
                  
                  {!isUploaded && canUpload && onAddDocument && (
                    <button
                      type="button"
                      onClick={() => onAddDocument(status.requestId, status.documentName)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Upload className="h-3 w-3" />
                      Yükle
                    </button>
                  )}

                  {isUploaded && (
                    <div className="flex items-center gap-2">
                      {status.uploadedAt && (
                        <span className="text-xs text-emerald-600">
                          {new Date(status.uploadedAt).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {canUpload && onAddDocument && (
                        <button
                          type="button"
                          onClick={() => onAddDocument(status.requestId, status.documentName)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          title="Yeni versiyon yükle"
                        >
                          <Upload className="h-3 w-3" />
                          Yeni Versiyon
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allDocumentsUploaded && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-700">
            ✓ Tüm dokümanlar başarıyla yüklendi. Adım otomatik olarak tamamlanacak.
          </p>
        </div>
      )}
    </div>
  );
}
