"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InviteClientButton } from "@/components/contact/InviteClientButton";

type RoleUnion = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT" | undefined;

type ContactUser = {
  id: string;
  email: string | null;
  role?: RoleUnion;
  invitedAt?: string | null;
  activatedAt?: string | null;
  isActive?: boolean | null;
} | null;

type ContactOwner = {
  id: string;
  name: string | null;
  email: string | null;
} | null;

type ContactDetails = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  type?: string;
  status?: string;
  tags?: string[];
  owner?: ContactOwner;
  user?: ContactUser;
};

type ContactDetailsHoverCardProps = {
  contactId: string;
  fallbackName: string;
  email?: string | null;
  currentUserRole?: RoleUnion;
  className?: string;
};

/**
 * Lightweight hover-card that fetches contact details on demand and renders
 * a small profile with portal invite action. Intended to wrap a contact name.
 */
export function ContactDetailsHoverCard({
  contactId,
  fallbackName,
  email,
  currentUserRole,
  className,
}: ContactDetailsHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const hoverTimeout = useRef<number | null>(null);

  const fullName = useMemo(() => {
    if (contact) {
      return `${contact.firstName} ${contact.lastName}`.trim();
    }
    return fallbackName.trim();
  }, [contact, fallbackName]);

  const canInvite = useMemo(() => {
    return currentUserRole === "ADMIN" || currentUserRole === "LAWYER";
  }, [currentUserRole]);

  const isActivated = useMemo(() => {
    return Boolean(contact?.user?.activatedAt);
  }, [contact]);

  const hasInvite = useMemo(() => {
    return Boolean(contact?.user?.invitedAt);
  }, [contact]);

  const inviteDisabledReason = useMemo(() => {
    const targetEmail = contact?.email ?? email ?? null;
    if (!targetEmail) {
      return "E-posta adresi olmadığı için davet gönderilemez.";
    }
    const portalRole = contact?.user?.role;
    if (contact?.user && portalRole !== "CLIENT") {
      return "Bu kişi portal dışında farklı bir rol ile eşleştirilmiş.";
    }
    return null;
  }, [contact, email]);

  const portalStatus = useMemo(() => {
    const dd = (value?: string | null) => {
      if (!value) return null;
      try {
        const d = new Date(value);
        return new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(d);
      } catch {
        return value;
      }
    };

    const activated = dd(contact?.user?.activatedAt ?? null);
    const invited = dd(contact?.user?.invitedAt ?? null);
    if (activated) return `Aktif • ${activated}`;
    if (invited) return `Davet gönderildi • ${invited}`;
    return "Davet gönderilmedi";
  }, [contact]);

  useEffect(() => {
    if (open && !loadedRef.current && !loading) {
      setLoading(true);
      setError(null);
      fetch(`/api/contacts/${contactId}`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Kişi bilgileri alınamadı.");
          }
          return res.json() as Promise<ContactDetails>;
        })
        .then((data) => {
          setContact(data);
          loadedRef.current = true;
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Kişi bilgileri alınamadı.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, loading, contactId]);

  function onEnter() {
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    setOpen(true);
  }
  function onLeave() {
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    hoverTimeout.current = window.setTimeout(() => setOpen(false), 120);
  }

  return (
    <span className={`relative inline-block ${className ?? ""}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">
        {fullName}
      </span>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-slate-900">{fullName}</div>
              <div className="mt-0.5 text-xs uppercase tracking-widest text-slate-400">Client</div>
            </div>
            {canInvite ? (
              <InviteClientButton
                fullName={fullName}
                email={contact?.email ?? email ?? null}
                isActivated={isActivated}
                hasInvite={hasInvite}
                disabledReason={inviteDisabledReason}
              />
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
              Yükleniyor...
            </div>
          ) : error ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600">
              {error}
            </div>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="col-span-2 flex justify-between">
                <dt className="text-slate-500">E-posta</dt>
                <dd className="text-right">{contact?.email ?? email ?? "—"}</dd>
              </div>
              <div className="col-span-2 flex justify-between">
                <dt className="text-slate-500">Telefon</dt>
                <dd className="text-right">{contact?.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tip</dt>
                <dd className="text-right">{contact?.type ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Durum</dt>
                <dd className="text-right">{contact?.status ?? "—"}</dd>
              </div>
              <div className="col-span-2 flex justify-between">
                <dt className="text-slate-500">Portal Daveti</dt>
                <dd className="text-right">{portalStatus}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Etiketler</dt>
                <dd className="mt-1 flex flex-wrap justify-end gap-1">
                  {contact?.tags?.length
                    ? contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                        >
                          #{tag}
                        </span>
                      ))
                    : <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div className="col-span-2 flex justify-between">
                <dt className="text-slate-500">Sahip</dt>
                <dd className="text-right">
                  {contact?.owner?.name ?? contact?.owner?.email ?? "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      ) : null}
    </span>
  );
}
