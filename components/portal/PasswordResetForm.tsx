"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

type PasswordResetFormProps = {
  token: string;
};

export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/portal/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Şifre sıfırlanamadı.");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/portal/login");
      }, 2500);
    } catch (resetError) {
      console.error(resetError);
      setError("Şifre sıfırlama sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Şifren güncellendi</h2>
        <p className="text-sm text-slate-500">
          Artık yeni şifrenle giriş yapabilirsin. Az sonra giriş sayfasına yönlendirileceksin.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Yeni şifre
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Yeni şifre (tekrar)
          <input
            type="password"
            required
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
      </button>
    </form>
  );
}
