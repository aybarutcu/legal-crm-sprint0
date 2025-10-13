"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteClientButtonProps = {
  fullName: string;
  email: string | null;
  disabledReason?: string | null;
  isActivated: boolean;
  hasInvite: boolean;
};

export function InviteClientButton({
  fullName,
  email,
  disabledReason,
  isActivated,
  hasInvite,
}: InviteClientButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteDisabled = loading || isActivated || !email || Boolean(disabledReason);

  async function handleInvite() {
    if (inviteDisabled) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/clients/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: fullName.trim().length > 0 ? fullName : email,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Davet gönderilemedi.");
      }

      setMessage("Davet e-postası gönderildi.");
      router.refresh();
    } catch (inviteError) {
      console.error(inviteError);
      setError(inviteError instanceof Error ? inviteError.message : "İşlem başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }

  const label = isActivated
    ? "Portal Aktif"
    : hasInvite
      ? "Daveti Yeniden Gönder"
      : "Portal Daveti Gönder";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleInvite}
        disabled={inviteDisabled}
        className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        {loading ? "Gönderiliyor..." : label}
      </button>
      {disabledReason ? (
        <p className="text-xs text-slate-500">{disabledReason}</p>
      ) : null}
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
