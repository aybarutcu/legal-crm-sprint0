import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-24">
      <section className="space-y-6 text-center">
        <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
          Sprint 0 Kickoff
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Legal CRM ile dava, müşteri ve dokümanlarınızı tek yerden yönetin
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          Takvim senkronu, doküman yükleme, notlar ve görevlerle hukuk bürosu
          operasyonlarını hızlandırın. RBAC ile güvenli erişim, Postgres +
          Prisma ile sağlam veri katmanı.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-md shadow-accent/30 transition hover:bg-accent/90"
          >
            Kontrol Paneline Git
          </Link>
          <Link
            href="/portal/login"
            className="rounded-lg border border-accent px-6 py-3 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            Müşteri Portalı
          </Link>
          <Link
            href="/api-docs"
            className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            API Dokümantasyonu
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            Giriş Yap
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Müşteri ve Dava Yönetimi",
            description:
              "Leads, müşteriler, davalar ve notları tek ekranda takip edin, ilgili dokümanları ilişkilendirin.",
          },
          {
            title: "Entegre Takvim",
            description:
              "Google Calendar entegrasyonu ve yaklaşan duruşma hatırlatmaları ile planlı kalın.",
          },
          {
            title: "Güvenlik Öncelikli",
            description:
              "RBAC, audit log ve S3 tabanlı doküman depolama ile regülasyon uyumlu altyapı.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-card"
          >
            <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
