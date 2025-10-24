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
import { WorkflowTimeline, WorkflowStepDetail } from "@/components/matters/workflows";
import {
  MatterPartiesSection,
  MatterDocumentsSection,
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
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC"
  | "PAYMENT_CLIENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE";

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
    case "APPROVAL_LAWYER":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE_CLIENT":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC":
      return { requestText: "", documentNames: [] };
    case "PAYMENT_CLIENT":
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
  positionX?: number;
  positionY?: number;
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

export function MatterDetailClient({ matter, contacts, currentUserRole }: MatterDetailClientProps) {
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
  const [partyForm, setPartyForm] = useState(initialPartyForm);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [_workflowsLoading, setWorkflowsLoading] = useState(false);
  const [stepFormState, setStepFormState] = useState<
    | null
    | {
      mode: "add" | "edit";
      instanceId: string;
      stepId?: string;
    }
  >(null);
  const [stepFormValues, setStepFormValues] = useState({
    title: "",
    actionType: "CHECKLIST" as ActionType,
    roleScope: "ADMIN" as RoleScope,
    required: true,
    actionConfig: "{}",
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<DocumentListItem[]>(matter.documents ?? []);
  const [docsLoading, setDocsLoading] = useState(false);
  const [_downloadingId, _setDownloadingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);

  // State for action execution UIs
  const [checklistStates, setChecklistStates] = useState<Record<string, Set<string>>>({});
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});

  // State for execution log
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  // State for new timeline and detail view
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([]);

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
  }, []);

  // Auto-select current step when workflows load or change
  useEffect(() => {
    if (workflows.length > 0 && !selectedStepId) {
      // Find the first active workflow and its current step
      const activeWorkflow = workflows.find(w => w.status === "ACTIVE") || workflows[0];
      if (activeWorkflow) {
        const currentStep = activeWorkflow.steps.find(s => !isTerminal(s.actionState));
        if (currentStep) {
          setSelectedWorkflowId(activeWorkflow.id);
          setSelectedStepId(currentStep.id);
        } else {
          // If all steps are terminal, select the last step
          const lastStep = activeWorkflow.steps[activeWorkflow.steps.length - 1];
          if (lastStep) {
            setSelectedWorkflowId(activeWorkflow.id);
            setSelectedStepId(lastStep.id);
          }
        }
      }
    }
  }, [workflows, selectedStepId]);

  // Update highlighted documents when step is selected
  useEffect(() => {
    if (!selectedStepId) {
      setAttachedDocumentIds([]);
      return;
    }

    // Filter documents that are linked to the selected step
    const stepDocumentIds = relatedDocs
      .filter((doc) => (doc as { workflowStepId?: string }).workflowStepId === selectedStepId)
      .map((doc) => doc.id);
    
    setAttachedDocumentIds(stepDocumentIds);
  }, [selectedStepId, relatedDocs]);

  async function loadWorkflowInstances() {
    setWorkflowsLoading(true);
    try {
      const response = await fetch(`/api/workflows/instances?matterId=${matter.id}`);
      if (!response.ok) {
        throw new Error("Workflows could not be loaded");
      }
      const data = (await response.json()) as Array<WorkflowInstance>;

      setWorkflows(
        data.map((instance) => ({
          ...instance,
          steps: instance.steps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((step) => ({
              ...step,
              actionData: step.actionData ?? null,
            })),
        })),
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

  function openAddStep(instanceId: string) {
    setStepFormState({ mode: "add", instanceId });
    const config = defaultConfigFor("CHECKLIST");
    setStepFormValues({
      title: "",
      actionType: "CHECKLIST",
      roleScope: "ADMIN",
      required: true,
      actionConfig: JSON.stringify(config, null, 2),
    });
  }

  function closeStepForm() {
    setStepFormState(null);
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

  async function _handleDownload(doc: DocumentListItem) {
    _setDownloadingId(doc.id);
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) {
        throw new Error("İndirme bağlantısı alınamadı.");
      }
      const payload: { getUrl: string; mime?: string } = await response.json();
      const mime = payload.mime ?? doc.mime;
      if (mime.startsWith("application/pdf") || mime.startsWith("image/")) {
        window.open(payload.getUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = payload.getUrl;
      }
    } catch (error) {
      console.error(error);
      showToast("error", "İndirme bağlantısı oluşturulamadı.");
    } finally {
      _setDownloadingId(null);
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
    setRelatedDocs((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    setSelectedDocument((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  // TODO: Re-implement step form modal for adding/editing steps
  async function _submitStepForm() {
    if (!stepFormState) return;
    try {
      const configString = stepFormValues.actionConfig?.trim() ?? "";
      const parsedConfig = configString.length ? (JSON.parse(configString) as Record<string, unknown>) : {};

      const payload = {
        title: stepFormValues.title.trim(),
        actionType: stepFormValues.actionType,
        roleScope: stepFormValues.roleScope,
        required: stepFormValues.required,
        actionConfig: parsedConfig,
      };

      if (!payload.title) {
        showToast("error", "Adım başlığı gerekli.");
        return;
      }

      const endpoint =
        stepFormState.mode === "add"
          ? `/api/workflows/instances/${stepFormState.instanceId}/steps`
          : `/api/workflows/instances/${stepFormState.instanceId}/steps/${stepFormState.stepId}`;

      const response = await fetch(endpoint, {
        method: stepFormState.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Adım kaydedilemedi");
      }

      await loadWorkflowInstances();
      closeStepForm();
      showToast("success", "Adım kaydedildi.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Adım kaydedilemedi.");
    }
  }

  async function runStepAction(stepId: string, action: string, payload?: unknown) {
    try {
      setActionLoading(`${stepId}:${action}`);
      const isAdvance = action === "advance";
      const hasPayload = payload !== undefined;
      const response = await fetch(
        isAdvance
          ? `/api/workflows/instances/${stepId}/advance`
          : `/api/workflows/steps/${stepId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: isAdvance ? undefined : hasPayload ? JSON.stringify(payload) : undefined,
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "İşlem tamamlanamadı");
      }
      await loadWorkflowInstances();
      showToast("success", "Adım güncellendi.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleAddDocumentForStep(stepId: string, documentName: string) {
    // Set the workflow step and document tag for upload
    setUploadWorkflowStepId(stepId);
    setUploadDocumentTags([documentName]);
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

          {/* Workflow Timeline - Horizontal Timeline */}
          <WorkflowTimeline
            workflows={workflows}
            selectedStepId={selectedStepId}
            currentUserRole={currentUserRole}
            onStepClick={(workflowId, stepId) => {
              setSelectedWorkflowId(workflowId);
              setSelectedStepId(stepId);
            }}
            onAddWorkflow={() => setWorkflowModalOpen(true)}
                onCancelWorkflow={cancelWorkflow}
            onAddStep={openAddStep}
          />
          

          {/* Workflows (2/3) and Documents (1/3) Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Workflows Section - 2/3 width on large screens */}
            <div className="lg:col-span-2">
              <WorkflowStepDetail
                step={selectedStepId ? workflows.flatMap(w => w.steps).find(s => s.id === selectedStepId) ?? null : null}
                workflow={selectedWorkflowId ? workflows.find(w => w.id === selectedWorkflowId) ?? null : null}
                matterId={matter.id}
                actionLoading={actionLoading}
                hoveredStep={hoveredStep}
                currentUserRole={currentUserRole ?? "CLIENT"}
                onClose={() => {
                  setSelectedStepId(null);
                  setSelectedWorkflowId(null);
                }}
                onSetHoveredStep={setHoveredStep}
                onRunStepAction={runStepAction}
                onUpdateStepMetadata={updateStepMetadata}
                onAddDocumentForStep={handleAddDocumentForStep}
                checklistStates={checklistStates}
                approvalComments={approvalComments}
                documentFiles={documentFiles}
                onSetChecklistStates={setChecklistStates}
                onSetApprovalComments={setApprovalComments}
                onSetDocumentFiles={setDocumentFiles}
              />
            </div>

            {/* Documents Section - 1/3 width on large screens */}
            <MatterDocumentsSection
              documents={relatedDocs}
              loading={docsLoading}
              onUploadClick={() => setIsUploadDialogOpen(true)}
              onViewDocument={openDocDetail}
              highlightedDocumentIds={attachedDocumentIds}
            />
          </div>
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
        }}
        matterId={matter.id}
        workflowStepId={uploadWorkflowStepId}
        tags={uploadDocumentTags}
        onUploadComplete={async () => {
          await loadRelatedDocuments();
          await loadWorkflowInstances(); // Refresh workflow to update document status
          showToast("success", "Document uploaded successfully.");
          setUploadWorkflowStepId(null);
          setUploadDocumentTags([]);
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
