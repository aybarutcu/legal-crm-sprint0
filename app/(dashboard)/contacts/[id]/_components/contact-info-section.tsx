"use client";

import { useState } from "react";
import type { Contact, Role } from "@prisma/client";
import { ClientInfoCard } from "@/components/matters/ClientInfoCard";
import { EditContactDialog } from "@/components/contact/edit-contact-dialog";

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

export function ContactInfoSection({ contact, currentUserRole, onRefresh }: ContactInfoProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  const allMatters = [
    ...contact.clientMatters.map((m) => ({ ...m, role: "PRIMARY_CLIENT" })),
    ...contact.matters.map((m) => ({ ...m.matter, role: m.role })),
  ];

  // Can edit if ADMIN or LAWYER
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Main Info Card - Using ClientInfoCard */}
        <div className="space-y-6">
          <ClientInfoCard
            contactId={contact.id}
            clientName={fullName}
            email={contact.email}
            phone={contact.phone}
            currentUserRole={currentUserRole as "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT" | undefined}
            initialExpanded={true}
            onEditClick={canEdit ? () => setEditDialogOpen(true) : undefined}
          />

        {/* Notes Section - if exists */}
        {contact.notes && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {contact.notes}
            </p>
          </div>
        )}
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

    {/* Edit Dialog */}
    {canEdit && (
      <EditContactDialog
        contactId={contact.id}
        initialData={{
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          type: contact.type,
          status: contact.status,
          address: contact.address,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          country: contact.country,
          preferredLanguage: contact.preferredLanguage,
          source: contact.source,
          tags: contact.tags,
        }}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onUpdated={onRefresh}
      />
    )}
    </>
  );
}
