"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import type { CalendarOption } from "@/components/events/types";

type CalendarSettingsClientProps = {
  calendars: CalendarOption[];
  googleConnected: boolean;
  icsActive: boolean;
};

type ReminderDrafts = Record<string, string>;

export function CalendarSettingsClient({
  calendars,
  googleConnected,
  icsActive,
}: CalendarSettingsClientProps) {
  const [items, setItems] = useState(calendars);
  const [connected, setConnected] = useState(googleConnected);
  const [reminderDrafts, setReminderDrafts] = useState<ReminderDrafts>(() =>
    Object.fromEntries(
      calendars.map((calendar) => [
        calendar.id,
        String(calendar.defaultReminderMinutes ?? 30),
      ]),
    ),
  );
  const [busyCalendarId, setBusyCalendarId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [icsEnabled, setIcsEnabled] = useState(icsActive);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [icsBusy, setIcsBusy] = useState(false);

  function updateReminderDraft(id: string, value: string) {
    setReminderDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSaveReminder(id: string) {
    const draft = reminderDrafts[id];
    if (draft === undefined) return;

    const minutes = Number(draft);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      setError("Hatırlatma süresi 0-1440 arasında olmalıdır.");
      return;
    }

    setBusyCalendarId(id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultReminderMinutes: minutes }),
      });

      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }

      const updated = await response.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                defaultReminderMinutes: updated.defaultReminderMinutes,
              }
            : item,
        ),
      );
      setMessage("Hatırlatma süresi güncellendi.");
    } catch (err) {
      console.error("Failed to update calendar reminder", err);
      setError("Hatırlatma güncellenemedi.");
    } finally {
      setBusyCalendarId(null);
      window.setTimeout(() => setMessage(null), 4000);
    }
  }

  async function handleForceSync() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceFull: true }),
      });
      if (!response.ok) {
        throw new Error(`Sync failed ${response.status}`);
      }
      setMessage("Takvim senkronizasyonu kuyruklandı.");
    } catch (err) {
      console.error("Calendar sync failed", err);
      setError("Takvim senkronizasyonu başarısız oldu.");
    } finally {
      setSyncing(false);
      window.setTimeout(() => setMessage(null), 4000);
    }
  }

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/calendar/connect", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Disconnect failed ${response.status}`);
      }

      setItems((prev) => prev.filter((calendar) => calendar.provider !== "GOOGLE"));
      setConnected(false);
      setMessage("Google Calendar bağlantısı kaldırıldı.");
    } catch (err) {
      console.error("Failed to disconnect Google Calendar", err);
      setError("Google Calendar bağlantısı kaldırılamadı.");
    } finally {
      setDisconnecting(false);
      window.setTimeout(() => setMessage(null), 4000);
    }
  }

  function handleConnect() {
    setError(null);
    signIn("google", { callbackUrl: "/settings/calendar" }).catch((err) => {
      console.error("Google sign-in failed", err);
      setError("Google ile bağlantı kurulamadı.");
    });
  }

  async function handleGenerateIcs() {
    if (icsBusy) return;
    setIcsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/calendar/ics/token", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`ICS token failed ${response.status}`);
      }
      const payload = (await response.json()) as { url: string };
      setIcsUrl(payload.url);
      setIcsEnabled(true);
      setMessage("ICS bağlantısı oluşturuldu. Lütfen güvenli bir yerde saklayın.");
    } catch (err) {
      console.error("Failed to generate ICS token", err);
      setError("ICS linki oluşturulamadı.");
    } finally {
      setIcsBusy(false);
      window.setTimeout(() => setMessage(null), 6000);
    }
  }

  async function handleDisableIcs() {
    if (icsBusy) return;
    setIcsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/calendar/ics/token", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`ICS revoke failed ${response.status}`);
      }
      setIcsEnabled(false);
      setIcsUrl(null);
      setMessage("ICS bağlantısı devre dışı bırakıldı.");
    } catch (err) {
      console.error("Failed to disable ICS token", err);
      setError("ICS linki devre dışı bırakılamadı.");
    } finally {
      setIcsBusy(false);
      window.setTimeout(() => setMessage(null), 4000);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Takvim Ayarları</h2>
        <p className="text-sm text-slate-500">
          Google Calendar entegrasyonunu yönetin, varsayılan hatırlatmayı ayarlayın.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Google Calendar</h3>
            <p className="text-sm text-slate-500">
              {connected
                ? "Google hesabınız bağlı. Etkinlikler çift yönlü senkronize edilir."
                : "Google hesabınız bağlı değil. Bağlanarak Google Calendar ile senkronize edin."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleForceSync}
              disabled={syncing}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              {syncing ? "Senkronize ediliyor..." : "Tam Senkronizasyon"}
            </button>
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
              >
                {disconnecting ? "Kaldırılıyor..." : "Google Bağlantısını Kaldır"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Google ile Bağlan
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Takvimleriniz</h3>
            <p className="text-sm text-slate-500">
              Varsayılan hatırlatma süresini güncelleyin ve senkronizasyon durumunu görüntüleyin.
            </p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Henüz bir takvim bulunmuyor. Yerel takvim otomatik oluşturulur, Google bağlandığında ek takvimler eklenecektir.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Adı</th>
                  <th className="px-4 py-3">Sağlayıcı</th>
                  <th className="px-4 py-3">Varsayılan Hatırlatma (dk)</th>
                  <th className="px-4 py-3">Son Senkronizasyon</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((calendar) => (
                  <tr key={calendar.id} className="border-b border-slate-100 last:border-none">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{calendar.name}</div>
                      {calendar.isPrimary ? (
                        <div className="text-xs text-emerald-600">Varsayılan takvim</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {calendar.provider === "GOOGLE" ? "Google" : "Yerel"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={reminderDrafts[calendar.id] ?? ""}
                        onChange={(event) =>
                          updateReminderDraft(calendar.id, event.target.value)
                        }
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {calendar.lastSyncedAt
                        ? new Date(calendar.lastSyncedAt).toLocaleString()
                        : "Senkranize edilmedi"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSaveReminder(calendar.id)}
                        disabled={busyCalendarId === calendar.id}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {busyCalendarId === calendar.id ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">ICS Beslemesi</h3>
        <p className="mt-2 text-sm text-slate-500">
          ICS bağlantısı ile takviminizi salt okunur şekilde paylaşabilirsiniz. Yeni bir bağlantı oluşturmak eski bağlantıyı geçersiz kılar.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateIcs}
            disabled={icsBusy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {icsBusy ? "İşleniyor..." : icsEnabled ? "ICS Bağlantısını Yenile" : "ICS Bağlantısı Oluştur"}
          </button>
          {icsEnabled ? (
            <button
              type="button"
              onClick={handleDisableIcs}
              disabled={icsBusy}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
            >
              {icsBusy ? "İşleniyor..." : "ICS Bağlantısını Devre Dışı Bırak"}
            </button>
          ) : null}
        </div>
        {icsUrl ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              ICS URL
            </p>
            <p className="mt-1 break-all text-sm text-slate-700">{icsUrl}</p>
            <p className="mt-2 text-xs text-slate-500">
              Not: Bu bağlantıyı güvenli bir şekilde saklayın. Bağlantıyı kaybederseniz yeni bir tane oluşturmanız gerekir.
            </p>
          </div>
        ) : null}
        {!icsEnabled ? (
          <p className="mt-4 text-xs text-slate-500">
            Henüz etkinleştirilmiş bir ICS bağlantınız yok.
          </p>
        ) : null}
      </div>
    </section>
  );
}
