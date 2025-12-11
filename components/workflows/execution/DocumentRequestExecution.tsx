"use client";

import { Upload, CheckCircle2, Clock, Check } from "lucide-react";
import { RequestDocViewer } from "@/components/workflows/output/RequestDocViewer";
import useSWR from "swr";
import { useState } from "react";

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
  onAddDocument?: (requestId: string, documentName: string, existingDocumentId?: string) => void;
  onCompleteStep?: () => void;
  isLoading: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DocumentRequestExecution({
  step,
  onAddDocument,
  onCompleteStep,
  isLoading,
}: DocumentRequestExecutionProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch live document status from API
  const { data: liveStatus } = useSWR(
    `/api/workflows/steps/${step.id}/document-status`,
    fetcher,
    {
      refreshInterval: 3000, // Refresh every 3 seconds
      revalidateOnFocus: true,
    }
  );

  // actionData contains both config and runtime data merged
  // Config fields: requestText, documentNames, acceptedFileTypes
  // Runtime data fields: status, documentsStatus, allDocumentsUploaded
  const actionData = step.actionData as Record<string, unknown> | null;
  
  // Try to get config from actionData.config first (nested), then from root level
  const config = (actionData?.config as Record<string, unknown>) ?? actionData ?? {};
  
  // Use live status if available, otherwise fall back to actionData
  const data = liveStatus || ((actionData?.data as Record<string, unknown>) ?? {});
  
  const requestText = (config.requestText as string) ?? (actionData?.requestText as string) ?? "";
  const documentNames = (config.documentNames as string[]) ?? (actionData?.documentNames as string[]) ?? [];
  const documentsStatus = (data?.documentsStatus as DocumentUploadStatus[]) ?? (actionData?.documentsStatus as DocumentUploadStatus[]) ?? [];
  const allDocumentsUploaded = (data?.allDocumentsUploaded as boolean) ?? (actionData?.allDocumentsUploaded as boolean) ?? false;
  
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
    willShowViewer: step.actionState === "COMPLETED"
  });
  
  // If step is COMPLETED, show RequestDocViewer (read-only view with document list)
  if (step.actionState === "COMPLETED") {
    console.log('[DocumentRequestExecution] RENDERING RequestDocViewer - step completed');
    return (
      <RequestDocViewer 
        config={{
          requestText,
          documentNames,
        }}
        data={{
          documentsStatus,
          allDocumentsUploaded,
        }}
      />
    );
  }
  
  console.log('[DocumentRequestExecution] NOT rendering viewer - showing interactive upload UI');

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
                          onClick={() => {
                            console.log('[DocumentRequestExecution] Clicking Yeni Versiyon with status:', status);
                            onAddDocument(status.requestId, status.documentName, status.documentId);
                          }}
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

      {allDocumentsUploaded && canUpload && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900">
                ✓ Tüm dokümanlar yüklenmiş
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Adımı tamamlamak için butona tıklayın. Bu adımı tamamladıktan sonra bağımlı adımlar otomatik olarak başlayacaktır.
              </p>
            </div>
            {onCompleteStep && (
              <button
                type="button"
                onClick={async () => {
                  setIsCompleting(true);
                  try {
                    await onCompleteStep();
                  } finally {
                    setIsCompleting(false);
                  }
                }}
                disabled={isCompleting || isLoading}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-4 w-4" />
                {isCompleting ? "Tamamlanıyor..." : "Adımı Tamamla"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
