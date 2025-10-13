"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { MATTER_STATUS, MATTER_TYPES } from "@/lib/validation/matter";
import type { ContactOption, MatterListItem } from "@/components/matters/types";

type FormState = {
  title: string;
  type: (typeof MATTER_TYPES)[number];
  status: (typeof MATTER_STATUS)[number];
  clientId: string;
  jurisdiction: string;
  court: string;
  nextHearingAt: string;
};

type MatterCreateDialogProps = {
  clients: ContactOption[];
  onCreated?: (matter: MatterListItem) => void;
};

const initialState: FormState = {
  title: "",
  type: "CIVIL",
  status: "OPEN",
  clientId: "",
  jurisdiction: "",
  court: "",
  nextHearingAt: "",
};

export function MatterCreateDialog({ clients, onCreated }: MatterCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeDialog() {
    setOpen(false);
    setForm(initialState);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.clientId) {
      setError("Müvekkil seçimi zorunludur.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      clientId: form.clientId,
      jurisdiction: form.jurisdiction.trim() || undefined,
      court: form.court.trim() || undefined,
      nextHearingAt: form.nextHearingAt ? new Date(form.nextHearingAt).toISOString() : undefined,
    };

    setLoading(true);
    try {
      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 422) {
          setError("Form geçersiz. Zorunlu alanları kontrol edin.");
        } else if (response.status === 401) {
          setError("Yetkisiz işlem.");
        } else {
          setError("Beklenmeyen bir hata oluştu.");
        }
        return;
      }

      const created = (await response.json()) as MatterListItem;
      onCreated?.(created);
      closeDialog();

      window.setTimeout(() => {
        router.refresh();
      }, 1500);
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
        data-testid="new-matter-button"
      >
        Yeni Dava
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Yeni Dava</h3>
                <p className="text-sm text-slate-500">Başlık, tür ve müvekkil zorunludur.</p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Kapat
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="text-sm font-medium text-slate-700">
                Başlık
                <input
                  name="title"
                  required
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Tür
                  <select
                    name="type"
                    value={form.type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        type: event.target.value as FormState["type"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {MATTER_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Durum
                  <select
                    name="status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as FormState["status"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {MATTER_STATUS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Müvekkil
                <select
                  name="clientId"
                  required
                  value={form.clientId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, clientId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Seçiniz</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.email ? `(${client.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Yargı Alanı
                  <input
                    name="jurisdiction"
                    value={form.jurisdiction}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, jurisdiction: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Mahkeme
                  <input
                    name="court"
                    value={form.court}
                    onChange={(event) => setForm((prev) => ({ ...prev, court: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Duruşma Tarihi
                <input
                  name="nextHearingAt"
                  type="datetime-local"
                  value={form.nextHearingAt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nextHearingAt: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                  data-testid="new-matter-submit"
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
