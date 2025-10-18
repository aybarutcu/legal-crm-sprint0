"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MATTER_TYPES } from "@/lib/validation/matter";
import type { ContactOption, MatterDetail, MatterParty } from "@/components/matters/types";
import { WorkflowDialog } from "./workflow-dialog";
import type { DocumentListItem } from "@/components/documents/types";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";
import { ContactDetailsHoverCard } from "@/components/contact/ContactDetailsHoverCard";
import { isTerminal } from "@/lib/workflows/state-machine";
import { MatterDocumentUploadDialog } from "@/components/documents/MatterDocumentUploadDialog";
import { MatterWorkflowsSection, WorkflowTimeline, WorkflowStepDetail } from "@/components/matters/workflows";
import {
  MatterPartiesSection,
  MatterDocumentsSection,
  MatterStatusUpdateSection,
} from "@/components/matters/sections";
import { MatterTeamSection } from "@/components/matters/MatterTeamSection";

type ActionType =
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC_CLIENT"
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
    case "REQUEST_DOC_CLIENT":
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
  startedAt: string | null;
  completedAt: string | null;
};

type WorkflowInstance = {
  id: string;
  template: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  steps: WorkflowInstanceStep[];
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
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
  const [partyForm, setPartyForm] = useState(initialPartyForm);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
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

  // State for tabs and editing
  const [activeTab, setActiveTab] = useState<"overview" | "team" | "settings">("overview");
  const [isEditingMatter, setIsEditingMatter] = useState(false);
  const [matterEditForm, setMatterEditForm] = useState({
    title: matter.title,
    type: matter.type,
    jurisdiction: matter.jurisdiction ?? "",
    court: matter.court ?? "",
  });

  const isWorkflowRemovable = useMemo(
    () => currentUserRole === "ADMIN" || currentUserRole === "LAWYER",
    [currentUserRole],
  );

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

  function openEditStep(instanceId: string, step: WorkflowInstanceStep) {
    setStepFormState({ mode: "edit", instanceId, stepId: step.id });
    setStepFormValues({
      title: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      required: step.required,
      actionConfig: JSON.stringify(step.actionData?.config ?? {}, null, 2),
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

  async function submitStepForm() {
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

  async function moveStep(instanceId: string, stepId: string, direction: -1 | 1) {
    const instance = workflows.find((workflow) => workflow.id === instanceId);
    if (!instance) return;
    const ordered = instance.steps.slice().sort((a, b) => a.order - b.order);
    const currentIndex = ordered.findIndex((step) => step.id === stepId);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const sequence = ordered.map((step) => step.id);
    sequence.splice(currentIndex, 1);
    sequence.splice(targetIndex, 0, stepId);
    const insertAfterStepId = targetIndex === 0 ? null : sequence[targetIndex - 1];

    try {
      setActionLoading(`${stepId}:move`);
      const response = await fetch(`/api/workflows/instances/${instanceId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insertAfterStepId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Adım taşınamadı");
      }
      await loadWorkflowInstances();
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Adım taşınamadı.");
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteStep(instanceId: string, stepId: string) {
    if (!window.confirm("Adımı silmek istediğinize emin misiniz?")) return;
    try {
      setActionLoading(`${stepId}:delete`);
      const response = await fetch(`/api/workflows/instances/${instanceId}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Adım silinemedi");
      }
      await loadWorkflowInstances();
      showToast("success", "Adım silindi.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Adım silinemedi.");
    } finally {
      setActionLoading(null);
    }
  }

  async function removeWorkflow(instanceId: string) {
    if (!isWorkflowRemovable) {
      showToast("error", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }
    if (!window.confirm("Workflow'u kaldırmak istediğinize emin misiniz?")) return;
    try {
      setActionLoading(`${instanceId}:deleteInstance`);
      const response = await fetch(`/api/workflows/instances/${instanceId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Workflow kaldırılamadı");
      }
      await loadWorkflowInstances();
      showToast("success", "Workflow kaldırıldı.");
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

  return (
    <div className="space-y-6 w-full" data-testid="matter-detail-client">
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
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            {!isEditingMatter ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-slate-900">{matter.title}</h2>
                    <p className="text-sm text-slate-500">
                      Tür: {matter.type} | Müvekkil:{" "}
                      <ContactDetailsHoverCard
                        contactId={matter.client.id}
                        fallbackName={clientName}
                        email={matter.client.email}
                        currentUserRole={currentUserRole}
                      />
                    </p>
                    <p className="text-sm text-slate-500">
                      Açılış Tarihi: {dateFormatter.format(new Date(matter.openedAt))}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-700">Jurisdiction:</span> {matter.jurisdiction ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Mahkeme:</span> {matter.court ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Dosya Sahibi:</span> {matter.owner?.name ?? matter.owner?.email ?? "—"}
                      </div>
                    </div>
                  </div>
                  {canEditMatter && (
                    <button
                      type="button"
                      onClick={() => setIsEditingMatter(true)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Düzenle
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
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
          {workflows.length > 0 && (
            <WorkflowTimeline
              workflows={workflows}
              selectedStepId={selectedStepId}
              onStepClick={(workflowId, stepId) => {
                setSelectedWorkflowId(workflowId);
                setSelectedStepId(stepId);
              }}
            />
          )}
          
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
                onOpenEditStep={openEditStep}
                onRunStepAction={runStepAction}
                onMoveStep={moveStep}
                onDeleteStep={deleteStep}
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
        onClose={() => setIsUploadDialogOpen(false)}
        matterId={matter.id}
        onUploadComplete={async () => {
          await loadRelatedDocuments();
          showToast("success", "Document uploaded successfully.");
        }}
      />
    </div>
  );
}
