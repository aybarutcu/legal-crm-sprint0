"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentListItem } from "@/components/documents/types";
import { EditDocumentDialog } from "@/components/documents/EditDocumentDialog";
import { DocumentAccessScope } from "@prisma/client";
import { Edit } from "lucide-react";

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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [versions, setVersions] = useState<DocumentListItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [matters, setMatters] = useState<Array<{ id: string; title: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    setDocument(initialDocument ?? null);
    setTagsInput(initialDocument ? initialDocument.tags.join(", ") : "");
  }, [initialDocument?.id]);

  // Load matters and contacts for edit dialog
  useEffect(() => {
    if (!documentId) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [mattersRes, contactsRes] = await Promise.all([
          fetch("/api/matters"),
          fetch("/api/contacts"),
        ]);
        
        if (mattersRes.ok) {
          const mattersData = await mattersRes.json();
          setMatters(mattersData.matters || []);
        }
        
        if (contactsRes.ok) {
          const contactsData = await contactsRes.json();
          setContacts(contactsData.contacts || []);
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      } finally {
        setLoadingOptions(false);
      }
    };
    
    loadOptions();
  }, [documentId]);

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
      const targetId = document?.id || documentId;
      if (!targetId) throw new Error("Doküman bulunamadı.");
      if (!force && downloadUrlRef.current) {
        return downloadUrlRef.current;
      }

      setDownloadLoading(true);
      setDownloadError(null);
      try {
        const response = await fetch(`/api/documents/${targetId}/download`);
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
    [documentId, document?.id],
  );

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      setError(null);
      setVersions([]);
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
          displayName: payload.displayName,
          mime: payload.mime,
          size: payload.size,
          version: payload.version,
          tags: payload.tags ?? [],
          storageKey: payload.storageKey,
          hash: payload.hash ?? null,
          createdAt: payload.createdAt,
          signedAt: payload.signedAt ?? null,
          workflowStepId: payload.workflowStepId ?? null,
          folderId: payload.folderId ?? null,
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
        // Fetch versions
        fetchVersions(documentId);
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

    async function fetchVersions(docId: string) {
      setLoadingVersions(true);
      try {
        const response = await fetch(`/api/documents/${docId}/versions`);
        if (response.ok) {
          const data = await response.json();
          if (active) {
            setVersions(data.versions || []);
          }
        }
      } catch (err) {
        console.error("Failed to load versions", err);
      } finally {
        if (active) setLoadingVersions(false);
      }
    }

    fetchDetail();

    return () => {
      active = false;
    };
  }, [documentId, isPreviewableMime, loadDownloadUrl]);
  // Removed onUpdated from dependencies - it should only be called on actual updates, not fetches

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

  const handleDocumentUpdated = async (newDocumentId?: string) => {
    // If a new version was created, switch to viewing it
    const targetDocId = newDocumentId || documentId;
    if (!targetDocId) return;
    
    try {
      const response = await fetch(`/api/documents/${targetDocId}`);
      if (!response.ok) {
        throw new Error("Doküman detayları alınamadı.");
      }
      const payload = await response.json();
      const nextDocument: DocumentListItem = {
        id: payload.id,
        filename: payload.filename,
        displayName: payload.displayName,
        mime: payload.mime,
        size: payload.size,
        version: payload.version,
        tags: payload.tags ?? [],
        storageKey: payload.storageKey,
        hash: payload.hash ?? null,
        createdAt: payload.createdAt,
        signedAt: payload.signedAt ?? null,
        workflowStepId: payload.workflowStepId ?? null,
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
      onUpdated(nextDocument);
      
      // Reload versions
      const versionsRes = await fetch(`/api/documents/${targetDocId}/versions`);
      if (versionsRes.ok) {
        const data = await versionsRes.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error("Failed to refresh document:", err);
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
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {document?.displayName || document?.filename || "Doküman"}
            </h3>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Doküman Detayı
            </p>
          </div>
          <div className="flex items-center gap-2">
            {document && (
              <button
                type="button"
                onClick={() => setShowEditDialog(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Edit className="h-4 w-4" />
                Düzenle
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Kapat
            </button>
          </div>
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
                  {document.displayName && (
                    <div className="flex justify-between">
                      <dt className="font-medium text-slate-500">Display Name</dt>
                      <dd>{document.displayName}</dd>
                    </div>
                  )}
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

              {/* Versions Section - Read-only with download buttons */}
              {versions.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">
                    Versiyonlar ({versions.length})
                  </h4>
                  {loadingVersions ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Versiyonlar yükleniyor...
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {versions.map((ver) => (
                        <div
                          key={ver.id}
                          className={`flex items-center justify-between rounded-lg border p-3 ${
                            ver.id === document.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-mono">
                                v{ver.version}
                              </span>
                              {ver.id === document.id && (
                                <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-medium">
                                  Şu anki
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(ver.createdAt)} • {ver.uploader.name || ver.uploader.email}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {formatBytes(ver.size)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/documents/${ver.id}/download`);
                                  if (!response.ok) throw new Error("İndirme bağlantısı alınamadı.");
                                  const payload: { getUrl: string } = await response.json();
                                  window.open(payload.getUrl, "_blank", "noopener,noreferrer");
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "İndirme başarısız.");
                                }
                              }}
                              className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-100 transition"
                            >
                              İndir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

      {/* Edit Document Dialog */}
      {document && (
        <EditDocumentDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          document={{
            id: document.id,
            filename: document.filename,
            displayName: document.displayName || null,
            mimeType: document.mime,
            size: document.size,
            version: document.version,
            matterId: document.matter?.id,
            contactId: document.contact?.id,
            folderId: document.folderId,
            accessScope: (document as any).accessScope || "PUBLIC",
            accessMetadata: (document as any).accessMetadata,
            tags: document.tags || [],
          }}
          matters={matters}
          contacts={contacts}
          onSave={handleDocumentUpdated}
        />
      )}
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
