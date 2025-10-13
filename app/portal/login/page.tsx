import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/portal/ClientLoginForm";
import { getAuthSession } from "@/lib/auth";

export default async function PortalLoginPage() {
  const session = await getAuthSession();

  if (session?.user) {
    if (session.user.role === "CLIENT") {
      redirect("/portal");
    }
    redirect("/dashboard");
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
          <h1 className="text-4xl font-semibold text-slate-900">İstemci Portalı Girişi</h1>
          <p className="text-sm text-slate-500">
            Müvekkil hesabınızla davalarınızı görüntüleyin ve ekibinizle iletişimde kalın.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <ClientLoginForm />
      </section>
    </main>
  );
}
