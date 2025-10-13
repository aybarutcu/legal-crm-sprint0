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

  return (
    <section className="space-y-6" data-testid="contacts-page-client">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Contacts</h2>
          <p className="text-sm text-slate-500">
            Lead ve müşteri kayıtlarını filtreleyip yönetin.
          </p>
        </div>
        <NewContactDialog onCreated={handleContactCreated} />
      </div>

      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:grid-cols-5"
        method="get"
      >
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(CONTACT_PAGE_SIZE)} />
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Ara
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            type="search"
            name="q"
            defaultValue={filterState.q}
            placeholder="Ad, soyad veya e-posta"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Tip
          <select
            name="type"
            defaultValue={filterState.type}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {CONTACT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Durum
          <select
            name="status"
            defaultValue={filterState.status}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {CONTACT_STATUS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Sahip
          <select
            name="ownerId"
            defaultValue={filterState.ownerId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name ?? owner.email ?? owner.id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3 md:col-span-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Filtreleri Uygula
          </button>
          <Link
            href="/contacts?page=1"
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
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Soyad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Etiketler</th>
              <th className="px-4 py-3">Sahip</th>
              <th className="px-4 py-3">Oluşturma</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                data-testid={`contact-row-${contact.id}`}
                className="border-b border-slate-100 last:border-none hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{contact.lastName}</td>
                <td className="px-4 py-3 text-slate-600">
                  {contact.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {contact.type}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {contact.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {contact.tags.length ? (
                    contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="mr-2 inline-flex items-center rounded-full bg-accent/10 px-2 py-1 text-xs text-accent"
                      >
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {contact.owner?.name ?? contact.owner?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(contact.createdAt).toLocaleDateString("tr-TR")}
                </td>
              </tr>
            ))}
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
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
