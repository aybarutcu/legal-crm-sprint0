export default function AdminPage() {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-2xl font-semibold text-slate-900">Admin Paneli</h2>
      <p className="text-sm text-slate-600">
        Bu sayfa yalnızca ADMIN rolündeki kullanıcılar tarafından görüntülenebilir.
      </p>
    </div>
  );
}
