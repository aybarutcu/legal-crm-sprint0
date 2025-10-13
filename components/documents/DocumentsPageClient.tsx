"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ContactOption,
  DocumentListItem,
  MatterOption,
  UploaderOption,
} from "@/components/documents/types";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

type Filters = {
  q?: string;
  matterId?: string;
  contactId?: string;
  uploaderId?: string;
  tags?: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type DocumentsPageClientProps = {
  documents: DocumentListItem[];
  matters: MatterOption[];
  contacts: ContactOption[];
  uploaders: UploaderOption[];
  pagination: PaginationState;
  filters: Filters;
  maxUploadBytes: number;
};

export function DocumentsPageClient({
  documents,
  matters,
  contacts,
  uploaders,
  pagination,
  filters,
  maxUploadBytes,
}: DocumentsPageClientProps) {
  const [items, setItems] = useState(documents);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);

  useEffect(() => {
    setItems(documents);
  }, [documents]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filterState = useMemo(
    () => ({
      q: filters.q ?? "",
      matterId: filters.matterId ?? "",
      contactId: filters.contactId ?? "",
      uploaderId: filters.uploaderId ?? "",
      tags: filters.tags ?? "",
    }),
    [filters],
  );

  const handleCreated = (item: DocumentListItem) => {
    setItems((prev) => [item, ...prev]);
    setToast({ message: "Doküman listesi güncellendi.", variant: "success" });
  };

  const handleUpdated = useCallback((updated: DocumentListItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    setSelectedDocument((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    setToast({ message: "Doküman güncellendi.", variant: "success" });
  }, []);

  const openDetail = useCallback((doc: DocumentListItem) => {
    setSelectedDocumentId(doc.id);
    setSelectedDocument(doc);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedDocumentId(null);
    setSelectedDocument(null);
  }, []);

  const handleDownload = async (doc: DocumentListItem) => {
    setDownloadingId(doc.id);
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) {
        throw new Error("İndirme bağlantısı alınamadı.");
      }

      const payload: { getUrl: string; mime: string } = await response.json();
      const mime = payload.mime ?? doc.mime;
      if (mime.startsWith("application/pdf") || mime.startsWith("image/")) {
        window.open(payload.getUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = payload.getUrl;
      }
    } catch (error) {
      console.error(error);
      setToast({
        message: "İndirme bağlantısı oluşturulamadı.",
        variant: "error",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const buildSearchParams = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filterState.q) params.set("q", filterState.q);
    if (filterState.matterId) params.set("matterId", filterState.matterId);
    if (filterState.contactId) params.set("contactId", filterState.contactId);
    if (filterState.uploaderId) params.set("uploaderId", filterState.uploaderId);
    if (filterState.tags) params.set("tags", filterState.tags);
    params.set("page", String(targetPage));
    params.set("pageSize", String(pagination.pageSize));
    return params.toString();
  };

  return (
    <section className="space-y-6" data-testid="documents-page-client">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-500">
            Doküman yükleme, sürümleme ve filtreleme.
          </p>
        </div>
        <DocumentUploadDialog
          matters={matters}
          contacts={contacts}
          maxUploadBytes={maxUploadBytes}
          onCreated={handleCreated}
        />
      </div>

      <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:grid-cols-6" method="get">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Ara
          <input
            type="search"
            name="q"
            defaultValue={filterState.q}
            placeholder="Dosya adı veya etiket"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Matter
          <select
            name="matterId"
            defaultValue={filterState.matterId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Contact
          <select
            name="contactId"
            defaultValue={filterState.contactId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Uploader
          <select
            name="uploaderId"
            defaultValue={filterState.uploaderId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {uploaders.map((uploader) => (
              <option key={uploader.id} value={uploader.id}>
                {uploader.name ?? uploader.email ?? uploader.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Etiketler
          <input
            name="tags"
            defaultValue={filterState.tags}
            placeholder="kanit,imza"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex items-end gap-3 md:col-span-2">
          <button type="submit" className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
            Filtreleri Uygula
          </button>
          <Link
            href="/documents?page=1"
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
              <th className="px-4 py-3">Dosya</th>
              <th className="px-4 py-3">Matter</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Versiyon</th>
              <th className="px-4 py-3">Boyut</th>
              <th className="px-4 py-3">Yükleyen</th>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => openDetail(doc)}
                className="cursor-pointer border-b border-slate-100 last:border-none transition hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {doc.filename}
                  {doc.tags.length ? (
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-400">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{doc.matter?.title ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {doc.contact ? `${doc.contact.firstName} ${doc.contact.lastName}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">v{doc.version}</td>
                <td className="px-4 py-3 text-slate-600">{formatBytes(doc.size)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {doc.uploader.name ?? doc.uploader.email ?? doc.uploader.id}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {dateFormatter.format(new Date(doc.createdAt))}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownload(doc);
                    }}
                    disabled={downloadingId === doc.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingId === doc.id
                      ? "Hazırlanıyor..."
                      : doc.mime.startsWith("application/pdf") || doc.mime.startsWith("image/")
                        ? "Önizle"
                        : "İndir"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
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
                : `/documents?${buildSearchParams(pagination.page - 1)}`
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
                : `/documents?${buildSearchParams(pagination.page + 1)}`
            }
          >
            Sonraki
          </Link>
        </div>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.variant === "error" ? "bg-rose-600" : "bg-emerald-600"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <DocumentDetailDrawer
        documentId={selectedDocumentId}
        initialDocument={selectedDocument}
        onClose={closeDetail}
        onUpdated={handleUpdated}
      />
    </section>
  );
}
