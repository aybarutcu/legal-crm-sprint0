"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { CONTACT_STATUS, CONTACT_TYPES } from "@/lib/validation/contact";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  type: (typeof CONTACT_TYPES)[number];
  status: (typeof CONTACT_STATUS)[number];
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  preferredLanguage: string;
  source: string;
  tags: string;
};

type EditContactDialogProps = {
  contactId: string;
  initialData: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    type: (typeof CONTACT_TYPES)[number];
    status: (typeof CONTACT_STATUS)[number];
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    preferredLanguage?: string | null;
    source?: string | null;
    tags?: string[];
  };
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

export function EditContactDialog({
  contactId,
  initialData,
  open,
  onClose,
  onUpdated,
}: EditContactDialogProps) {
  const router = useRouter();
  
  // Helper function to safely convert to string
  const toStr = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    return String(value);
  };

  const [form, setForm] = useState<FormState>({
    firstName: toStr(initialData.firstName),
    lastName: toStr(initialData.lastName),
    email: toStr(initialData.email),
    phone: toStr(initialData.phone),
    company: toStr(initialData.company),
    type: initialData.type,
    status: initialData.status,
    address: toStr(initialData.address),
    city: toStr(initialData.city),
    state: toStr(initialData.state),
    zip: toStr(initialData.zip),
    country: toStr(initialData.country),
    preferredLanguage: toStr(initialData.preferredLanguage),
    source: toStr(initialData.source),
    tags: (initialData.tags || []).join(", "),
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form when initialData changes (when dialog opens with new data)
  useEffect(() => {
    setForm({
      firstName: toStr(initialData.firstName),
      lastName: toStr(initialData.lastName),
      email: toStr(initialData.email),
      phone: toStr(initialData.phone),
      company: toStr(initialData.company),
      type: initialData.type,
      status: initialData.status,
      address: toStr(initialData.address),
      city: toStr(initialData.city),
      state: toStr(initialData.state),
      zip: toStr(initialData.zip),
      country: toStr(initialData.country),
      preferredLanguage: toStr(initialData.preferredLanguage),
      source: toStr(initialData.source),
      tags: (initialData.tags || []).join(", "),
    });
  }, [initialData]);

  function closeDialog() {
    onClose();
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      firstName: toStr(form.firstName).trim(),
      lastName: toStr(form.lastName).trim(),
      email: toStr(form.email).trim() || undefined,
      phone: toStr(form.phone).trim() || undefined,
      company: toStr(form.company).trim() || undefined,
      type: form.type,
      status: form.status,
      address: toStr(form.address).trim() || undefined,
      city: toStr(form.city).trim() || undefined,
      state: toStr(form.state).trim() || undefined,
      zip: toStr(form.zip).trim() || undefined,
      country: toStr(form.country).trim() || undefined,
      preferredLanguage: toStr(form.preferredLanguage).trim() || undefined,
      source: toStr(form.source).trim() || undefined,
      tags: form.tags
        ? String(form.tags).split(",").map((tag) => tag.trim()).filter(Boolean)
        : [],
    };

    setLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 422) {
          setError("Zorunlu alanları kontrol edin.");
        } else if (response.status === 401 || response.status === 403) {
          setError("Bu işlemi yapmak için yetkiniz yok.");
        } else {
          setError("Beklenmeyen bir hata oluştu.");
        }
        return;
      }

      onUpdated?.();
      closeDialog();
      window.setTimeout(() => {
        router.refresh();
      }, 300);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Contact Düzenle
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

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700">Temel Bilgiler</h4>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Ad *
                <input
                  required
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Soyad *
                <input
                  required
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                E-posta
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="musteri@firma.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Telefon
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="+90 555 123 45 67"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <label className="text-sm font-medium text-slate-700">
              Firma
              <input
                value={form.company}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company: event.target.value }))
                }
                placeholder="Firma Adı"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Tip
                <select
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

              <label className="text-sm font-medium text-slate-700">
                Kaynak
                <input
                  value={form.source}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, source: event.target.value }))
                  }
                  placeholder="Referans, Web, vb."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700">Adres Bilgileri</h4>
            
            <label className="text-sm font-medium text-slate-700">
              Adres
              <input
                value={form.address}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder="Sokak, Mahalle, vb."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Şehir
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                  placeholder="İstanbul"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                İl/Eyalet
                <input
                  value={form.state}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, state: event.target.value }))
                  }
                  placeholder="Marmara"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Posta Kodu
                <input
                  value={form.zip}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, zip: event.target.value }))
                  }
                  placeholder="34000"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Ülke
                <input
                  value={form.country}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, country: event.target.value }))
                  }
                  placeholder="Türkiye"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700">Ek Bilgiler</h4>
            
            <label className="text-sm font-medium text-slate-700">
              Tercih Edilen Dil
              <input
                value={form.preferredLanguage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, preferredLanguage: event.target.value }))
                }
                placeholder="Türkçe, İngilizce, vb."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Etiketler (virgülle ayırın)
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, tags: event.target.value }))
                }
                placeholder="vip, acil, önemli"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>
          </div>

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
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
