"use client";

import { useEffect, useMemo, useState } from "react";
import { format, addHours } from "date-fns";
import type {
  CalendarOption,
  EventAttendee,
  EventItem,
  MatterOption,
} from "@/components/events/types";

type Mode = "create" | "edit";

type FormState = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  reminderMinutes: number;
  matterId: string;
  calendarId: string;
  attendees: EventAttendee[];
};

type EventDialogProps = {
  open: boolean;
  mode: Mode;
  matters: MatterOption[];
  calendars: CalendarOption[];
  defaultCalendarId?: string;
  defaultStartAt: Date;
  defaultDurationMinutes?: number;
  initialEvent?: EventItem;
  onOpenChange: (next: boolean) => void;
  onSuccess: (event: EventItem) => void;
};

const defaultDurationMinutes = 60;

const emptyAttendee: EventAttendee = { email: "", name: "" };

function formatLocalInput(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function deriveInitialState(
  props: Pick<
    EventDialogProps,
    "mode" | "defaultStartAt" | "defaultCalendarId" | "defaultDurationMinutes" | "initialEvent"
  >,
): FormState {
  if (props.mode === "edit" && props.initialEvent) {
    const event = props.initialEvent;
    return {
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startAt: formatLocalInput(new Date(event.startAt)),
      endAt: formatLocalInput(new Date(event.endAt)),
      reminderMinutes: event.reminderMinutes ?? 30,
      matterId: event.matter?.id ?? "",
      calendarId: event.calendar?.id ?? "",
      attendees: event.attendees.map((attendee) => ({
        email: attendee.email,
        name: attendee.name ?? "",
      })),
    };
  }

  const startAt = props.defaultStartAt;
  const endAt = addHours(
    startAt,
    props.defaultDurationMinutes ?? defaultDurationMinutes,
  );

  return {
    title: "",
    description: "",
    location: "",
    startAt: formatLocalInput(startAt),
    endAt: formatLocalInput(endAt),
    reminderMinutes: 30,
    matterId: "",
    calendarId: props.defaultCalendarId ?? "",
    attendees: [],
  };
}

export function EventDialog({
  open,
  mode,
  matters,
  calendars,
  defaultCalendarId,
  defaultStartAt,
  defaultDurationMinutes: defaultDuration = 60,
  initialEvent,
  onOpenChange,
  onSuccess,
}: EventDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    deriveInitialState({
      mode,
      defaultStartAt,
      defaultCalendarId,
      defaultDurationMinutes: defaultDuration,
      initialEvent,
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttendee, setPendingAttendee] = useState<EventAttendee>(
    emptyAttendee,
  );

  useEffect(() => {
    if (!open) {
      setForm(
        deriveInitialState({
          mode,
          defaultStartAt,
          defaultCalendarId,
          defaultDurationMinutes: defaultDuration,
          initialEvent,
        }),
      );
      setPendingAttendee(emptyAttendee);
      setError(null);
      setBusy(false);
    }
  }, [
    open,
    mode,
    defaultCalendarId,
    defaultDuration,
    defaultStartAt,
    initialEvent,
  ]);

  const dialogTitle = mode === "create" ? "Yeni Etkinlik" : "Etkinliği Düzenle";

  const availableCalendars = useMemo(() => {
    if (calendars.length === 0) return [];
    return calendars.map((calendar) => ({
      id: calendar.id,
      label:
        calendar.provider === "GOOGLE"
          ? `${calendar.name} (Google)`
          : `${calendar.name} (Yerel)`,
    }));
  }, [calendars]);

  function handleClose() {
    if (!busy) {
      onOpenChange(false);
    }
  }

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleRemoveAttendee(email: string) {
    setForm((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((attendee) => attendee.email !== email),
    }));
  }

  function handleAddAttendee() {
    const email = pendingAttendee.email.trim();
    if (!email) return;
    setForm((prev) => ({
      ...prev,
      attendees: [
        ...prev.attendees.filter(
          (existing) => existing.email.toLowerCase() !== email.toLowerCase(),
        ),
        {
          email,
          name: pendingAttendee.name?.trim() || undefined,
        },
      ],
    }));
    setPendingAttendee(emptyAttendee);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const startAtDate = new Date(form.startAt);
    const endAtDate = new Date(form.endAt);
    if (Number.isNaN(startAtDate.getTime()) || Number.isNaN(endAtDate.getTime())) {
      setError("Başlangıç ve bitiş tarihlerini kontrol edin.");
      return;
    }

    if (endAtDate <= startAtDate) {
      setError("Bitiş zamanı başlangıçtan sonra olmalıdır.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      reminderMinutes: Number.isFinite(form.reminderMinutes)
        ? form.reminderMinutes
        : 30,
      matterId: form.matterId || undefined,
      calendarId: form.calendarId || undefined,
      attendees: form.attendees.map((attendee) => ({
        email: attendee.email.trim(),
        ...(attendee.name ? { name: attendee.name.trim() } : {}),
      })),
    };

    if (!payload.title) {
      setError("Başlık zorunludur.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const endpoint =
        mode === "create"
          ? "/api/events"
          : `/api/events/${initialEvent?.id ?? ""}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 422) {
          setError("Form geçersiz. Zorunlu alanları kontrol edin.");
        } else if (response.status === 403) {
          setError("Bu etkinliği düzenleme yetkiniz yok.");
        } else {
          setError("İşlem sırasında bir hata oluştu.");
        }
        return;
      }

      const saved = (await response.json()) as EventItem;
      onSuccess(saved);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save event", err);
      setError("Etkinlik kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{dialogTitle}</h3>
            <p className="text-sm text-slate-500">
              Başlık, tarih ve saat zorunludur. Katılımcı ekleyerek e-posta hatırlatması planlayabilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Kapat
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Başlık
              <input
                required
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
                placeholder="Örn. Müvekkil toplantısı"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Konum
              <input
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
                placeholder="Ofis, çevrimiçi toplantı linki..."
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Başlangıç
              <input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(event) => updateField("startAt", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Bitiş
              <input
                type="datetime-local"
                required
                value={form.endAt}
                onChange={(event) => updateField("endAt", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Dosya
              <select
                value={form.matterId}
                onChange={(event) => updateField("matterId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              >
                <option value="">Seçilmedi</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Takvim
              <select
                value={form.calendarId}
                onChange={(event) => updateField("calendarId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              >
                <option value="">Yerel Takvim</option>
                {availableCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Hatırlatma (dakika)
              <input
                type="number"
                min={0}
                max={1440}
                value={form.reminderMinutes}
                onChange={(event) =>
                  updateField("reminderMinutes", Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Açıklama
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="mt-1 min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              placeholder="Notlarınızı ekleyin..."
            />
          </label>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Katılımcılar</h4>
                <p className="text-xs text-slate-500">
                  Katılımcılara e-posta hatırlatması gönderilir.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {form.attendees.length === 0 ? (
                <p className="text-sm text-slate-500">Henüz katılımcı eklenmedi.</p>
              ) : (
                form.attendees.map((attendee) => (
                  <div
                    key={attendee.email}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-700">{attendee.email}</div>
                      {attendee.name ? (
                        <div className="text-xs text-slate-500">{attendee.name}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(attendee.email)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Kaldır
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_auto]">
              <input
                type="email"
                value={pendingAttendee.email}
                onChange={(event) =>
                  setPendingAttendee((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="katilimci@example.com"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              />
              <input
                value={pendingAttendee.name ?? ""}
                onChange={(event) =>
                  setPendingAttendee((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="İsim (opsiyonel)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Ekle
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              disabled={busy}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Kaydediliyor..." : mode === "create" ? "Etkinlik Oluştur" : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
