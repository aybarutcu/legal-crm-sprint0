"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MATTER_STATUS } from "@/lib/validation/matter";
import type { ContactOption, MatterDetail, MatterParty } from "@/components/matters/types";
import { WorkflowDialog } from "./workflow-dialog";

type ActionType =
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC_CLIENT"
  | "PAYMENT_CLIENT"
  | "CHECKLIST";

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
      return { requestText: "", acceptedTypes: [] };
    case "PAYMENT_CLIENT":
      return { amount: 0, currency: "USD", provider: "mock" };
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

export function MatterDetailClient({ matter, contacts }: MatterDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(matter.status);
  const [nextHearingAt, setNextHearingAt] = useState(matter.nextHearingAt ?? "");
  const [toast, setToast] = useState<ToastState>(null);
  const [parties, setParties] = useState<MatterParty[]>(matter.parties);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
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

  useEffect(() => {
    void loadWorkflowInstances();
  }, []);

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

  function renderStateBadge(state: ActionState) {
    const classes: Record<ActionState, string> = {
      PENDING: "bg-slate-100 text-slate-600",
      READY: "bg-blue-100 text-blue-700",
      IN_PROGRESS: "bg-amber-100 text-amber-700",
      BLOCKED: "bg-red-100 text-red-700",
      COMPLETED: "bg-emerald-100 text-emerald-700",
      FAILED: "bg-red-100 text-red-700",
      SKIPPED: "bg-slate-200 text-slate-600",
    };
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${classes[state]}`}>
        {state.replace(/_/g, " ")}
      </span>
    );
  }

  function renderStepActions(instance: WorkflowInstance, step: WorkflowInstanceStep, index: number) {
    return (
      <div className="flex flex-wrap gap-2">
        {step.actionState === "READY" && (
          <button
            type="button"
            onClick={() => runStepAction(step.id, "start")}
            className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            disabled={actionLoading === `${step.id}:start`}
          >
            {actionLoading === `${step.id}:start` ? "Başlatılıyor..." : "Başlat"}
          </button>
        )}
        {step.actionState === "READY" && !step.assignedToId && (
          <button
            type="button"
            onClick={() => runStepAction(step.id, "claim")}
            className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            disabled={actionLoading === `${step.id}:claim`}
          >
            {actionLoading === `${step.id}:claim` ? "Atanıyor..." : "Sahiplen"}
          </button>
        )}
        {step.actionState === "IN_PROGRESS" && (
          <>
            <button
              type="button"
              onClick={() => runStepAction(step.id, "complete", { payload: {} })}
              className="rounded border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              disabled={actionLoading === `${step.id}:complete`}
            >
              {actionLoading === `${step.id}:complete` ? "Tamamlanıyor..." : "Tamamla"}
            </button>
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt("Hata nedeni?");
                if (!reason) return;
                void runStepAction(step.id, "fail", { reason });
              }}
              className="rounded border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
              disabled={actionLoading === `${step.id}:fail`}
            >
              {actionLoading === `${step.id}:fail` ? "İşleniyor..." : "Hata"}
            </button>
          </>
        )}
        {step.actionState !== "COMPLETED" && step.actionState !== "SKIPPED" && (
          <button
            type="button"
            onClick={() => runStepAction(step.id, "skip")}
            className="rounded border border-yellow-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-yellow-700 hover:bg-yellow-50 disabled:opacity-60"
            disabled={actionLoading === `${step.id}:skip`}
          >
            {actionLoading === `${step.id}:skip` ? "Atlanıyor..." : "Atla"}
          </button>
        )}
        <button
          type="button"
          onClick={() => openEditStep(instance.id, step)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
        >
          Düzenle
        </button>
        <button
          type="button"
          onClick={() => moveStep(instance.id, step.id, -1)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          disabled={index === 0 || actionLoading === `${step.id}:move`}
        >
          Yukarı
        </button>
        <button
          type="button"
          onClick={() => moveStep(instance.id, step.id, 1)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          disabled={index === instance.steps.length - 1 || actionLoading === `${step.id}:move`}
        >
          Aşağı
        </button>
        <button
          type="button"
          onClick={() => deleteStep(instance.id, step.id)}
          className="rounded border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
          disabled={actionLoading === `${step.id}:delete`}
        >
          Sil
        </button>
      </div>
    );
  }

  function renderStepForm(instanceId: string) {
    if (!stepFormState || stepFormState.instanceId !== instanceId) {
      return null;
    }

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h5 className="text-sm font-semibold text-slate-900">
          {stepFormState.mode === "add" ? "Yeni Adım" : "Adımı Düzenle"}
        </h5>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
            Başlık
            <input
              value={stepFormValues.title}
              onChange={(event) =>
                setStepFormValues((prev) => ({ ...prev, title: event.target.value }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Adım başlığı"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Aksiyon Tipi
            <select
              value={stepFormValues.actionType}
              onChange={(event) => {
                const nextType = event.target.value as ActionType;
                setStepFormValues((prev) => ({
                  ...prev,
                  actionType: nextType,
                  actionConfig: JSON.stringify(defaultConfigFor(nextType), null, 2),
                }));
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {(["CHECKLIST", "APPROVAL_LAWYER", "SIGNATURE_CLIENT", "REQUEST_DOC_CLIENT", "PAYMENT_CLIENT"] as ActionType[]).map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Rol
            <select
              value={stepFormValues.roleScope}
              onChange={(event) =>
                setStepFormValues((prev) => ({ ...prev, roleScope: event.target.value as RoleScope }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"] as RoleScope[]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <input
              type="checkbox"
              checked={stepFormValues.required}
              onChange={(event) =>
                setStepFormValues((prev) => ({ ...prev, required: event.target.checked }))
              }
              className="h-4 w-4 rounded border border-slate-300"
            />
            Zorunlu
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
            Aksiyon Yapılandırması (JSON)
            <textarea
              value={stepFormValues.actionConfig}
              onChange={(event) =>
                setStepFormValues((prev) => ({ ...prev, actionConfig: event.target.value }))
              }
              rows={4}
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={submitStepForm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={closeStepForm}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  const clientName = useMemo(() => {
    return `${matter.client.firstName} ${matter.client.lastName}`.trim();
  }, [matter.client]);

  return (
    <div className="space-y-6" data-testid="matter-detail-client">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">{matter.title}</h2>
        <p className="text-sm text-slate-500">
          Tür: {matter.type} | Müvekkil: {clientName}
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Durum Güncelle</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Durum
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {MATTER_STATUS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Son Duruşma
            <input
              name="nextHearingAt"
              type="datetime-local"
              value={nextHearingAt ? nextHearingAt.slice(0, 16) : ""}
              onChange={(event) => setNextHearingAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={submitUpdate}
          disabled={loading}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Workflows</h3>
          <button
            type="button"
            onClick={() => setWorkflowModalOpen(true)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Add Workflow
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {workflowsLoading ? (
            <p className="text-sm text-slate-500">Loading workflows...</p>
          ) : workflows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No workflows have been instantiated for this matter.
            </p>
          ) : (
            workflows.map((workflow) => (
              <article key={workflow.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {workflow.template.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Created {new Date(workflow.createdAt).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs uppercase tracking-widest text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                      {workflow.status}
                    </span>
                    {workflow.createdBy ? (
                      <span>
                        By {workflow.createdBy.name ?? workflow.createdBy.email ?? "Unknown"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAddStep(workflow.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                  >
                    Yeni Adım Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => runStepAction(workflow.id, "advance")}
                    className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    disabled={actionLoading === `${workflow.id}:advance`}
                  >
                    {actionLoading === `${workflow.id}:advance` ? "Güncelleniyor..." : "Adım Durumlarını Güncelle"}
                  </button>
                </div>
                {renderStepForm(workflow.id)}
                <div className="mt-3 space-y-2">
                  {workflow.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{step.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                              {step.actionType.replace(/_/g, " ")}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                              {step.roleScope}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                              {step.required ? "Required" : "Optional"}
                            </span>
                            {renderStateBadge(step.actionState)}
                          </div>
                          {step.startedAt || step.completedAt ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {step.startedAt ? `Started ${new Date(step.startedAt).toLocaleString("tr-TR")}` : ""}
                              {step.startedAt && step.completedAt ? " • " : ""}
                              {step.completedAt
                                ? `Completed ${new Date(step.completedAt).toLocaleString("tr-TR")}`
                                : ""}
                            </div>
                          ) : null}
                          {step.actionData && Object.keys(step.actionData).length > 0 ? (
                            <pre className="mt-2 max-w-xl overflow-auto rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600">
                              {JSON.stringify(step.actionData, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                            #{step.order + 1}
                          </span>
                          {renderStepActions(workflow, step, index)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Taraflar</h3>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => setPartyModalOpen(true)}
          >
            Taraf Ekle
          </button>
        </div>

        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          {parties.length ? (
            parties.map((party) => (
              <li key={party.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {party.contact.firstName} {party.contact.lastName}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {party.role}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  onClick={() => removeParty(party.id)}
                >
                  Sil
                </button>
              </li>
            ))
          ) : (
            <li className="text-slate-400">Taraf bulunmuyor.</li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Görevler</h3>
        <p className="mt-2 text-sm text-slate-500">Sprint 2 kapsamında placeholder.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Dokümanlar</h3>
        <p className="mt-2 text-sm text-slate-500">Sprint 2 kapsamında placeholder.</p>
      </div>

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

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
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
    </div>
  );
}
