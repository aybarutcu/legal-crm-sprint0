"use client";

interface PaymentConfigFormProps {
  initialConfig: {
    amount?: number;
    currency?: string;
    provider?: string;
  };
  onChange: (config: { amount: number; currency: string; provider: string }) => void;
}

export function PaymentConfigForm({ initialConfig, onChange }: PaymentConfigFormProps) {
  const handleAmountChange = (amount: string) => {
    const numericAmount = parseFloat(amount) || 0;
    onChange({
      amount: numericAmount,
      currency: initialConfig.currency ?? "TRY",
      provider: initialConfig.provider ?? "mock",
    });
  };

  const handleCurrencyChange = (currency: string) => {
    onChange({
      amount: initialConfig.amount ?? 0,
      currency,
      provider: initialConfig.provider ?? "mock",
    });
  };

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Ödeme Tutarı *
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={initialConfig.amount ?? 0}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        />
      </div>

      {/* Currency */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Para Birimi
        </label>
        <select
          value={initialConfig.currency ?? "TRY"}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        >
          <option value="TRY">TRY (₺)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
        </select>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-green-100 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-900">Önizleme</p>
        <p className="mt-2 text-2xl font-bold text-green-900">
          {new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: initialConfig.currency ?? "TRY",
          }).format(initialConfig.amount ?? 0)}
        </p>
        <p className="mt-2 text-xs text-green-700">
          Müvekkil bu tutarı ödeyecektir.
        </p>
      </div>

      {/* Provider Info */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-900">Ödeme Sağlayıcı</p>
        <p className="mt-1 text-xs text-slate-600">
          Şu an: <span className="font-mono font-semibold">{initialConfig.provider ?? "mock"}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          (Gelecekte gerçek ödeme entegrasyonu eklenecek)
        </p>
      </div>
    </div>
  );
}
