"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { CONTACT_STATUS, CONTACT_TYPES } from "@/lib/validation/contact";
import type { ContactListItem } from "@/components/contact/types";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  type: (typeof CONTACT_TYPES)[number];
  status: (typeof CONTACT_STATUS)[number];
  tags: string;
};

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  type: "LEAD",
  status: "NEW",
  tags: "",
};

type NewContactDialogProps = {
  onCreated?: (contact: ContactListItem) => void;
};

export function NewContactDialog({ onCreated }: NewContactDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function closeDialog() {
    setOpen(false);
    setForm(initialState);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      type: form.type,
      status: form.status,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    setLoading(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 422) {
          setError("Zorunlu alanları kontrol edin.");
        } else if (response.status === 401) {
          setError("Bu işlemi yapmak için yetkiniz yok.");
        } else {
          setError("Beklenmeyen bir hata oluştu.");
        }
        return;
      }

      const created = (await response.json()) as ContactListItem;
      onCreated?.({
        ...created,
        owner: created.owner ?? null,
        ownerId: created.ownerId ?? null,
        tags: created.tags ?? [],
        createdAt: created.createdAt ?? new Date().toISOString(),
      });

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
        data-testid="new-contact-button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
      >
        Yeni Contact
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Yeni Contact
                </h3>
                <p className="text-sm text-slate-500">
                  Zorunlu alanlar: Ad ve Soyad.
                </p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Ad
                  <input
                    data-testid="new-contact-firstName"
                    required
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Soyad
                  <input
                    data-testid="new-contact-lastName"
                    required
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                E-posta
                <input
                  data-testid="new-contact-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="musteri@firma.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Tip
                  <select
                    data-testid="new-contact-type"
                    value={form.type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        type: event.target.value as FormState["type"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {CONTACT_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Durum
                  <select
                    data-testid="new-contact-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as FormState["status"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {CONTACT_STATUS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Etiketler (virgülle ayırın)
                <input
                  data-testid="new-contact-tags"
                  value={form.tags}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, tags: event.target.value }))
                  }
                  placeholder="vip,acil"
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
                  data-testid="new-contact-submit"
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
