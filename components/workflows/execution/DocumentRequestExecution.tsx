"use client";

import { Upload, CheckCircle2, Clock } from "lucide-react";

interface DocumentUploadStatus {
  documentName: string;
  uploaded: boolean;
  documentId?: string;
  uploadedAt?: string;
}

interface DocumentRequestExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onAddDocument?: (documentName: string) => void;
  isLoading: boolean;
}

export function DocumentRequestExecution({
  step,
  onAddDocument,
  isLoading,
}: DocumentRequestExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const data = (step.actionData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  
  const requestText = (config?.requestText as string) ?? "";
  const documentNames = (config?.documentNames as string[]) ?? [];
  const documentsStatus = (data?.documentsStatus as DocumentUploadStatus[]) ?? [];
  const allDocumentsUploaded = (data?.allDocumentsUploaded as boolean) ?? false;

  // Create a map of document statuses for easy lookup
  const statusMap = new Map<string, DocumentUploadStatus>();
  documentsStatus.forEach((status) => {
    statusMap.set(status.documentName, status);
  });

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

      {documentNames.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">İstenilen Belgeler:</p>
          <div className="space-y-2">
            {documentNames.map((name, index) => {
              const status = statusMap.get(name);
              const isUploaded = status?.uploaded ?? false;

              return (
                <div
                  key={index}
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
                      {name}
                    </span>
                  </div>
                  
                  {!isUploaded && onAddDocument && (
                    <button
                      type="button"
                      onClick={() => onAddDocument(name)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Upload className="h-3 w-3" />
                      Yükle
                    </button>
                  )}

                  {isUploaded && status?.uploadedAt && (
                    <span className="text-xs text-emerald-600">
                      {new Date(status.uploadedAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
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
