import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/portal/PasswordResetForm";
import { PasswordResetRequestForm } from "@/components/portal/PasswordResetRequestForm";
import { getAuthSession } from "@/lib/auth";

type PasswordResetPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalPasswordResetPage({ searchParams }: PasswordResetPageProps) {
  const session = await getAuthSession();
  if (session?.user?.role === "CLIENT") {
    redirect("/portal");
  }

  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const hasToken = Boolean(token);

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
            {hasToken ? "Yeni Şifre Belirle" : "Şifre Sıfırlama"}
          </h1>
          <p className="text-sm text-slate-500">
            {hasToken
              ? "Yeni şifreni belirleyerek portal hesabına erişebilirsin."
              : "E-posta adresini yazarak şifre sıfırlama bağlantısı iste."
            }
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {hasToken && token ? <PasswordResetForm token={token} /> : <PasswordResetRequestForm />}
        {!hasToken ? (
          <p className="mt-6 text-center text-sm text-slate-500">
            Davet e-postasındaki bağlantı ile şifreni oluşturduysan{" "}
            <Link href="/portal/login" className="text-accent hover:underline">
              buradan giriş yap
            </Link>
            .
          </p>
        ) : null}
      </section>
    </main>
  );
}
