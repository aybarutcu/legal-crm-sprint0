"use client";

interface PaymentExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: () => void;
  isLoading: boolean;
}

export function PaymentExecution({
  step,
  onComplete,
  isLoading,
}: PaymentExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const amount = (config?.amount as number) ?? 0;
  const currency = (config?.currency as string) ?? "USD";
  const provider = (config?.provider as string) ?? "mock";

  const formattedAmount = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency,
  }).format(amount);

  return (
    <div className="mt-3 rounded-lg border-2 border-green-200 bg-green-50/50 p-4">
      <h5 className="mb-3 font-semibold text-green-900">Ödeme</h5>
      <div className="mb-3 rounded-lg border border-green-200 bg-white p-4">
        <p className="text-2xl font-bold text-green-900">{formattedAmount}</p>
        <p className="mt-1 text-xs text-slate-500">Ödeme sağlayıcı: {provider}</p>
      </div>
      <div className="mb-3 rounded-lg border-2 border-dashed border-green-300 bg-white p-4 text-center">
        <p className="text-sm text-slate-600">Ödeme formu buraya gelecek</p>
        <p className="mt-1 text-xs text-slate-500">(Simüle edilmiş ödeme akışı)</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "İşleniyor..." : "✓ Ödemeyi Tamamla"}
        </button>
      </div>
    </div>
  );
}
