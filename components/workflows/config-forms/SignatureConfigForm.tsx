"use client";

interface SignatureConfigFormProps {
  initialConfig: {
    documentId?: string | null;
    provider?: string;
  };
  onChange: (config: { documentId: string | null; provider: string }) => void;
}

export function SignatureConfigForm({ initialConfig, onChange }: SignatureConfigFormProps) {
  const handleDocumentIdChange = (documentId: string) => {
    onChange({
      documentId: documentId.trim() || null,
      provider: initialConfig.provider ?? "mock",
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        İmzalanacak Belge ID
        <span className="ml-1 text-xs text-slate-500">(Sistem belge ID'si)</span>
      </label>
      <input
        type="text"
        value={initialConfig.documentId ?? ""}
        onChange={(e) => handleDocumentIdChange(e.target.value)}
        placeholder="Belge ID giriniz (opsiyonel)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <p className="text-xs text-slate-500">
        ℹ️ Eğer belirli bir belge için imza gerekiyorsa, belge ID'sini girin. Yoksa boş bırakın.
      </p>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
        <p className="text-xs font-medium text-indigo-900">İmza Sağlayıcı</p>
        <p className="mt-1 text-xs text-indigo-700">
          Şu an: <span className="font-mono font-semibold">{initialConfig.provider ?? "mock"}</span>
        </p>
        <p className="mt-1 text-xs text-indigo-600">
          (Gelecekte e-imza entegrasyonu eklenecek)
        </p>
      </div>
    </div>
  );
}
