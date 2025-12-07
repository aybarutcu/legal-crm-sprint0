"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Contact, Role } from "@prisma/client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ContactInfoSection } from "./contact-info-section";
import { ContactWorkflowsSection } from "./contact-workflows-section";
import { ContactActivitySection } from "./contact-activity-section";

type ContactWithRelations = Contact & {
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
  workflowInstances: Array<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt?: Date;
    template: {
      id: string;
      name: string;
      description: string | null;
    } | null;
    steps: Array<{
      id: string;
      title: string;
      actionType: string;
      actionState: string;
      actionData: Record<string, unknown> | null;
      roleScope: string;
      required: boolean;
      assignedToId: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      positionX: number | null;
      positionY: number | null;
      order?: number;
    }>;
    dependencies: Array<{
      id: string;
      sourceStepId: string;
      targetStepId: string;
      dependencyType: string;
      dependencyLogic: string;
      conditionType: string | null;
      conditionConfig: Record<string, unknown> | null;
    }>;
  }>;
};

type TabType = "overview" | "workflows" | "activity";

export function ContactDetailClient({
  contact,
  currentUserRole,
}: {
  contact: ContactWithRelations;
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<TabType>("overview");

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const isLead = contact.type === "LEAD";
  const canManageWorkflows = ["ADMIN", "LAWYER", "PARALEGAL"].includes(currentUserRole);
  
  const activeWorkflowsCount = contact.workflowInstances?.filter(
    (w) => w.status === "ACTIVE"
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: "Contacts", href: "/contacts" },
          { label: contact.type, href: `/contacts?type=${contact.type}` },
          { label: fullName, href: "#" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {contact.type} Contact • {contact.status}
          </p>
        </div>
        <div className="flex gap-2">
          {contact.type === "LEAD" && (
            <Link
              href={`/contacts/${contact.id}/convert`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Convert to Client
            </Link>
          )}
          <Link
            href="/contacts"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Contacts
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setSelectedTab("overview")}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              selectedTab === "overview"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            Overview
          </button>

          {isLead && canManageWorkflows && (
            <button
              onClick={() => setSelectedTab("workflows")}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                selectedTab === "workflows"
                  ? "border-accent text-accent"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              Workflows
              {activeWorkflowsCount > 0 && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  {activeWorkflowsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setSelectedTab("activity")}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              selectedTab === "activity"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            Activity
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === "overview" && (
        <ContactInfoSection
          contact={contact}
          currentUserRole={currentUserRole}
          onRefresh={() => router.refresh()}
        />
      )}

      {selectedTab === "workflows" && isLead && (
        <ContactWorkflowsSection
          contactId={contact.id}
          workflows={contact.workflowInstances as any || []}
          currentUserRole={currentUserRole as Role}
          canManageWorkflows={canManageWorkflows}
          onRefresh={() => router.refresh()}
        />
      )}

      {selectedTab === "activity" && (
        <ContactActivitySection contactId={contact.id} />
      )}
    </div>
  );
}
