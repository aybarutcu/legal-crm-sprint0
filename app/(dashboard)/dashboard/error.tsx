"use client";

export default function DashboardError({ error }: { error: Error }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      Dashboard verileri yüklenirken hata oluştu: {error.message}
    </div>
  );
}
