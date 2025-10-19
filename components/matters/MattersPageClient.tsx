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

  // Calculate stats
  const stats = useMemo(() => {
    const activeFilters = [
      filterState.q,
      filterState.status,
      filterState.type,
      filterState.clientId,
    ].filter(Boolean).length;

    return {
      total: pagination.total,
      showing: items.length,
      activeFilters,
      hasFilters: activeFilters > 0,
    };
  }, [pagination.total, items.length, filterState]);

  return (
    <section className="space-y-6" data-testid="matters-page-client">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Matters</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Davalarınızı filtreleyin, ilişkili tarafları yönetin.
          </p>
        </div>
        <MatterCreateDialog clients={clients} onCreated={handleCreated} />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Matters</div>
          <div className="text-2xl font-bold text-slate-900">{pagination.total}</div>
          <div className="text-xs text-slate-500 mt-1">All cases</div>
        </div>
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Showing</div>
          <div className="text-2xl font-bold text-blue-900">{stats.showing}</div>
          <div className="text-xs text-blue-600 mt-1">On this page</div>
        </div>
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-4 shadow-sm">
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Page</div>
          <div className="text-2xl font-bold text-purple-900">{pagination.page} / {pagination.totalPages}</div>
          <div className="text-xs text-purple-600 mt-1">Current position</div>
        </div>
        <div className={`rounded-xl border-2 p-4 shadow-sm ${
          stats.hasFilters 
            ? 'border-amber-200 bg-amber-50/50' 
            : 'border-emerald-200 bg-emerald-50/50'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            stats.hasFilters ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            Filters
          </div>
          <div className={`text-2xl font-bold ${
            stats.hasFilters ? 'text-amber-900' : 'text-emerald-900'
          }`}>
            {stats.activeFilters}
          </div>
          <div className={`text-xs mt-1 ${
            stats.hasFilters ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {stats.hasFilters ? 'Active filters' : 'No filters'}
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <form className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-lg" method="get">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value="20" />
        
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Search Matters
            </span>
            <input
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              type="search"
              name="q"
              defaultValue={filterState.q}
              placeholder="Dava başlığı..."
            />
          </label>
          
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Status
            </span>
            <select
              name="status"
              defaultValue={filterState.status}
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
            >
              <option value="">All Statuses</option>
              {MATTER_STATUS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Type
            </span>
            <select
              name="type"
              defaultValue={filterState.type}
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
            >
              <option value="">All Types</option>
              {MATTER_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Client
            </span>
            <select
              name="clientId"
              defaultValue={filterState.clientId}
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-6 border-t-2 border-slate-200">
          <button 
            type="submit" 
            className="flex-1 md:flex-none rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white hover:bg-accent/90 shadow-sm hover:shadow-md transition-all"
          >
            Apply Filters
          </button>
          <Link
            href="/matters?page=1"
            className="rounded-lg border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Clear All
          </Link>
        </div>
      </form>

      {/* Matters Table */}
      <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white shadow-lg">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-xs uppercase tracking-widest text-slate-600">
            <tr>
              <th className="px-4 py-3.5 font-bold">Başlık</th>
              <th className="px-4 py-3.5 font-bold">Müvekkil</th>
              <th className="px-4 py-3.5 font-bold">Durum</th>
              <th className="px-4 py-3.5 font-bold">Tür</th>
              <th className="px-4 py-3.5 font-bold">Son Duruşma</th>
              <th className="px-4 py-3.5 font-bold">Açılış</th>
            </tr>
          </thead>
          <tbody>
            {items.map((matter) => (
              <tr key={matter.id} className="border-b border-slate-100 last:border-none hover:bg-accent/5 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-slate-900">
                  <Link href={`/matters/${matter.id}`} className="hover:text-accent hover:underline transition-colors">
                    {matter.title}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {matter.client?.name ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                    {matter.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                    {matter.type}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-slate-500">
                  {matter.nextHearingAt
                    ? dateTimeFormatter.format(new Date(matter.nextHearingAt))
                    : "—"}
                </td>
                <td className="px-4 py-3.5 text-slate-500">
                  {dateFormatter.format(new Date(matter.openedAt))}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">⚖️</div>
                    <div>
                      <div className="text-base font-semibold text-slate-900">No matters found</div>
                      <div className="text-sm text-slate-600 mt-1">Try adjusting your search or filter criteria</div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-lg">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Page {pagination.page}</span> of {pagination.totalPages}
          <span className="text-slate-400 mx-2">•</span>
          <span className="font-semibold text-slate-900">{pagination.total}</span> total matters
        </div>
        <div className="flex gap-2">
          <Link
            aria-disabled={!pagination.hasPrev}
            className="rounded-lg border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-white aria-disabled:hover:border-slate-200 transition-all shadow-sm"
            href={
              !pagination.hasPrev
                ? "#"
                : buildQueryString(filters, { page: pagination.page - 1 })
            }
          >
            ← Previous
          </Link>
          <Link
            aria-disabled={!pagination.hasNext}
            className="rounded-lg border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-white aria-disabled:hover:border-slate-200 transition-all shadow-sm"
            href={
              !pagination.hasNext
                ? "#"
                : buildQueryString(filters, { page: pagination.page + 1 })
            }
          >
            Next →
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
