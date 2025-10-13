"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type TaskNotification = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; name: string | null; email: string | null } | null;
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" && body.error.length > 0
        ? body.error
        : "Bildirimler yüklenemedi",
    );
  }
  return (await response.json()) as TaskNotification[];
};

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatNotificationMessage(notification: TaskNotification) {
  switch (notification.action) {
    case "TASK_CREATED":
      return "Yeni görev oluşturuldu.";
    case "TASK_UPDATED":
      return "Görev güncellendi.";
    case "TASK_DELETED":
      return "Görev silindi.";
    case "TASK_CHECKLIST_CREATED":
      return "Göreve checklist eklendi.";
    case "TASK_CHECKLIST_UPDATED":
      return "Checklist maddesi güncellendi.";
    case "TASK_LINK_CREATED":
      return "Göreve bağlantı eklendi.";
    case "TASK_LINK_DELETED":
      return "Görev bağlantısı kaldırıldı.";
    default:
      return "Görev işlemi kaydedildi.";
  }
}

export function TaskNotifications() {
  const [open, setOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<TaskNotification[]>(
    "/api/tasks/notifications",
    fetcher,
    {
      refreshInterval: 60_000,
    },
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      void mutate();
    }, 500);
    return () => window.clearTimeout(id);
  }, [open, mutate]);

  useEffect(() => {
    function handleKeydown(event: { key: string }) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const items = data ?? [];
  const countLabel = items.length > 0 ? String(Math.min(items.length, 20)) : "";

  const notifications = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        createdAtLabel: timeFormatter.format(new Date(item.createdAt)),
        message: formatNotificationMessage(item),
        actorLabel: item.actor?.name ?? item.actor?.email ?? "Bilinmeyen",
      })),
    [items],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Görev bildirimleri"
      >
        <span aria-hidden>🔔</span>
        {countLabel ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {countLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Görev Bildirimleri
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium uppercase tracking-widest text-slate-500 hover:text-slate-700"
            >
              Kapat
            </button>
          </div>

          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-slate-500">Yükleniyor…</p>
            ) : error ? (
              <p className="text-xs text-rose-600">{error.message}</p>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-slate-500">
                Henüz görev bildirimleri bulunmuyor.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                >
                  <div className="font-medium text-slate-900">{item.message}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-slate-400">
                    <span>{item.createdAtLabel}</span>
                    <span>• {item.actorLabel}</span>
                    <span>• {item.action}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
