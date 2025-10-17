"use client";

interface ApprovalConfigFormProps {
  initialConfig: {
    message?: string;
    approverRole?: string;
  };
  onChange: (config: { message: string; approverRole: string }) => void;
}

export function ApprovalConfigForm({ initialConfig, onChange }: ApprovalConfigFormProps) {
  const handleMessageChange = (message: string) => {
    onChange({
      message,
      approverRole: initialConfig.approverRole ?? "LAWYER",
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Onay Mesajı
        <span className="ml-1 text-xs text-slate-500">(Onaylayıcıya gösterilecek açıklama)</span>
      </label>
      <textarea
        value={initialConfig.message ?? ""}
        onChange={(e) => handleMessageChange(e.target.value)}
        placeholder="Örn: Bu belgeyi gözden geçirip onaylayınız..."
        rows={4}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
      />
      <p className="text-xs text-slate-500">
        ℹ️ Bu mesaj avukata gösterilecektir. Onay/red kararı verirken kullanacağı bilgileri ekleyin.
      </p>
    </div>
  );
}
