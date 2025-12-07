"use client";

interface SignatureExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: () => void;
  isLoading: boolean;
}

export function SignatureExecution({
  step,
  onComplete,
  isLoading,
}: SignatureExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const documentId = (config?.documentId as string) ?? "";
  const provider = (config?.provider as string) ?? "mock";
  
  const hasDocument = documentId && documentId !== "" && documentId !== "Otomatik seçilecek";

  return (
    <div className="mt-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-4">
      <h5 className="mb-3 font-semibold text-indigo-900">Doküman İmzalama</h5>
      
      {!hasDocument ? (
        <div className="mb-3 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 mb-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Doküman Seçilmemiş</span>
          </div>
          <p className="text-sm text-amber-700">
            İmzalama işlemi için önce bir doküman seçmeniz veya yüklemeniz gerekir.
          </p>
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-indigo-200 bg-white p-3">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Doküman ID:</span> {documentId}
          </p>
          <p className="mt-1 text-xs text-slate-500">İmza sağlayıcı: {provider}</p>
        </div>
      )}
      
      <div className="mb-3 rounded-lg border-2 border-dashed border-indigo-300 bg-white p-4 text-center">
        <p className="text-sm text-slate-600">İmza alanı buraya gelecek</p>
        <p className="mt-1 text-xs text-slate-500">(Simüle edilmiş imza akışı)</p>
      </div>
      
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={isLoading || !hasDocument}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "İmzalanıyor..." : "✓ İmzala ve Tamamla"}
        </button>
        
        {!hasDocument && (
          <button
            type="button"
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Doküman Seç
          </button>
        )}
      </div>
    </div>
  );
}
