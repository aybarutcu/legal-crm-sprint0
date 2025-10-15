"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentListItem } from "@/components/documents/types";

type DocumentDetailDrawerProps = {
  documentId: string | null;
  initialDocument?: DocumentListItem | null;
  onClose: () => void;
  onUpdated: (document: DocumentListItem) => void;
};

export function DocumentDetailDrawer({
  documentId,
  initialDocument,
  onClose,
  onUpdated,
}: DocumentDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentListItem | null>(
    initialDocument ?? null,
  );
  const [tagsInput, setTagsInput] = useState(
    initialDocument ? initialDocument.tags.join(", ") : "",
  );
  const [savingTags, setSavingTags] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setDocument(initialDocument ?? null);
    setTagsInput(initialDocument ? initialDocument.tags.join(", ") : "");
  }, [initialDocument?.id]);

  useEffect(() => {
    setDownloadUrl(null);
    setDownloadError(null);
    setDownloadLoading(false);
    downloadUrlRef.current = null;
  }, [documentId]);

  const isPreviewableMime = useCallback((mime: string) => {
    return mime.startsWith("application/pdf") || mime.startsWith("image/");
  }, []);

  const loadDownloadUrl = useCallback(
    async (force = false) => {
      if (!documentId) throw new Error("Doküman bulunamadı.");
      if (!force && downloadUrlRef.current) {
        return downloadUrlRef.current;
      }

      setDownloadLoading(true);
      setDownloadError(null);
      try {
        const response = await fetch(`/api/documents/${documentId}/download`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "İndirme bağlantısı oluşturulamadı.");
        }
        const payload: { getUrl: string } = await response.json();
        downloadUrlRef.current = payload.getUrl;
        setDownloadUrl(payload.getUrl);
        return payload.getUrl;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "İndirme bağlantısı alınamadı.";
        setDownloadError(message);
        downloadUrlRef.current = null;
        setDownloadUrl(null);
        throw err;
      } finally {
        setDownloadLoading(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      setError(null);
      return;
    }

    let active = true;

    async function fetchDetail() {
      if (!documentId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error("Doküman detayları alınamadı.");
        }
        const payload = await response.json();
        if (!active) return;
        const nextDocument: DocumentListItem = {
          id: payload.id,
          filename: payload.filename,
          mime: payload.mime,
          size: payload.size,
          version: payload.version,
          tags: payload.tags ?? [],
          storageKey: payload.storageKey,
          hash: payload.hash ?? null,
          createdAt: payload.createdAt,
          signedAt: payload.signedAt ?? null,
          matter: payload.matter
            ? { id: payload.matter.id, title: payload.matter.title }
            : null,
          contact: payload.contact
            ? {
              id: payload.contact.id,
              firstName: payload.contact.firstName,
              lastName: payload.contact.lastName,
            }
            : null,
          uploader: payload.uploader,
        };
        setDocument(nextDocument);
        setTagsInput(nextDocument.tags.join(", "));
        if (isPreviewableMime(nextDocument.mime)) {
          loadDownloadUrl().catch(() => { });
        }
        onUpdated(nextDocument);
      } catch (err) {
        if (!active) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Doküman detayları alınırken hata oluştu.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDetail();

    return () => {
      active = false;
    };
  }, [documentId, isPreviewableMime, loadDownloadUrl, onUpdated]);

  const previewContent = useMemo(() => {
    if (!document) return null;

    if (isPreviewableMime(document.mime)) {
      if (downloadLoading && !downloadUrl) {
        return (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            Önizleme hazırlanıyor...
          </div>
        );
      }

      if (downloadError) {
        return (
          <div className="flex h-64 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm text-rose-600">
            {downloadError}
          </div>
        );
      }

      if (!downloadUrl) {
        return (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            Önizleme hazırlanıyor...
          </div>
        );
      }

      if (document.mime.startsWith("image/")) {
        return (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <img
              src={downloadUrl}
              alt={document.filename}
              className="h-64 w-full object-contain bg-slate-50"
            />
          </div>
        );
      }

      return (
        <iframe
          title={document.filename}
          src={downloadUrl}
          className="h-64 w-full rounded-lg border border-slate-200"
        />
      );
    }

    if (downloadError) {
      return (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-center text-sm text-rose-600">
          {downloadError}
        </div>
      );
    }

    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
        <span>Önizleme desteklenmiyor.</span>
        <span>Dosyayı indirmek için aşağıdaki butonu kullanın.</span>
      </div>
    );
  }, [document, downloadError, downloadLoading, downloadUrl, isPreviewableMime]);

  if (!documentId) {
    return null;
  }

  const handleDownload = async () => {
    if (!documentId) return;
    try {
      const url = downloadUrlRef.current ?? (await loadDownloadUrl());
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "İndirme bağlantısı alınamadı.";
      setError(message);
    }
  };

  const handleSaveTags = async () => {
    if (!document) return;
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSavingTags(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Etiketler güncellenemedi.");
      }
      const updated = (await response.json()) as DocumentListItem;
      setDocument(updated);
      setTagsInput(updated.tags.join(", "));
      onUpdated(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Etiketler güncellenirken bir hata oluştu.",
      );
    } finally {
      setSavingTags(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Drawer overlay"
        onClick={onClose}
        className="flex-1 bg-slate-900/60"
      />
      <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {document?.filename ?? "Doküman"}
            </h3>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Doküman Detayı
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Kapat
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {loading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Detaylar yükleniyor...
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {previewContent}

          {document ? (
            <>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">
                  Meta Bilgiler
                </h4>
                <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Dosya adı</dt>
                    <dd>{document.filename}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">MIME</dt>
                    <dd>{document.mime}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Boyut</dt>
                    <dd>{formatBytes(document.size)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Versiyon</dt>
                    <dd>v{document.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Matter</dt>
                    <dd>{document.matter?.title ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">İlgili kişi</dt>
                    <dd>
                      {document.contact
                        ? `${document.contact.firstName} ${document.contact.lastName}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Yükleyen</dt>
                    <dd>
                      {document.uploader.name ??
                        document.uploader.email ??
                        document.uploader.id}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">Yüklendi</dt>
                    <dd>{formatDate(document.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-slate-500">SHA-256</dt>
                    <dd className="truncate text-right font-mono text-xs">
                      {document.hash ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700">
                  Etiketler
                </h4>
                <div className="mt-3 space-y-3">
                  <input
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="kanit,imza"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-accent focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {document.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        #{tag}
                      </span>
                    ))}
                    {document.tags.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        Etiket bulunmuyor.
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTags}
                    disabled={savingTags}
                    className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingTags ? "Kaydediliyor..." : "Etiketleri Kaydet"}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloadLoading}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadLoading ? "Hazırlanıyor..." : "İndir"}
                </button>
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-lg bg-accent px-4 py-2 text-center text-sm font-semibold text-white hover:bg-accent/90"
                  >
                    Yeni Sekmede Aç
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    console.error("Failed to format date", { value, error });
    return value;
  }
}
