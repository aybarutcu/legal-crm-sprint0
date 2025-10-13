"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const DEV_HINT =
  process.env.NODE_ENV !== "production"
    ? "Geliştirme ortamında herhangi bir e-posta ile giriş yapabilirsiniz."
    : "";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await signIn("credentials", {
      email,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (response?.error) {
      setError("Giriş başarısız. Lütfen e-posta adresini kontrol edin.");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Kurumsal e-posta
        </label>
        <input
          id="email"
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
          placeholder="senin@firma.com"
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
        />
        {DEV_HINT ? (
          <p className="text-xs text-slate-400">{DEV_HINT}</p>
        ) : null}
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
        {loading ? "Giriş yapılıyor..." : "Giriş yap"}
      </button>
    </form>
  );
}
