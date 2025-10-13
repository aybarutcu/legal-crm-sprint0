import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivationForm } from "@/components/portal/ActivationForm";
import { getAuthSession } from "@/lib/auth";

type ActivatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalActivatePage({ searchParams }: ActivatePageProps) {
  const session = await getAuthSession();
  if (session?.user?.role === "CLIENT") {
    redirect("/portal");
  }

  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

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
          <h1 className="text-4xl font-semibold text-slate-900">Portal Davetini Aktifleştir</h1>
          <p className="text-sm text-slate-500">
            E-postanıza gelen daveti kullanarak şifrenizi belirleyin.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {token ? (
          <ActivationForm token={token} />
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="text-base font-medium text-slate-900">Geçerli bir davet bağlantısı bulunamadı.</p>
            <p>
              Davet e-postasındaki bağlantıyı tekrar deneyin veya sizi davet eden hukuk ekibinden yeni bir bağlantı isteyin.
            </p>
            <Link href="/portal/login" className="text-accent hover:underline">
              Giriş sayfasına geri dön
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
