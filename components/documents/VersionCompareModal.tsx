"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import type { DocumentListItem } from "./types";

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDocument: DocumentListItem;
  compareVersionId: string;
}

export function VersionCompareModal({
  isOpen,
  onClose,
  currentDocument,
  compareVersionId,
}: VersionCompareModalProps) {
  const [compareDocument, setCompareDocument] = useState<DocumentListItem | null>(null);
  const [currentDownloadUrl, setCurrentDownloadUrl] = useState<string | null>(null);
  const [compareDownloadUrl, setCompareDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCompareDocument(null);
      setCurrentDownloadUrl(null);
      setCompareDownloadUrl(null);
      setError(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch compare version document
        const docRes = await fetch(`/api/documents/${compareVersionId}`);
        if (!docRes.ok) throw new Error("Versiyon detayları alınamadı");
        const docData = await docRes.json();
        
        const compareDoc: DocumentListItem = {
          id: docData.id,
          filename: docData.filename,
          displayName: docData.displayName,
          mime: docData.mime,
          size: docData.size,
          version: docData.version,
          tags: docData.tags ?? [],
          storageKey: docData.storageKey,
          hash: docData.hash ?? null,
          createdAt: docData.createdAt,
          signedAt: docData.signedAt ?? null,
          workflowStepId: docData.workflowStepId ?? null,
          folderId: docData.folderId ?? null,
          matter: docData.matter
            ? { id: docData.matter.id, title: docData.matter.title }
            : null,
          contact: docData.contact
            ? {
              id: docData.contact.id,
              firstName: docData.contact.firstName,
              lastName: docData.contact.lastName,
            }
            : null,
          uploader: docData.uploader,
        };
        setCompareDocument(compareDoc);

        // Load preview URLs if documents are previewable
        if (currentDocument.mime.startsWith("image/") || currentDocument.mime.startsWith("application/pdf")) {
          const currentRes = await fetch(`/api/documents/${currentDocument.id}/download`);
          if (currentRes.ok) {
            const currentData = await currentRes.json();
            setCurrentDownloadUrl(currentData.getUrl);
          }
        }

        if (compareDoc.mime.startsWith("image/") || compareDoc.mime.startsWith("application/pdf")) {
          const compareRes = await fetch(`/api/documents/${compareVersionId}/download`);
          if (compareRes.ok) {
            const compareData = await compareRes.json();
            setCompareDownloadUrl(compareData.getUrl);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veri yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, compareVersionId, currentDocument]);

  if (!isOpen) return null;

  const handleDownload = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`);
      if (!response.ok) throw new Error("İndirme bağlantısı alınamadı");
      const data = await response.json();
      window.open(data.getUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İndirme başarısız");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">Versiyon Karşılaştırma</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-3 text-sm text-slate-600">Yükleniyor...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            </div>
          ) : compareDocument ? (
            <div className="grid grid-cols-2 gap-6 p-6">
              {/* Compare Version (Left) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Versiyon {compareDocument.version}
                    </h3>
                    <p className="text-sm text-slate-500">Eski Versiyon</p>
                  </div>
                  <button
                    onClick={() => handleDownload(compareDocument.id, compareDocument.filename)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    İndir
                  </button>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                  {compareDownloadUrl ? (
                    compareDocument.mime.startsWith("image/") ? (
                      <img
                        src={compareDownloadUrl}
                        alt={compareDocument.filename}
                        className="w-full h-[500px] object-contain bg-white"
                      />
                    ) : (
                      <iframe
                        src={compareDownloadUrl}
                        className="w-full h-[500px]"
                        title={compareDocument.filename}
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-[500px] text-sm text-slate-500">
                      Önizleme desteklenmiyor
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dosya adı:</span>
                    <span className="font-medium text-slate-900 truncate ml-2">{compareDocument.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Boyut:</span>
                    <span className="font-medium text-slate-900">{formatBytes(compareDocument.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Yükleme tarihi:</span>
                    <span className="font-medium text-slate-900">{formatDate(compareDocument.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Yükleyen:</span>
                    <span className="font-medium text-slate-900">
                      {compareDocument.uploader.name || compareDocument.uploader.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Version (Right) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Versiyon {currentDocument.version}
                    </h3>
                    <p className="text-sm text-slate-500">Güncel Versiyon</p>
                  </div>
                  <button
                    onClick={() => handleDownload(currentDocument.id, currentDocument.filename)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    İndir
                  </button>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-blue-300 bg-blue-50 overflow-hidden">
                  {currentDownloadUrl ? (
                    currentDocument.mime.startsWith("image/") ? (
                      <img
                        src={currentDownloadUrl}
                        alt={currentDocument.filename}
                        className="w-full h-[500px] object-contain bg-white"
                      />
                    ) : (
                      <iframe
                        src={currentDownloadUrl}
                        className="w-full h-[500px]"
                        title={currentDocument.filename}
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-[500px] text-sm text-slate-500">
                      Önizleme desteklenmiyor
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Dosya adı:</span>
                    <span className="font-medium text-slate-900 truncate ml-2">{currentDocument.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">Boyut:</span>
                    <span className="font-medium text-slate-900">{formatBytes(currentDocument.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">Yükleme tarihi:</span>
                    <span className="font-medium text-slate-900">{formatDate(currentDocument.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">Yükleyen:</span>
                    <span className="font-medium text-slate-900">
                      {currentDocument.uploader.name || currentDocument.uploader.email}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            type="button"
          >
            Kapat
          </button>
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
    return value;
  }
}
