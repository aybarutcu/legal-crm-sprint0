"use client";

interface ApprovalExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  comment: string;
  onCommentChange: (comment: string) => void;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
  isLoading: boolean;
}

export function ApprovalExecution({
  step,
  comment,
  onCommentChange,
  onApprove,
  onReject,
  isLoading,
}: ApprovalExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const message = (config?.message as string) ?? "";

  return (
    <div className="mt-3 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-4">
      <h5 className="mb-3 font-semibold text-purple-900">Avukat Onayı Gerekli</h5>
      {message && (
        <div className="mb-3 rounded-lg border border-purple-200 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      )}
      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Yorum ekleyin (opsiyonel)..."
        className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        rows={3}
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onApprove(comment)}
          disabled={isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "İşleniyor..." : "✓ Onayla"}
        </button>
        <button
          type="button"
          onClick={() => onReject(comment)}
          disabled={isLoading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? "İşleniyor..." : "✗ Reddet"}
        </button>
      </div>
    </div>
  );
}
