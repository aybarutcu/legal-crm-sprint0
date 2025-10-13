"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { tr } from "date-fns/locale";
import useSWR from "swr";
import { EventDialog } from "@/components/events/EventDialog";
import type {
  CalendarFilters,
  CalendarOption,
  EventItem,
  EventsResponse,
  MatterOption,
} from "@/components/events/types";
import {
  getViewRange,
  moveByView,
  type CalendarView,
} from "@/lib/events/date-range";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Etkinlikler yüklenemedi");
  }
  return (await response.json()) as EventsResponse;
};

type EventsPageClientProps = {
  initialData: EventsResponse;
  matters: MatterOption[];
  calendars: CalendarOption[];
  defaultView?: CalendarView;
  defaultDateISO: string;
};

type DialogState =
  | { open: false }
  | {
      open: true;
      mode: "create";
      event?: never;
      defaultDate: Date;
    }
  | {
      open: true;
      mode: "edit";
      event: EventItem;
    };

const dateLabelFormats: Record<CalendarView, string> = {
  day: "d MMMM yyyy, EEEE",
  week: "d MMMM yyyy",
  month: "MMMM yyyy",
};

const VIEW_OPTIONS: CalendarView[] = ["month", "week", "day"];

export function EventsPageClient({
  initialData,
  matters,
  calendars,
  defaultView = "month",
  defaultDateISO,
}: EventsPageClientProps) {
  const [view, setView] = useState<CalendarView>(defaultView);
  const [referenceDate, setReferenceDate] = useState(() => new Date(defaultDateISO));
  const [filters, setFilters] = useState<CalendarFilters>({
    view: defaultView,
  });
  const [filterDraft, setFilterDraft] = useState({
    q: "",
    matterId: "",
    attendee: "",
    calendarId: "",
  });
  const [dialogState, setDialogState] = useState<DialogState>({ open: false });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const range = useMemo(
    () => getViewRange(view, referenceDate),
    [view, referenceDate],
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
    params.set("page", "1");
    params.set("pageSize", "100");
    if (filters.q) params.set("q", filters.q);
    if (filters.matterId) params.set("matterId", filters.matterId);
    if (filters.attendee) params.set("attendee", filters.attendee);
    if (filters.calendarId) params.set("calendarId", filters.calendarId);
    return params.toString();
  }, [view, range, filters]);

  const swrKey = `/api/events?${queryParams}`;

  const { data, error, isValidating, mutate } = useSWR<EventsResponse>(
    swrKey,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
    },
  );

  const events = data?.data ?? [];
  const hasGoogleCalendar = calendars.some(
    (calendar) => calendar.provider === "GOOGLE",
  );

  function handleViewChange(nextView: CalendarView) {
    setView(nextView);
    setFilters((prev) => ({ ...prev, view: nextView }));
  }

  function handleNavigate(direction: 1 | -1) {
    setReferenceDate((prev) => moveByView(view, prev, direction));
  }

  function handleToday() {
    setReferenceDate(new Date());
  }

  function openCreateDialog(date: Date) {
    setDialogState({
      open: true,
      mode: "create",
      defaultDate: date,
    });
  }

  function openEditDialog(event: EventItem) {
    setDialogState({
      open: true,
      mode: "edit",
      event,
    });
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: filters.calendarId || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }
      const result = await response.json();
      setSyncMessage(
        result.status === "queued"
          ? "Senkranizasyon isteği kuyruğa alındı."
          : "Aktif takvimler için senkronizasyon gerekmedi.",
      );
      await mutate();
    } catch (err) {
      console.error("Calendar sync failed", err);
      setSyncMessage("Senkronizasyon sırasında hata oluştu.");
    } finally {
      setSyncing(false);
      window.setTimeout(() => setSyncMessage(null), 4000);
    }
  }

  function handleDialogClose() {
    setDialogState({ open: false });
  }

  async function handleEventSaved() {
    setDialogState({ open: false });
    await mutate();
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      q: filterDraft.q || undefined,
      matterId: filterDraft.matterId || undefined,
      attendee: filterDraft.attendee || undefined,
      calendarId: filterDraft.calendarId || undefined,
    }));
  }

  function handleFilterClear() {
    setFilterDraft({
      q: "",
      matterId: "",
      attendee: "",
      calendarId: "",
    });
    setFilters((prev) => ({
      ...prev,
      q: undefined,
      matterId: undefined,
      attendee: undefined,
      calendarId: undefined,
    }));
  }

  const gridDays = useMemo(() => {
    const { from, to } = range;
    return eachDayOfInterval({ start: from, end: to });
  }, [range]);

  const eventsByDay = useMemo(() => {
    return gridDays.map((day) => ({
      date: day,
      events: events.filter((event) =>
        isSameDay(parseISO(event.startAt), day),
      ),
    }));
  }, [gridDays, events]);

  const dayFormat =
    view === "month" ? "d" : view === "week" ? "EEE d" : "HH:mm";

  const titleDateLabel = format(referenceDate, dateLabelFormats[view], {
    locale: tr,
  });

  return (
    <section className="space-y-6" data-testid="events-page-client">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Takvim</h2>
          <p className="text-sm text-slate-500">
            Etkinliklerinizi aylık, haftalık veya günlük görünümde yönetin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {syncing ? "Senkronize ediliyor..." : "Takvimi Senkronize Et"}
          </button>
          <button
            type="button"
            onClick={() => openCreateDialog(referenceDate)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
          >
            Yeni Etkinlik
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Önceki
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Bugün
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Sonraki
          </button>
        </div>
        <div className="text-lg font-semibold text-slate-800">{titleDateLabel}</div>
        <div className="flex items-center gap-2">
          {VIEW_OPTIONS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => handleViewChange(candidate)}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${
                view === candidate
                  ? "bg-accent text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {candidate === "month"
                ? "Ay"
                : candidate === "week"
                  ? "Hafta"
                  : "Gün"}
            </button>
          ))}
        </div>
      </div>

      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:grid-cols-5"
        onSubmit={handleFilterSubmit}
      >
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Ara
          <input
            type="search"
            value={filterDraft.q}
            onChange={(event) =>
              setFilterDraft((prev) => ({ ...prev, q: event.target.value }))
            }
            placeholder="Etkinlik başlığı veya açıklaması"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Dosya
          <select
            value={filterDraft.matterId}
            onChange={(event) =>
              setFilterDraft((prev) => ({ ...prev, matterId: event.target.value }))
            }
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
          Katılımcı (E-posta)
          <input
            type="email"
            value={filterDraft.attendee}
            onChange={(event) =>
              setFilterDraft((prev) => ({ ...prev, attendee: event.target.value }))
            }
            placeholder="katilimci@example.com"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Takvim
          <select
            value={filterDraft.calendarId}
            onChange={(event) =>
              setFilterDraft((prev) => ({ ...prev, calendarId: event.target.value }))
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}{" "}
                {calendar.provider === "GOOGLE" ? "(Google)" : "(Yerel)"}
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
          <button
            type="button"
            onClick={handleFilterClear}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Etkinlikler yüklenirken bir hata oluştu.
        </div>
      ) : null}

      {syncMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-white">
          {syncMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        {view === "day" ? (
          <DayView
            events={events}
            referenceDate={referenceDate}
            onSelectEvent={openEditDialog}
          />
        ) : (
          <CalendarGrid
            view={view}
            referenceDate={referenceDate}
            days={eventsByDay}
            onSelectDay={openCreateDialog}
            onSelectEvent={openEditDialog}
          />
        )}
      </div>

      {isValidating ? (
        <div className="text-sm text-slate-500">Etkinlikler güncelleniyor…</div>
      ) : null}

      {dialogState.open ? (
        <EventDialog
          open
          mode={dialogState.mode}
          matters={matters}
          calendars={calendars}
          defaultCalendarId={
            dialogState.mode === "create"
              ? filters.calendarId ?? calendars.find((calendar) => calendar.isPrimary)?.id
              : dialogState.mode === "edit"
                ? dialogState.event.calendar?.id ?? undefined
                : undefined
          }
          defaultStartAt={
            dialogState.mode === "create"
              ? dialogState.defaultDate
              : new Date(dialogState.event.startAt)
          }
          initialEvent={dialogState.mode === "edit" ? dialogState.event : undefined}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) handleDialogClose();
          }}
          onSuccess={handleEventSaved}
        />
      ) : null}

      {hasGoogleCalendar ? null : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Google takvimi bağlı değil. Ayarlar &rarr; Takvim bölümünden bağlantı kurabilirsiniz.
        </div>
      )}
    </section>
  );
}

type CalendarGridProps = {
  view: CalendarView;
  referenceDate: Date;
  days: {
    date: Date;
    events: EventItem[];
  }[];
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: EventItem) => void;
};

function CalendarGrid({ view, referenceDate, days, onSelectDay, onSelectEvent }: CalendarGridProps) {
  const startsMonday = true;
  const weeks = useMemo(() => {
    if (view === "week") {
      return [days];
    }
    const perWeek: {
      date: Date;
      events: EventItem[];
    }[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      perWeek.push(days.slice(index, index + 7));
    }
    return perWeek;
  }, [days, view]);

  const weekDayLabels = useMemo(() => {
    const base = startsMonday ? new Date(2023, 0, 2) : new Date(2023, 0, 1);
    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(base, index);
      return format(date, "EEE", { locale: tr });
    });
  }, [startsMonday]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        {weekDayLabels.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-2">
            {week.map(({ date, events }) => (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onSelectDay(date)}
                className={`flex min-h-[120px] flex-col rounded-xl border border-slate-200 p-2 text-left ${
                  isToday(date) ? "border-accent" : ""
                } ${view === "month" && !isSameMonth(date, referenceDate) ? "bg-slate-50" : "bg-white hover:border-accent/40"}`}
              >
                <div
                  className={`text-xs font-semibold ${
                    isToday(date) ? "text-accent" : "text-slate-500"
                  }`}
                >
                  {format(date, "d MMM", { locale: tr })}
                </div>
                <div className="mt-2 space-y-2">
                  {events.length === 0 ? (
                    <div className="text-xs text-slate-400">Etkinlik yok</div>
                  ) : (
                    events.slice(0, 4).map((event) => (
                      <div
                        key={event.id}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:border-accent/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(event);
                        }}
                      >
                        <div className="font-semibold text-slate-800">
                          {format(parseISO(event.startAt), "HH:mm")} • {event.title}
                        </div>
                        {event.matter ? (
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            {event.matter.title}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                  {events.length > 4 ? (
                    <div className="text-[11px] font-medium text-slate-500">
                      +{events.length - 4} etkinlik
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type DayViewProps = {
  events: EventItem[];
  referenceDate: Date;
  onSelectEvent: (event: EventItem) => void;
};

function DayView({ events, referenceDate, onSelectEvent }: DayViewProps) {
  const sameDayEvents = events
    .filter((event) => isSameDay(parseISO(event.startAt), referenceDate))
    .sort(
      (a, b) =>
        parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime(),
    );

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800">
        {format(referenceDate, "d MMMM yyyy, EEEE", { locale: tr })}
      </h3>
      {sameDayEvents.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Bu gün için planlanmış etkinlik bulunmuyor.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sameDayEvents.map((event) => {
            const start = parseISO(event.startAt);
            const end = parseISO(event.endAt);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-accent/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {event.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(start, "HH:mm")} - {format(end, "HH:mm")}
                    </div>
                  </div>
                  {event.calendar ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {event.calendar.name}
                    </span>
                  ) : null}
                </div>
                {event.matter ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Dosya: {event.matter.title}
                  </div>
                ) : null}
                {event.attendees.length > 0 ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Katılımcılar:{" "}
                    {event.attendees
                      .map((attendee) => attendee.name ?? attendee.email)
                      .join(", ")}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
