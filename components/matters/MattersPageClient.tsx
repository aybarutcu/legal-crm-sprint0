"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MATTER_STATUS, MATTER_TYPES } from "@/lib/validation/matter";
import { MatterCreateDialog } from "@/components/matters/MatterCreateDialog";
import type {
  ContactOption,
  MatterListItem,
} from "@/components/matters/types";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Filters = {
  q?: string;
  status?: string;
  type?: string;
  clientId?: string;
};

type MattersPageClientProps = {
  matters: MatterListItem[];
  clients: ContactOption[];
  pagination: PaginationState;
  filters: Filters;
};

function buildQueryString(filters: Filters, overrides: { page?: number }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  if (filters.clientId) params.set("clientId", filters.clientId);
  params.set("page", String(overrides.page ?? 1));
  params.set("pageSize", "20");
  return `?${params.toString()}`;
}

export function MattersPageClient({ matters, clients, pagination, filters }: MattersPageClientProps) {
  const [items, setItems] = useState(matters);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setItems(matters);
  }, [matters]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filterState = useMemo(
    () => ({
      q: filters.q ?? "",
      status: filters.status ?? "",
      type: filters.type ?? "",
      clientId: filters.clientId ?? "",
    }),
    [filters],
  );

  const handleCreated = (matter: MatterListItem) => {
    setItems((prev) => [matter, ...prev]);
    setToast(`${matter.title} dava olarak eklendi.`);
  };

  return (
    <section className="space-y-6" data-testid="matters-page-client">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Matters</h2>
          <p className="text-sm text-slate-500">Davalarınızı filtreleyin, ilişkili tarafları yönetin.</p>
        </div>
        <MatterCreateDialog clients={clients} onCreated={handleCreated} />
      </div>

      <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:grid-cols-5" method="get">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value="20" />
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Ara
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            type="search"
            name="q"
            defaultValue={filterState.q}
            placeholder="Dava başlığı"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Durum
          <select
            name="status"
            defaultValue={filterState.status}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {MATTER_STATUS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Tür
          <select
            name="type"
            defaultValue={filterState.type}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {MATTER_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Müvekkil
          <select
            name="clientId"
            defaultValue={filterState.clientId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3 md:col-span-2">
          <button type="submit" className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
            Filtreleri Uygula
          </button>
          <Link
            href="/matters?page=1"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Temizle
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Başlık</th>
              <th className="px-4 py-3">Müvekkil</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3">Son Duruşma</th>
              <th className="px-4 py-3">Açılış</th>
            </tr>
          </thead>
          <tbody>
            {items.map((matter) => (
              <tr key={matter.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/matters/${matter.id}`} className="hover:underline">
                    {matter.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {matter.client?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {matter.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{matter.type}</td>
                <td className="px-4 py-3 text-slate-500">
                  {matter.nextHearingAt
                    ? dateTimeFormatter.format(new Date(matter.nextHearingAt))
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {dateFormatter.format(new Date(matter.openedAt))}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-card">
        <div>
          Sayfa {pagination.page} / {pagination.totalPages} · Toplam {pagination.total} kayıt
        </div>
        <div className="flex gap-3">
          <Link
            aria-disabled={!pagination.hasPrev}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            href={
              !pagination.hasPrev
                ? "#"
                : buildQueryString(filters, { page: pagination.page - 1 })
            }
          >
            Önceki
          </Link>
          <Link
            aria-disabled={!pagination.hasNext}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            href={
              !pagination.hasNext
                ? "#"
                : buildQueryString(filters, { page: pagination.page + 1 })
            }
          >
            Sonraki
          </Link>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
