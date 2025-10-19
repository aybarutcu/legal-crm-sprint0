"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Mail, User as UserIcon, Tag, Building2, ExternalLink, MapPin, Phone, Globe, Briefcase } from "lucide-react";
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
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
  source?: string | null;
  type?: string;
  status?: string;
  tags?: string[];
  owner?: ContactOwner;
  user?: ContactUser;
};

interface ClientInfoCardProps {
  contactId: string;
  clientName: string;
  email: string | null;
  phone?: string | null;
  currentUserRole?: RoleUnion;
}

export function ClientInfoCard({ contactId, clientName, email, phone, currentUserRole }: ClientInfoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (activated) return { label: "Aktif", date: activated, color: "text-emerald-600" };
    if (invited) return { label: "Davet gönderildi", date: invited, color: "text-yellow-600" };
    return { label: "Davet gönderilmedi", date: null, color: "text-slate-500" };
  }, [contact]);

  useEffect(() => {
    if (isExpanded && !contact && !loading && !error) {
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
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Kişi bilgileri alınamadı.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isExpanded, contact, loading, error, contactId]);

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-white/50 transition-colors rounded-xl"
      >
        {/* Client Avatar */}
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xl font-bold">
          {clientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {clientName}
          </h3>
          {email && (
            <p className="text-sm text-slate-600">{email}</p>
          )}
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Email Button */}
          {email && (
            <a
              href={`mailto:${email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-all"
              title={`Email ${clientName}`}
              aria-label={`Send email to ${clientName}`}
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          
          {/* Phone Button */}
          {phone && (
            <a
              href={`tel:${phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-green-400 hover:text-green-600 transition-all"
              title={`Call ${clientName}`}
              aria-label={`Call ${clientName}`}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
        
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-200">
          {loading ? (
            <div className="py-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
              <p className="mt-2 text-sm text-slate-600">Loading details...</p>
            </div>
          ) : error ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : contact ? (
            <div className="space-y-4 pt-4">
              {/* Portal Invite Section */}
              {canInvite && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Portal Status</p>
                    <p className={`text-sm font-medium ${portalStatus.color}`}>
                      {portalStatus.label}
                      {portalStatus.date && <span className="text-slate-500 ml-1">• {portalStatus.date}</span>}
                    </p>
                  </div>
                  <InviteClientButton
                    fullName={clientName}
                    email={contact.email ?? email ?? null}
                    isActivated={isActivated}
                    hasInvite={hasInvite}
                    disabledReason={inviteDisabledReason}
                  />
                </div>
              )}

              {/* Contact Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
                  </div>
                  <p className="text-sm text-slate-900 truncate">{contact.email ?? email ?? "—"}</p>
                </div>

                {/* Phone */}
                {contact.phone && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</p>
                    </div>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {/* Company */}
                {contact.company && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</p>
                    </div>
                    <p className="text-sm text-slate-900 truncate">{contact.company}</p>
                  </div>
                )}

                {/* Type */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</p>
                  </div>
                  <p className="text-sm text-slate-900">{contact.type ?? "—"}</p>
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</p>
                  </div>
                  <p className="text-sm text-slate-900">{contact.status ?? "—"}</p>
                </div>

                {/* Preferred Language */}
                {contact.preferredLanguage && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Language</p>
                    </div>
                    <p className="text-sm text-slate-900">{contact.preferredLanguage}</p>
                  </div>
                )}

                {/* Source */}
                {contact.source && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</p>
                    </div>
                    <p className="text-sm text-slate-900">{contact.source}</p>
                  </div>
                )}
              </div>

              {/* Address Section */}
              {(contact.address || contact.city || contact.state || contact.zip || contact.country) && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</p>
                  </div>
                  <div className="text-sm text-slate-900 space-y-0.5">
                    {contact.address && <p>{contact.address}</p>}
                    {(contact.city || contact.state || contact.zip) && (
                      <p>
                        {[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {contact.country && <p>{contact.country}</p>}
                  </div>
                </div>
              )}

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Owner */}
              {contact.owner && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</p>
                  </div>
                  <p className="text-sm text-slate-900">
                    {contact.owner.name ?? contact.owner.email ?? "—"}
                  </p>
                </div>
              )}

              {/* View Full Profile Link */}
              <a
                href={`/dashboard/contacts/${contactId}`}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-blue-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Profile
              </a>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
