"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  ContactOption,
  DocumentListItem,
  MatterOption,
} from "@/components/documents/types";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

type DocumentUploadDialogProps = {
  matters: MatterOption[];
  contacts: ContactOption[];
  maxUploadBytes?: number;
  onCreated?: (document: DocumentListItem) => void;
};

const defaultMaxBytes = MAX_UPLOAD_BYTES;

type UploadTarget = {
  url: string;
  method: "PUT" | "POST";
  fields?: Record<string, string> | null;
  headers?: Record<string, string> | null;
};

async function performUpload(target: UploadTarget, file: globalThis.File) {
  if (target.method === "POST") {
    const formData = new globalThis.FormData();
    if (target.fields) {
      Object.entries(target.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    formData.append("file", file);
    return fetch(target.url, {
      method: "POST",
      body: formData,
    });
  }

  const headers: Record<string, string> = {
    ...(target.headers ?? {}),
  };

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = file.type;
  }

  return fetch(target.url, {
    method: target.method,
    headers,
    body: file,
  });
}

export function DocumentUploadDialog({
  matters,
  contacts,
  maxUploadBytes = defaultMaxBytes,
  onCreated,
}: DocumentUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<globalThis.File[]>([]);
  const [matterId, setMatterId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const maxSizeLabel = useMemo(() => {
    const mb = maxUploadBytes / 1024 / 1024;
    return `${Math.round(mb)} MB`;
  }, [maxUploadBytes]);

  function resetForm() {
    setFiles([]);
    setMatterId("");
    setContactId("");
    setTags("");
    setError(null);
  }

  function closeDialog() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!files.length) {
      setError("En az bir dosya seçmelisiniz.");
      return;
    }

    const invalidSize = files.find((candidate) => candidate.size > maxUploadBytes);
    if (invalidSize) {
      setError(`${invalidSize.name} çok büyük (maksimum ${maxSizeLabel}).`);
      return;
    }

    const invalidMime = files.find((candidate) => !candidate.type);
    if (invalidMime) {
      setError(`${invalidMime.name} için MIME türü belirlenemedi.`);
      return;
    }

    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setLoading(true);
    let successCount = 0;
    let currentFile: globalThis.File | null = null;
    try {

      for (const file of files) {
        currentFile = file;

        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type,
            size: file.size,
            matterId: matterId || undefined,
            contactId: contactId || undefined,
          }),
        });

        if (!uploadResponse.ok) {
          const payload = await uploadResponse.json().catch(() => ({}));
          throw new Error(payload.error ?? "Signed URL oluşturulamadı");
        }

        const uploadPayload: {
          documentId: string;
          storageKey: string;
          version: number;
          upload?: UploadTarget;
          putUrl?: string;
          method?: "PUT" | "POST";
        } = await uploadResponse.json();

        const fallbackMethod = uploadPayload.method === "POST" ? "POST" : "PUT";
        const uploadTarget: UploadTarget =
          uploadPayload.upload ??
          {
            url: uploadPayload.putUrl ?? "",
            method: fallbackMethod,
            fields: null,
            headers: null,
          };

        if (!uploadTarget.url) {
          throw new Error("Yükleme hedefi sağlanamadı.");
        }

        const uploadResult = await performUpload(uploadTarget, file);

        if (!uploadResult.ok) {
          throw new Error("Dosya yüklemesi başarısız oldu");
        }

        const metaResponse = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: uploadPayload.documentId,
            filename: file.name,
            mime: file.type,
            size: file.size,
            storageKey: uploadPayload.storageKey,
            version: uploadPayload.version,
            matterId: matterId || undefined,
            contactId: contactId || undefined,
            tags: tagsArray,
          }),
        });

        if (!metaResponse.ok) {
          const payload = await metaResponse.json().catch(() => ({}));
          throw new Error(payload.error ?? "Doküman kaydedilemedi");
        }

        const created = (await metaResponse.json()) as DocumentListItem;
        onCreated?.(created);
        successCount += 1;
      }

      if (successCount) {
        setToast(
          successCount === 1
            ? "Doküman yüklendi."
            : `${successCount} doküman yüklendi.`,
        );
        setTimeout(() => setToast(null), 3000);
        closeDialog();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu";
      setError(currentFile ? `${currentFile.name}: ${message}` : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
        data-testid="document-upload-button"
      >
        Yeni Doküman
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div
            className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            data-testid="document-upload-dialog"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Doküman Yükle</h3>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Kapat
              </button>
            </div>

            <form className="space-y-4 text-sm text-slate-600" onSubmit={handleSubmit}>
              <label className="grid gap-2">
                <span className="font-medium text-slate-700">Dosya</span>
                <input
                  type="file"
                  accept={ALLOWED_MIME_TYPES.join(",") + ",image/*"}
                  multiple
                  onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []))
                  }
                />
                <span className="text-xs text-slate-400">Maksimum {maxSizeLabel}</span>
                {files.length ? (
                  <ul className="text-xs text-slate-500">
                    {files.map((selected) => (
                      <li key={selected.name}>{selected.name}</li>
                    ))}
                  </ul>
                ) : null}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="font-medium text-slate-700">Matter</span>
                  <select
                    value={matterId}
                    onChange={(event) => setMatterId(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
                  >
                    <option value="">Seçiniz</option>
                    {matters.map((matter) => (
                      <option key={matter.id} value={matter.id}>
                        {matter.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="font-medium text-slate-700">Contact</span>
                  <select
                    value={contactId}
                    onChange={(event) => setContactId(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
                  >
                    <option value="">Opsiyonel</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="font-medium text-slate-700">Etiketler (virgülle ayrılmış)</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="kanit,imza"
                  className="rounded-lg border border-slate-200 px-3 py-2 focus:border-accent focus:outline-none"
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Yükleniyor..." : "Yükle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
