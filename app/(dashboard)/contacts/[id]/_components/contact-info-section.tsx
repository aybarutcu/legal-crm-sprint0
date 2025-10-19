"use client";

import type { Contact, Role } from "@prisma/client";
import { InviteClientButton } from "@/components/contact/InviteClientButton";

type ContactInfoProps = {
  contact: Contact & {
    owner: { id: string; name: string | null; email: string } | null;
    user: {
      id: string;
      email: string;
      role: Role;
      invitedAt: Date | null;
      activatedAt: Date | null;
      isActive: boolean;
    } | null;
    matters: Array<{
      matter: {
        id: string;
        title: string;
        status: string;
        openedAt: Date;
      };
      role: string;
    }>;
    clientMatters: Array<{
      id: string;
      title: string;
      status: string;
      openedAt: Date;
    }>;
  };
  currentUserRole: string;
  onRefresh: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ContactInfoSection({ contact, currentUserRole }: ContactInfoProps) {
  const canInvite = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const contactEmail = contact.email ?? null;
  const portalUser = contact.user;
  const isActivated = Boolean(portalUser?.activatedAt);
  const hasInvite = Boolean(portalUser?.invitedAt);
  
  const portalStatus = portalUser?.activatedAt
    ? `Active • ${dateFormatter.format(portalUser.activatedAt)}`
    : portalUser?.invitedAt
      ? `Invited • ${dateFormatter.format(portalUser.invitedAt)}`
      : "Not invited";
      
  const inviteDisabledReason =
    !contactEmail
      ? "Cannot invite without email address"
      : portalUser && portalUser.role !== "CLIENT"
        ? "User has non-client role"
        : null;

  const allMatters = [
    ...contact.clientMatters.map((m) => ({ ...m, role: "PRIMARY_CLIENT" })),
    ...contact.matters.map((m) => ({ ...m.matter, role: m.role })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      {/* Main Info Card */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Contact Information</h3>
            {canInvite && contact.type === "CLIENT" && (
              <InviteClientButton
                fullName={fullName}
                email={contactEmail}
                isActivated={isActivated}
                hasInvite={hasInvite}
                disabledReason={inviteDisabledReason}
              />
            )}
          </div>

          <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Type</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  contact.type === "LEAD" 
                    ? "bg-amber-100 text-amber-800"
                    : contact.type === "CLIENT"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-800"
                }`}>
                  {contact.type}
                </span>
              </dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                  {contact.status}
                </span>
              </dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-900">{contact.email || "—"}</dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd className="mt-1 text-slate-900">{contact.phone || "—"}</dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Company</dt>
              <dd className="mt-1 text-slate-900">{contact.company || "—"}</dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Owner</dt>
              <dd className="mt-1 text-slate-900">
                {contact.owner?.name || contact.owner?.email || "—"}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Address</dt>
              <dd className="mt-1 text-slate-900">
                {contact.address && (
                  <div>
                    {contact.address}
                    {(contact.city || contact.state || contact.zip) && (
                      <div>
                        {[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {contact.country && <div>{contact.country}</div>}
                  </div>
                )}
                {!contact.address && "—"}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">No tags</span>
                )}
              </dd>
            </div>

            {contact.type === "CLIENT" && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-slate-500">Portal Status</dt>
                <dd className="mt-1 text-slate-900">{portalStatus}</dd>
              </div>
            )}

            <div>
              <dt className="font-medium text-slate-500">Created</dt>
              <dd className="mt-1 text-slate-900">
                {dateFormatter.format(contact.createdAt)}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-slate-500">Last Updated</dt>
              <dd className="mt-1 text-slate-900">
                {dateFormatter.format(contact.updatedAt)}
              </dd>
            </div>
          </dl>

          {contact.notes && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <dt className="font-medium text-slate-500">Notes</dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                {contact.notes}
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Related Matters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Related Matters</h3>
        <div className="mt-4 space-y-3">
          {allMatters.length > 0 ? (
            allMatters.map((matter) => (
              <div
                key={matter.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="font-medium text-slate-900">{matter.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="uppercase">{matter.status}</span>
                  <span>•</span>
                  <span>{matter.role}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No related matters</p>
          )}
        </div>
      </div>
    </div>
  );
}
