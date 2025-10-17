"use client";

interface DocumentRequestExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  onComplete: (documentId: string) => void;
  isLoading: boolean;
}

export function DocumentRequestExecution({
  step,
  selectedFile,
  onFileChange,
  onComplete,
  isLoading,
}: DocumentRequestExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const requestText = (config?.requestText as string) ?? "";
  const documentNames = (config?.documentNames as string[]) ?? [];

  return (
    <div className="mt-3 rounded-lg border-2 border-orange-200 bg-orange-50/50 p-4">
      <h5 className="mb-3 font-semibold text-orange-900">Doküman Yükleme Talebi</h5>
      <div className="mb-3 rounded-lg border border-orange-200 bg-white p-3 text-sm text-slate-700">
        {requestText}
      </div>
      {documentNames.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-slate-700">İstenilen Belgeler:</p>
          <div className="flex flex-wrap gap-1">
            {documentNames.map((name, index) => (
              <span 
                key={index}
                className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 border border-orange-200"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mb-3">
        <input
          type="file"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
        {selectedFile && (
          <p className="mt-2 text-xs text-slate-600">
            Seçili dosya: <span className="font-medium">{selectedFile.name}</span>
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            // In a real implementation, upload the file first, then complete with documentId
            onComplete("doc-" + Date.now());
          }}
          disabled={!selectedFile || isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "Yükleniyor..." : "✓ Yükle ve Tamamla"}
        </button>
      </div>
    </div>
  );
}
