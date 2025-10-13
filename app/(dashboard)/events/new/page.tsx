export default function NewEventPage() {
  return (
    <section className="mx-auto max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Yeni Event</h2>
        <p className="text-sm text-slate-500">
          OAuth ile Google Calendar yetkisi alındıktan sonra webhook/polling
          altyapısı buradan tetiklenecek.
        </p>
      </div>

      <form className="space-y-4 text-sm text-slate-600">
        <label className="grid gap-1">
          <span className="font-semibold text-slate-700">Başlık</span>
          <input
            type="text"
            placeholder="Duruşma hazırlığı"
            className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-slate-700">Başlangıç</span>
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-slate-700">Bitiş</span>
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          Kaydet
        </button>
      </form>
    </section>
  );
}
