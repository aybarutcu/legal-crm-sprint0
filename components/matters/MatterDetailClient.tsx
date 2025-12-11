"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Scale, Building, User, Plus } from "lucide-react";
import { MATTER_TYPES } from "@/lib/validation/matter";
import { CONTACT_TYPES, CONTACT_STATUS } from "@/lib/validation/contact";
import type { ContactOption, MatterDetail, MatterParty } from "@/components/matters/types";
import { WorkflowDialog } from "./workflow-dialog";
import type { DocumentListItem } from "@/components/documents/types";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";
import { isTerminal } from "@/lib/workflows/state-machine";
import { MatterDocumentUploadDialog } from "@/components/documents/MatterDocumentUploadDialog";
import { WorkflowManagementSection } from "@/components/matters/workflows";
import {
  MatterPartiesSection,
  MatterStatusUpdateSection,
} from "@/components/matters/sections";
import { MatterTeamSection } from "@/components/matters/MatterTeamSection";
import { MatterActivitySection } from "@/components/matters/MatterActivitySection";
import { MatterStatusBadge } from "./MatterStatusBadge";
import { MetadataCard } from "./MetadataCard";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { formatDateWithRelative } from "@/lib/date-utils";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ClientInfoCard } from "./ClientInfoCard";
import { EditContactDialog } from "@/components/contact/edit-contact-dialog";

type ActionType =
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "AUTOMATION_EMAIL"
  | "AUTOMATION_WEBHOOK";

type ActionState =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

function defaultConfigFor(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    case "APPROVAL":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC":
      return { requestText: "", documentNames: [] };
    case "PAYMENT":
      return { amount: 0, currency: "USD", provider: "mock" };
    case "WRITE_TEXT":
      return {
        title: "",
        description: "",
        placeholder: "Enter your text here...",
        minLength: 0,
        maxLength: undefined,
        required: true,
      };
    case "POPULATE_QUESTIONNAIRE":
      return { questionnaireId: null, title: "", description: "", dueInDays: undefined };
    case "AUTOMATION_EMAIL":
      return {
        recipients: ["{{contact.email}}"],
        cc: [],
        subjectTemplate: "Automated update for {{matter.title}}",
        bodyTemplate: "Hello {{contact.firstName}},\n\nWe will keep you posted.\n",
        sendStrategy: "IMMEDIATE",
        delayMinutes: null,
      };
    case "AUTOMATION_WEBHOOK":
      return {
        url: "https://example.com/webhooks/workflow",
        method: "POST",
        headers: [],
        payloadTemplate: JSON.stringify(
          {
            matterId: "{{matter.id}}",
            stepId: "{{step.id}}",
          },
          null,
          2,
        ),
        sendStrategy: "IMMEDIATE",
        delayMinutes: null,
      };
    case "CHECKLIST":
    default:
      return { items: [] };
  }
}

type WorkflowInstanceStep = {
  id: string;
  order: number;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: Record<string, unknown> | null;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string | null; email: string | null } | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  dependsOn?: string[];
  nextStepOnTrue?: string | null;
  nextStepOnFalse?: string | null;
  positionX?: number;
  positionY?: number;
  notificationPolicies?: NotificationPolicy[];
  automationLog?: unknown;
  notificationLog?: unknown;
};

type WorkflowInstance = {
  id: string;
  templateVersion: number;
  template: { id: string; name: string; version?: number };
  createdBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  steps: WorkflowInstanceStep[];
};

const _dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type MatterDetailClientProps = {
  matter: MatterDetail;
  contacts: ContactOption[];
  documents?: DocumentListItem[];
  currentUserRole?: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";
  currentUserId?: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type PartyFormState = {
  contactId: string;
  role: string;
};

const initialPartyForm: PartyFormState = {
  contactId: "",
  role: "PLAINTIFF",
};

export function MatterDetailClient({ matter, contacts, currentUserRole, currentUserId }: MatterDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(matter.status);
  const [nextHearingAt, setNextHearingAt] = useState(matter.nextHearingAt ?? "");
  const [toast, setToast] = useState<ToastState>(null);
  const [parties, setParties] = useState<MatterParty[]>(matter.parties);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadWorkflowStepId, setUploadWorkflowStepId] = useState<string | null>(null);
  const [uploadDocumentTags, setUploadDocumentTags] = useState<string[]>([]);
  const [uploadParentDocumentId, setUploadParentDocumentId] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState(initialPartyForm);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [_workflowsLoading, setWorkflowsLoading] = useState(false);
  const [matterTeamMemberIds, setMatterTeamMemberIds] = useState<string[]>([]);
  const [folderTreeRefreshKey, setFolderTreeRefreshKey] = useState(0);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<DocumentListItem[]>(matter.documents ?? []);
  const [docsLoading, setDocsLoading] = useState(false);
  const [_downloadingId, _setDownloadingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);

  // State for new timeline and detail view
  const [_selectedWorkflowId, _setSelectedWorkflowId] = useState<string | null>(null);
  const [_selectedStepId, _setSelectedStepId] = useState<string | null>(null);
  const [_attachedDocumentIds, _setAttachedDocumentIds] = useState<string[]>([]);

  // State for tabs and editing
  const [activeTab, setActiveTab] = useState<"overview" | "team" | "activity" | "settings">("overview");
  const [isEditingMatter, setIsEditingMatter] = useState(false);
  const [matterEditForm, setMatterEditForm] = useState({
    title: matter.title,
    type: matter.type,
    jurisdiction: matter.jurisdiction ?? "",
    court: matter.court ?? "",
  });

  // State for contact edit dialog
  const [editContactDialogOpen, setEditContactDialogOpen] = useState(false);
  const [editContactData, setEditContactData] = useState<{
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    type: (typeof CONTACT_TYPES)[number];
    status: (typeof CONTACT_STATUS)[number];
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    preferredLanguage: string | null;
    source: string | null;
    tags: string[];
  } | null>(null);

  const isWorkflowRemovable = useMemo(
    () => currentUserRole === "ADMIN" || currentUserRole === "LAWYER",
    [currentUserRole],
  );

  // Function to fetch full contact data for editing
  const handleEditContactClick = useCallback(async () => {
    try {
      const response = await fetch(`/api/contacts/${matter.client.id}`);
      if (response.ok) {
        const contact = await response.json();
        setEditContactData({
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
          tags: Array.isArray(contact.tags) ? contact.tags : [],
        });
        setEditContactDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch contact data:", error);
    }
  }, [matter.client.id]);

  useEffect(() => {
    void loadWorkflowInstances();
    void loadRelatedDocuments();
    void loadMatterTeam();
  }, []);

    // Auto-select current step when workflows load or change
  useEffect(() => {
    if (workflows.length > 0 && !_selectedStepId) {
      // Find the first active workflow and its current step
      const activeWorkflow = workflows.find(w => w.status === "ACTIVE") || workflows[0];
      if (activeWorkflow) {
        // Prioritize READY steps first
        const readyStep = activeWorkflow.steps.find(s => s.actionState === "READY");
        if (readyStep) {
          _setSelectedWorkflowId(activeWorkflow.id);
          _setSelectedStepId(readyStep.id);
        } else {
          // Fallback: find the first non-terminal step
          const currentStep = activeWorkflow.steps.find(s => !isTerminal(s.actionState));
          if (currentStep) {
            _setSelectedWorkflowId(activeWorkflow.id);
            _setSelectedStepId(currentStep.id);
          } else {
            // If all steps are terminal, select the last step
            const lastStep = activeWorkflow.steps[activeWorkflow.steps.length - 1];
            if (lastStep) {
              _setSelectedWorkflowId(activeWorkflow.id);
              _setSelectedStepId(lastStep.id);
            }
          }
        }
      }
    }
  }, [workflows, _selectedStepId]);

  // Update highlighted documents when step is selected
  useEffect(() => {
    if (!_selectedStepId) {
      _setAttachedDocumentIds([]);
      return;
    }

    const stepDocumentIds = relatedDocs
      .filter((doc) => (doc as { workflowStepId?: string }).workflowStepId === _selectedStepId)
      .map((doc) => doc.id);

    _setAttachedDocumentIds(stepDocumentIds);
  }, [_selectedStepId, relatedDocs]);

  async function loadWorkflowInstances() {
    setWorkflowsLoading(true);
    try {
      console.log('[MatterDetailClient] Loading workflow instances...');
      const response = await fetch(`/api/workflows/instances?matterId=${matter.id}`);
      if (!response.ok) {
        throw new Error("Workflows could not be loaded");
      }
      const data = (await response.json()) as Array<WorkflowInstance>;
      console.log('[MatterDetailClient] Loaded workflows:', data);

      setWorkflows(
        data.map((instance) => {
          const sortedSteps = instance.steps.slice().sort((a, b) => a.order - b.order);

          return {
            ...instance,
            steps: sortedSteps.map((step) => ({
              ...step,
              actionData: step.actionData ?? null,
            })),
          };
        }),
      );
    } catch (error) {
      console.error(error);
      showToast("error", "Workflows could not be loaded.");
    } finally {
      setWorkflowsLoading(false);
    }
  }

  async function loadRelatedDocuments() {
    setDocsLoading(true);
    try {
      const response = await fetch(`/api/documents?matterId=${matter.id}&page=1&pageSize=50`);
      if (!response.ok) {
        throw new Error("Documents could not be loaded");
      }
      const payload: { data: DocumentListItem[] } = await response.json();
      setRelatedDocs(payload.data);
    } catch (error) {
      console.error(error);
    } finally {
      setDocsLoading(false);
    }
  }

  async function loadMatterTeam() {
    try {
      const response = await fetch(`/api/matters/${matter.id}/team`);
      if (response.ok) {
        const teamMembers = await response.json();
        // Extract user IDs from team members and include the matter owner
        const memberIds: string[] = teamMembers.map((member: { userId: string }) => member.userId);
        if (matter.owner?.id) {
          memberIds.push(matter.owner.id);
        }
        setMatterTeamMemberIds([...new Set(memberIds)]); // Deduplicate
      }
    } catch (error) {
      console.error("Failed to load matter team:", error);
    }
  }

 

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function submitUpdate() {
    setLoading(true);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          nextHearingAt: nextHearingAt ? new Date(nextHearingAt).toISOString() : null,
        }),
      });
      if (!response.ok) {
        throw new Error("Dava güncellenemedi");
      }
      showToast("success", "Dava bilgileri güncellendi.");
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast("error", "Güncelleme başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }

  async function submitMatterEdit() {
    if (!matterEditForm.title.trim()) {
      showToast("error", "Dava başlığı gerekli.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: matterEditForm.title.trim(),
          type: matterEditForm.type,
          jurisdiction: matterEditForm.jurisdiction.trim() || null,
          court: matterEditForm.court.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error("Dava güncellenemedi");
      }
      showToast("success", "Dava bilgileri güncellendi.");
      setIsEditingMatter(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast("error", "Güncelleme başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }

  async function submitParty() {
    if (!partyForm.contactId) {
      showToast("error", "Taraf seçiniz.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/matters/${matter.id}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: partyForm.contactId,
          role: partyForm.role,
        }),
      });
      if (!response.ok) {
        throw new Error("Taraf eklenemedi");
      }
      const created = await response.json();
      setParties((prev) => [
        {
          id: created.id,
          role: created.role,
          contact: created.contact,
        },
        ...prev,
      ]);
      showToast("success", "Taraf eklendi.");
      setPartyForm(initialPartyForm);
      setPartyModalOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast("error", "Taraf ekleme başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }

  async function removeParty(partyId: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/matters/${matter.id}/parties/${partyId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Taraf silinemedi");
      }
      setParties((prev) => prev.filter((party) => party.id !== partyId));
      showToast("success", "Taraf silindi.");
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast("error", "Taraf silme başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }


  const openDocDetail = useCallback((doc: DocumentListItem) => {
    setSelectedDocumentId(doc.id);
    setSelectedDocument(doc);
  }, []);

  const closeDocDetail = useCallback(() => {
    setSelectedDocumentId(null);
    setSelectedDocument(null);
  }, []);

  const handleDocUpdated = useCallback((updated: DocumentListItem) => {
    setRelatedDocs((prev) => {
      const exists = prev.some((d) => d.id === updated.id);
      return exists ? prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)) : [updated, ...prev];
    });
    setSelectedDocumentId(updated.id);
    setSelectedDocument((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : updated));
    setFolderTreeRefreshKey((prev) => prev + 1);
  }, []);

  function handleAddDocumentForStep(stepId: string, requestId: string, documentName: string, existingDocumentId?: string) {
    // Set the workflow step, requestId, and document tag for upload
    console.log('[MatterDetailClient] handleAddDocumentForStep called:', {
      stepId,
      requestId,
      documentName,
      existingDocumentId,
      existingDocumentIdType: typeof existingDocumentId,
      requestIdType: typeof requestId,
      documentNameType: typeof documentName,
    });
    setUploadWorkflowStepId(stepId);
    
    // If documentName is missing, extract it from requestId
    // requestId format: "stepId-document-name-in-kebab-case"
    let finalDocumentName = documentName;
    if (!finalDocumentName && requestId && requestId.includes('-')) {
      // Extract the document name part from requestId
      const parts = requestId.split('-');
      // Skip the first part (stepId which is typically 25 chars)
      if (parts.length > 1 && parts[0].length > 15) {
        finalDocumentName = parts.slice(1).join('-');
      }
    }
    
    const tags = [requestId, finalDocumentName];
    console.log('[MatterDetailClient] Tags to set:', tags);
    setUploadDocumentTags(tags);
    
    // Store the existing document ID for versioning
    if (existingDocumentId) {
      console.log('[MatterDetailClient] Setting parentDocumentId:', existingDocumentId);
      setUploadParentDocumentId(existingDocumentId);
    } else {
      console.log('[MatterDetailClient] No existingDocumentId provided, setting to null');
      setUploadParentDocumentId(null);
    }
    
    console.log('[MatterDetailClient] Opening dialog with parentDocumentId state:', existingDocumentId || null);
    setIsUploadDialogOpen(true);
  }

  async function updateStepMetadata(
    instanceId: string, 
    stepId: string, 
    data: { dueDate?: string | null; assignedToId?: string | null; priority?: string | null }
  ) {
    try {
      const response = await fetch(`/api/workflows/instances/${instanceId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Failed to update step");
      }
      await loadWorkflowInstances();
      showToast("success", "Step updated successfully.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Failed to update step.");
    }
  }

  async function cancelWorkflow(instanceId: string) {
    if (!isWorkflowRemovable) {
      showToast("error", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }
    const reason = window.prompt(
      "Workflow'u iptal etmek istediğinize emin misiniz? Lütfen iptal sebebini yazın (boş bırakırsanız varsayılan kullanılacak).",
      "",
    );
    if (reason === null) return;
    try {
      setActionLoading(`${instanceId}:deleteInstance`);
      const response = await fetch(`/api/workflows/instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationReason: reason.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Workflow kaldırılamadı");
      }
      const result = await response.json().catch(() => null);
      await loadWorkflowInstances();
      showToast(
        "success",
        result?.cancelled
          ? "Workflow iptal edildi; bekleyen adımlar iptal edildi."
          : "Workflow kaldırıldı.",
      );
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Workflow kaldırılamadı.");
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteWorkflow(instanceId: string) {
    if (!isWorkflowRemovable) {
      showToast("error", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }
    const reason = window.prompt(
      "Workflow'u iptal etmek istediğinize emin misiniz? Lütfen iptal sebebini yazın (boş bırakırsanız varsayılan kullanılacak).",
      "",
    );
    if (reason === null) return;
    try {
      setActionLoading(`${instanceId}:deleteInstance`);
      const response = await fetch(`/api/workflows/instances/${instanceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationReason: reason.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Workflow kaldırılamadı");
      }
      const result = await response.json().catch(() => null);
      await loadWorkflowInstances();
      showToast(
        "success",
        result?.deleted
          ? "Workflow aldırıldı.."
          : "Unexpectet response.",
      );
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Workflow kaldırılamadı.");
    } finally {
      setActionLoading(null);
    }
  }

  const clientName = useMemo(() => {
    return `${matter.client.firstName} ${matter.client.lastName}`.trim();
  }, [matter.client]);

  const canEditMatter = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Matters", href: "/dashboard/matters" },
    { label: matter.type, href: `/dashboard/matters?type=${matter.type}` },
    { label: matter.title },
  ];

  // Mobile FAB state
  const [isMobileFabOpen, setIsMobileFabOpen] = useState(false);

  return (
    <div className="space-y-6 w-full" data-testid="matter-detail-client">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl">
        <div className="flex gap-1 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "overview"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "team"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "activity"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings"
                ? "border-accent text-accent"
                : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Matter Header with Edit capability */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card">
            {!isEditingMatter ? (
              <>
                {/* Status Badge & Actions Row */}
                <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-100">
                  <MatterStatusBadge status="OPEN" />
                  <div className="flex items-center gap-2">
                    {canEditMatter && (
                      <button
                        type="button"
                        onClick={() => setIsEditingMatter(true)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Düzenle
                      </button>
                    )}
                    <QuickActionsMenu
                      onAddDocument={() => setIsUploadDialogOpen(true)}
                      onAddParty={() => setPartyModalOpen(true)}
                      onAddTask={() => {
                        // TODO: Implement add task functionality
                        showToast("success", "Task feature coming soon");
                      }}
                      onAddWorkflow={() => setWorkflowModalOpen(true)}
                    />
                  </div>
                </div>

                {/* Matter Title & Client Section */}
                <div className="px-6 py-6">
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">{matter.title}</h2>
                  
                  {/* Client Info Card (Expandable) */}
                  <div className="mb-6">
                    <ClientInfoCard
                      contactId={matter.client.id}
                      clientName={clientName}
                      email={matter.client.email}
                      phone={matter.client.phone}
                      currentUserRole={currentUserRole}
                      onEditClick={
                        currentUserRole === "ADMIN" || currentUserRole === "LAWYER"
                          ? handleEditContactClick
                          : undefined
                      }
                    />
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetadataCard
                      icon={<Calendar className="h-5 w-5 text-blue-600" />}
                      label="Opened"
                      value={formatDateWithRelative(matter.openedAt).absolute}
                      subtitle={formatDateWithRelative(matter.openedAt).relative}
                    />
                    <MetadataCard
                      icon={<Scale className="h-5 w-5 text-purple-600" />}
                      label="Type"
                      value={matter.type}
                    />
                    <MetadataCard
                      icon={<Building className="h-5 w-5 text-slate-600" />}
                      label="Court"
                      value={matter.court || "—"}
                    />
                    <MetadataCard
                      icon={<User className="h-5 w-5 text-emerald-600" />}
                      label="Owner"
                      value={matter.owner?.name || matter.owner?.email || "Unassigned"}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Dava Bilgilerini Düzenle</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMatter(false);
                      setMatterEditForm({
                        title: matter.title,
                        type: matter.type,
                        jurisdiction: matter.jurisdiction ?? "",
                        court: matter.court ?? "",
                      });
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    İptal
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Başlık *
                    <input
                      type="text"
                      value={matterEditForm.title}
                      onChange={(e) => setMatterEditForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Tür
                    <select
                      value={matterEditForm.type}
                      onChange={(e) => setMatterEditForm((prev) => ({ ...prev, type: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    >
                      {MATTER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Jurisdiction
                    <input
                      type="text"
                      value={matterEditForm.jurisdiction}
                      onChange={(e) => setMatterEditForm((prev) => ({ ...prev, jurisdiction: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Mahkeme
                    <input
                      type="text"
                      value={matterEditForm.court}
                      onChange={(e) => setMatterEditForm((prev) => ({ ...prev, court: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitMatterEdit}
                    disabled={loading}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMatter(false);
                      setMatterEditForm({
                        title: matter.title,
                        type: matter.type,
                        jurisdiction: matter.jurisdiction ?? "",
                        court: matter.court ?? "",
                      });
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unified Workflow Management Section */}
          <WorkflowManagementSection
            entityId={matter.id}
            entityType="matter"
            workflows={workflows as any}
            currentUserRole={currentUserRole ?? "CLIENT"}
            currentUserId={currentUserId}
            canManageWorkflows={["ADMIN", "LAWYER", "PARALEGAL"].includes(currentUserRole ?? "")}
            documents={relatedDocs}
            docsLoading={docsLoading}
            onUploadDocument={() => setIsUploadDialogOpen(true)}
            onViewDocument={openDocDetail}
            highlightedDocumentIds={_attachedDocumentIds}
            teamMemberIds={matterTeamMemberIds}
            matterOwnerId={matter.owner?.id}
            folderTreeRefreshKey={folderTreeRefreshKey}
            onRefresh={loadWorkflowInstances}
            onAddWorkflow={() => setWorkflowModalOpen(true)}
            onCancelWorkflow={cancelWorkflow}
            onDeleteWorkflow={deleteWorkflow}
            onUpdateStepMetadata={updateStepMetadata}
            onAddDocumentForStep={handleAddDocumentForStep}
          />
        </>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <MatterTeamSection
            matterId={matter.id}
            currentUserRole={currentUserRole}
            matterOwnerId={matter.owner?.id}
          />
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <MatterActivitySection matterId={matter.id} />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Parties Section */}
            <MatterPartiesSection
              parties={parties}
              onAddParty={() => setPartyModalOpen(true)}
              onRemoveParty={removeParty}
            />

            {/* Status Update Section */}
            <MatterStatusUpdateSection
              status={status}
              nextHearingAt={nextHearingAt}
              loading={loading}
              onStatusChange={setStatus}
              onHearingDateChange={setNextHearingAt}
              onSubmit={submitUpdate}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {partyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">Taraf Ekle</h4>
              <button
                type="button"
                onClick={() => {
                  setPartyModalOpen(false);
                  setPartyForm(initialPartyForm);
                }}
                className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Kapat
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="text-sm font-medium text-slate-700">
                Contact
                <select
                  value={partyForm.contactId}
                  onChange={(event) =>
                    setPartyForm((prev) => ({ ...prev, contactId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Seçiniz</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.email ? `(${contact.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Rol
                <select
                  value={partyForm.role}
                  onChange={(event) =>
                    setPartyForm((prev) => ({ ...prev, role: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="PLAINTIFF">PLAINTIFF</option>
                  <option value="DEFENDANT">DEFENDANT</option>
                  <option value="WITNESS">WITNESS</option>
                  <option value="OPPOSING_COUNSEL">OPPOSING_COUNSEL</option>
                </select>
              </label>

              <button
                type="button"
                onClick={submitParty}
                disabled={loading}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Ekleniyor..." : "Taraf Ekle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DocumentDetailDrawer
        documentId={selectedDocumentId}
        initialDocument={selectedDocument}
        onClose={closeDocDetail}
        onUpdated={handleDocUpdated}
      />

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
        >
          {toast.message}
        </div>
      ) : null}

      <WorkflowDialog
        matterId={matter.id}
        isOpen={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        onInstantiated={async () => {
          await loadWorkflowInstances();
          showToast("success", "Workflow added to matter.");
        }}
      />

      <MatterDocumentUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => {
          setIsUploadDialogOpen(false);
          setUploadWorkflowStepId(null);
          setUploadDocumentTags([]);
          setUploadParentDocumentId(null);
        }}
        matterId={matter.id}
        workflowStepId={uploadWorkflowStepId}
        tags={uploadDocumentTags}
        parentDocumentId={uploadParentDocumentId}
        onUploadComplete={async (uploadedDocumentId) => {
          await loadRelatedDocuments();
          await loadWorkflowInstances(); // Refresh workflow to update document status
          setFolderTreeRefreshKey(prev => prev + 1); // Trigger folder tree refresh
          
          // If a new document was uploaded and drawer is open, switch to the new document
          if (uploadedDocumentId) {
            console.log('[MatterDetailClient] New document uploaded:', uploadedDocumentId);
            setSelectedDocumentId(uploadedDocumentId);
            try {
              // Add a small delay to ensure the document is fully created in DB
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const response = await fetch(`/api/documents/${uploadedDocumentId}`);
              if (response.ok) {
                const newDoc = await response.json();
                console.log('[MatterDetailClient] Fetched new document:', newDoc);
                setSelectedDocument(newDoc);
              } else {
                console.error('[MatterDetailClient] Failed to fetch document:', response.status);
              }
            } catch (error) {
              console.error('Failed to load newly uploaded document:', error);
            }
          }
          
          showToast("success", "Document uploaded successfully.");
          setUploadWorkflowStepId(null);
          setUploadDocumentTags([]);
          setUploadParentDocumentId(null);
        }}
      />

      {/* Mobile Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        {isMobileFabOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/20"
              onClick={() => setIsMobileFabOpen(false)}
              aria-hidden="true"
            />
            
            {/* Action buttons */}
            <div className="relative mb-4 flex flex-col gap-3 items-end">
              <button
                type="button"
                onClick={() => {
                  setIsUploadDialogOpen(true);
                  setIsMobileFabOpen(false);
                }}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50"
              >
                <span>Add Document</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPartyModalOpen(true);
                  setIsMobileFabOpen(false);
                }}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50"
              >
                <span>Add Party</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorkflowModalOpen(true);
                  setIsMobileFabOpen(false);
                }}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50"
              >
                <span>Add Workflow</span>
              </button>
            </div>
          </>
        )}
        
        {/* Main FAB Button */}
        <button
          type="button"
          onClick={() => setIsMobileFabOpen(!isMobileFabOpen)}
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-all ${isMobileFabOpen ? 'rotate-45' : ''}`}
          aria-label="Quick actions"
          aria-expanded={isMobileFabOpen}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Edit Contact Dialog */}
      {(currentUserRole === "ADMIN" || currentUserRole === "LAWYER") && editContactData && (
        <EditContactDialog
          contactId={matter.client.id}
          initialData={editContactData}
          open={editContactDialogOpen}
          onClose={() => {
            setEditContactDialogOpen(false);
            setEditContactData(null);
          }}
          onUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}
import type { NotificationPolicy } from "@/lib/workflows/notification-policy";
