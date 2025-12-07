import Link from "next/link";
import { 
  Scale, 
  Users, 
  FileText, 
  Calendar, 
  Shield, 
  Workflow, 
  Lock, 
  CheckCircle,
  BarChart3,
  Clock,
  Globe,
  Zap
} from "lucide-react";

// Force dynamic rendering to avoid build-time issues
export const dynamic = 'force-dynamic';

export default function MarketingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <Zap className="h-4 w-4" />
              Modern Hukuk Bürosu Yönetimi
            </span>
            <h1 className="mt-8 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Hukuk Büronuz için
              <span className="block text-blue-200">Akıllı CRM Çözümü</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-blue-100">
              Dava takibi, müvekkil yönetimi, doküman kontrolü ve iş akışı otomasyonu 
              ile hukuk büronuzu dijital dönüşüme taşıyın.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-700 shadow-xl transition hover:bg-blue-50 hover:shadow-2xl"
              >
                Kontrol Paneline Git
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/portal/login"
                className="flex items-center gap-2 rounded-lg border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Users className="h-5 w-5" />
                Müşteri Portalı
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tüm İhtiyaçlarınız Tek Platformda
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Hukuk bürolarının ihtiyaç duyduğu tüm araçlar, modern ve kullanıcı dostu bir arayüzde
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Scale,
                title: "Dava Yönetimi",
                description: "Tüm davalarınızı tek bir yerden takip edin. Duruşma tarihleri, evraklar ve notlar için merkezi platform.",
                color: "bg-blue-500"
              },
              {
                icon: Users,
                title: "Müvekkil Takibi",
                description: "Lead'lerden müşterilere kadar tüm süreç yönetimi. İletişim geçmişi ve doküman arşivi.",
                color: "bg-green-500"
              },
              {
                icon: FileText,
                title: "Doküman Yönetimi",
                description: "Versiyon kontrolü, erişim yönetimi ve güvenli depolama ile tüm evraklarınız her zaman elinizin altında.",
                color: "bg-purple-500"
              },
              {
                icon: Calendar,
                title: "Akıllı Takvim",
                description: "Google Calendar entegrasyonu, duruşma hatırlatmaları ve ekip üyelerinin müsaitlik takibi.",
                color: "bg-orange-500"
              },
              {
                icon: Workflow,
                title: "İş Akışı Otomasyonu",
                description: "Tekrarlayan işlemleri otomatikleştirin. Onay süreçleri, imza toplama ve görev atamaları.",
                color: "bg-indigo-500"
              },
              {
                icon: Shield,
                title: "Kurumsal Güvenlik",
                description: "RBAC, audit log ve şifreli veri depolama ile en üst düzey güvenlik standartları.",
                color: "bg-red-500"
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-xl"
              >
                <div className={`inline-flex rounded-lg ${feature.color} p-3 text-white`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Güçlü İş Akışı Motoru
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Karmaşık süreçleri görsel editör ile kolayca tasarlayın ve otomatikleştirin
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Onay Süreçleri</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Belge onayları, bütçe onayları ve diğer kritik kararlar için otomatik akışlar
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Doküman Talepleri</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Müvekkillerden otomatik doküman toplama, hatırlatmalar ve takip
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                  <Lock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Dijital İmza</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Sözleşme ve belgelerin dijital olarak imzalanması için entegre çözüm
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Otomasyonlar</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    E-posta bildirimleri, webhook entegrasyonları ve özel otomasyon senaryoları
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
              <div className="space-y-4">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-slate-700">Yeni Müvekkil Kaydı</span>
                  </div>
                </div>
                <div className="ml-4 border-l-2 border-slate-300 pl-4 space-y-4">
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-slate-700">Sözleşme İmzalama</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                      <span className="text-sm font-medium text-slate-700">Evrak Toplama</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                      <span className="text-sm font-medium text-slate-700">Ödeme Talebi</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-900 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { icon: Clock, label: "Zaman Tasarrufu", value: "40%" },
              { icon: BarChart3, label: "Verimlilik Artışı", value: "60%" },
              { icon: Globe, label: "Her Yerden Erişim", value: "7/24" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                  <stat.icon className="h-8 w-8 text-blue-400" />
                </div>
                <div className="mt-4 text-4xl font-bold text-white">{stat.value}</div>
                <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Hemen Başlayın
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Dijital dönüşüm yolculuğunuza bugün başlayın. Demo hesabı ile tüm özellikleri keşfedin.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-700 shadow-xl transition hover:bg-blue-50"
            >
              Ücretsiz Deneyin
            </Link>
            <Link
              href="/api-docs"
              className="rounded-lg border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              API Dokümantasyonu
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>© 2025 Legal CRM. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
