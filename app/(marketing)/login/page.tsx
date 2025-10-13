import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAuthSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session?.user) {
    return redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-12 px-6 py-24">
      <div className="space-y-4 text-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent"
        >
          Legal CRM
        </Link>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-slate-900">
            Hesabınıza giriş yapın
          </h1>
          <p className="text-sm text-slate-500">
            Yetkili kullanıcılar için kontrol paneli erişimi.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <LoginForm />
      </section>
    </main>
  );
}
