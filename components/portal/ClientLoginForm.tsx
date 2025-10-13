"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function ClientLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/portal";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (response?.error) {
      setError("Giriş başarısız. E-posta veya şifreyi kontrol edin.");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-accent focus:outline-none"
        />
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
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>

      <div className="text-right text-sm">
        <Link href="/portal/password-reset" className="text-accent hover:underline">
          Şifremi unuttum
        </Link>
      </div>
    </form>
  );
}
