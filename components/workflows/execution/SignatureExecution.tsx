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

  return (
    <div className="mt-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-4">
      <h5 className="mb-3 font-semibold text-indigo-900">Doküman İmzalama</h5>
      <div className="mb-3 rounded-lg border border-indigo-200 bg-white p-3">
        <p className="text-sm text-slate-700">
          <span className="font-medium">Doküman ID:</span> {documentId}
        </p>
        <p className="mt-1 text-xs text-slate-500">İmza sağlayıcı: {provider}</p>
      </div>
      <div className="mb-3 rounded-lg border-2 border-dashed border-indigo-300 bg-white p-4 text-center">
        <p className="text-sm text-slate-600">İmza alanı buraya gelecek</p>
        <p className="mt-1 text-xs text-slate-500">(Simüle edilmiş imza akışı)</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "İmzalanıyor..." : "✓ İmzala ve Tamamla"}
        </button>
      </div>
    </div>
  );
}
