"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { CONTACT_PAGE_SIZE, CONTACT_STATUS, CONTACT_TYPES } from "@/lib/validation/contact";
import { NewContactDialog } from "@/components/contact/new-contact-dialog";
import type { ContactListItem } from "@/components/contact/types";

type OwnerOption = {
  id: string;
  name: string | null;
  email: string | null;
};

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
  type?: string;
  status?: string;
  ownerId?: string;
};

type ContactsPageClientProps = {
  initialContacts: ContactListItem[];
  owners: OwnerOption[];
  initialPagination: PaginationState;
  filters: Filters;
};

function buildQueryString(filters: Filters, overrides: { page?: number }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);
  params.set("page", String(overrides.page ?? 1));
  params.set("pageSize", String(CONTACT_PAGE_SIZE));
  return `?${params.toString()}`;
}

export function ContactsPageClient({
  initialContacts,
  owners,
  initialPagination,
  filters,
}: ContactsPageClientProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [pagination, setPagination] = useState(initialPagination);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setContacts(initialContacts);
    setPagination(initialPagination);
  }, [initialContacts, initialPagination]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filterState = useMemo(
    () => ({
      q: filters.q ?? "",
      type: filters.type ?? "",
      status: filters.status ?? "",
      ownerId: filters.ownerId ?? "",
    }),
    [filters],
  );

  const handleContactCreated = (contact: ContactListItem) => {
    setContacts((prev) => {
      const existing = prev.filter((item) => item.id !== contact.id);
      return [contact, ...existing].slice(0, pagination.pageSize);
    });
    setPagination((prev) => {
      const newTotal = prev.total + 1;
      return {
        ...prev,
        total: newTotal,
        totalPages: Math.max(1, Math.ceil(newTotal / prev.pageSize)),
        hasNext: newTotal > prev.pageSize,
      };
    });
    setToast(`${contact.firstName} ${contact.lastName} başarıyla eklendi.`);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const activeFilters = [
      filterState.q,
      filterState.type,
      filterState.status,
      filterState.ownerId,
    ].filter(Boolean).length;

    return {
      total: pagination.total,
      showing: contacts.length,
      activeFilters,
      hasFilters: activeFilters > 0,
    };
  }, [pagination.total, contacts.length, filterState]);

  return (
    <section className="space-y-6" data-testid="contacts-page-client">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Contacts</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Lead ve müşteri kayıtlarını filtreleyip yönetin.
          </p>
        </div>
        <NewContactDialog onCreated={handleContactCreated} />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Contacts</div>
          <div className="text-2xl font-bold text-slate-900">{pagination.total}</div>
          <div className="text-xs text-slate-500 mt-1">All records</div>
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
      <form
        className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-lg"
        method="get"
      >
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(CONTACT_PAGE_SIZE)} />
        
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Search Contacts
            </span>
            <input
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              type="search"
              name="q"
              defaultValue={filterState.q}
              placeholder="Ad, soyad veya e-posta..."
            />
          </label>
          
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Contact Type
            </span>
            <select
              name="type"
              defaultValue={filterState.type}
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
            >
              <option value="">All Types</option>
              {CONTACT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
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
              {CONTACT_STATUS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Owner
            </span>
            <select
              name="ownerId"
              defaultValue={filterState.ownerId}
              className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
            >
              <option value="">All Owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name ?? owner.email ?? owner.id}
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
            href="/contacts?page=1"
            className="rounded-lg border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Clear All
          </Link>
        </div>
      </form>

      {/* Contacts Table */}
      <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white shadow-lg">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-xs uppercase tracking-widest text-slate-600">
            <tr>
              <th className="px-4 py-3.5 font-bold">Ad</th>
              <th className="px-4 py-3.5 font-bold">Soyad</th>
              <th className="px-4 py-3.5 font-bold">E-posta</th>
              <th className="px-4 py-3.5 font-bold">Tip</th>
              <th className="px-4 py-3.5 font-bold">Durum</th>
              <th className="px-4 py-3.5 font-bold">Etiketler</th>
              <th className="px-4 py-3.5 font-bold">Sahip</th>
              <th className="px-4 py-3.5 font-bold">Oluşturma</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                data-testid={`contact-row-${contact.id}`}
                className="border-b border-slate-100 last:border-none hover:bg-accent/5 transition-colors"
              >
                <td className="px-4 py-3.5 font-semibold text-slate-900">
                  <Link href={`/contacts/${contact.id}`} className="hover:text-accent hover:underline transition-colors">
                    {contact.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-slate-700">{contact.lastName}</td>
                <td className="px-4 py-3.5 text-slate-600">
                  {contact.email ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                    {contact.type}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                    {contact.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {contact.tags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent border border-accent/20"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {contact.owner?.name ?? contact.owner?.email ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-slate-500">
                  {new Date(contact.createdAt).toLocaleDateString("tr-TR")}
                </td>
              </tr>
            ))}
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">📭</div>
                    <div>
                      <div className="text-base font-semibold text-slate-900">No contacts found</div>
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
          <span className="font-semibold text-slate-900">{pagination.total}</span> total contacts
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
