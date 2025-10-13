"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/portal/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-xl font-semibold text-slate-900">E-postanı kontrol et</h2>
        <p className="text-sm text-slate-500">
          Şifre sıfırlama bağlantısı (varsa) birkaç dakika içinde e-postana gönderilir.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Kayıtlı e-posta adresi
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
      </button>
    </form>
  );
}
