"use client";

import type React from "react";
import { WorkflowStepCard } from "./WorkflowStepCard";
import { WorkflowContextPanel } from "@/components/matters/detail/WorkflowContextPanel";
import { WorkflowExecutionLog } from "@/components/workflows/execution";
import { ActionConfigForm } from "@/components/workflows/config-forms";
import type { WorkflowInstance, WorkflowInstanceStep, ActionType, RoleScope } from "./types";

interface WorkflowInstanceCardProps {
  workflow: WorkflowInstance;
  matterId: string;
  actionLoading: string | null;
  hoveredWorkflow: string | null;
  hoveredStep: string | null;
  currentUserRole: string;
  isStepFormOpen: boolean;
  stepFormMode: "add" | "edit";
  editingStep: WorkflowInstanceStep | null;
  stepFormData: {
    title: string;
    actionType: ActionType;
    roleScope: RoleScope;
    required: boolean;
    config: unknown;
  };
  onSetHoveredWorkflow: (id: string | null) => void;
  onSetHoveredStep: (stepId: string | null) => void;
  onOpenAddStepForm: (instanceId: string) => void;
  onSetIsStepFormOpen: (open: boolean) => void;
  onSetStepFormMode: (mode: "add" | "edit") => void;
  onSetEditingStep: (step: WorkflowInstanceStep | null) => void;
  onSetStepFormData: React.Dispatch<
    React.SetStateAction<{
      title: string;
      actionType: ActionType;
      roleScope: RoleScope;
      required: boolean;
      config: unknown;
    }>
  >;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  onRemoveWorkflow: (instanceId: string) => Promise<void>;
  onAdvanceWorkflow: (instanceId: string) => Promise<void>;
  onAddOrEditStep: (instanceId: string) => Promise<void>;
  // Execution UI state
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onSetChecklistStates: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
  onSetApprovalComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetDocumentFiles: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}

export function WorkflowInstanceCard({
  workflow,
  matterId,
  actionLoading,
  hoveredWorkflow,
  hoveredStep,
  currentUserRole,
  isStepFormOpen,
  stepFormMode,
  editingStep: _editingStep,
  stepFormData,
  onSetHoveredWorkflow,
  onSetHoveredStep,
  onOpenAddStepForm,
  onSetIsStepFormOpen,
  onSetStepFormMode,
  onSetEditingStep,
  onSetStepFormData,
  onRunStepAction,
  onMoveStep,
  onDeleteStep,
  onRemoveWorkflow,
  onAdvanceWorkflow,
  onAddOrEditStep,
  checklistStates,
  approvalComments,
  documentFiles,
  onSetChecklistStates,
  onSetApprovalComments,
  onSetDocumentFiles,
}: WorkflowInstanceCardProps) {
  const openEditStep = (instanceId: string, step: WorkflowInstanceStep) => {
    onSetStepFormMode("edit");
    onSetEditingStep(step);
    onSetStepFormData({
      title: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      required: step.required,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: (step.actionData as any)?.config ?? {},
    });
    onSetIsStepFormOpen(true);
  };

  const renderStepForm = () => {
    if (!isStepFormOpen) return null;

    return (
      <div className="my-4 rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">
          {stepFormMode === "add" ? "Yeni Adım Ekle" : "Adımı Düzenle"}
        </h4>
        <div className="space-y-3">
          <div>
            <label htmlFor="step-title" className="block text-xs font-medium text-slate-700">
              Başlık
            </label>
            <input
              id="step-title"
              type="text"
              value={stepFormData.title}
              onChange={(e) =>
                onSetStepFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="step-action-type" className="block text-xs font-medium text-slate-700">
              Aksiyon Tipi
            </label>
            <select
              id="step-action-type"
              value={stepFormData.actionType}
              onChange={(e) =>
                onSetStepFormData((prev) => ({
                  ...prev,
                  actionType: e.target.value as ActionType,
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="CHECKLIST">Checklist</option>
              <option value="APPROVAL_LAWYER">Lawyer Approval</option>
              <option value="SIGNATURE_CLIENT">Client Signature</option>
              <option value="REQUEST_DOC_CLIENT">Request Document from Client</option>
              <option value="PAYMENT_CLIENT">Client Payment</option>
              <option value="WRITE_TEXT">Write Text</option>
            </select>
          </div>
          <div>
            <label htmlFor="step-role-scope" className="block text-xs font-medium text-slate-700">
              Rol
            </label>
            <select
              id="step-role-scope"
              value={stepFormData.roleScope}
              onChange={(e) =>
                onSetStepFormData((prev) => ({
                  ...prev,
                  roleScope: e.target.value as RoleScope,
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="LAWYER">Lawyer</option>
              <option value="PARALEGAL">Paralegal</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="step-required"
              type="checkbox"
              checked={stepFormData.required}
              onChange={(e) =>
                onSetStepFormData((prev) => ({ ...prev, required: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="step-required" className="text-xs font-medium text-slate-700">
              Zorunlu
            </label>
          </div>

          {/* Action-specific configuration form */}
          <div className="mt-2">
            <h6 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Aksiyon Yapılandırması
            </h6>
            <ActionConfigForm
              actionType={stepFormData.actionType}
              config={stepFormData.config as Record<string, unknown>}
              onChange={(newConfig) => {
                onSetStepFormData((prev) => ({
                  ...prev,
                  config: newConfig,
                }));
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAddOrEditStep(workflow.id)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {stepFormMode === "add" ? "Ekle" : "Güncelle"}
            </button>
            <button
              type="button"
              onClick={() => {
                onSetIsStepFormOpen(false);
                onSetEditingStep(null);
              }}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border-2 border-slate-200 bg-slate-50/50 p-4">
      {/* Workflow header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">{workflow.template.name}</h3>
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                workflow.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : workflow.status === "COMPLETED"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {workflow.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Created {new Date(workflow.createdAt).toLocaleDateString()} by{" "}
            {workflow.createdBy?.name ?? "Unknown"}
          </div>

          {/* Workflow-level execution log hover */}
          {workflow.steps.length > 0 && (
            <div className="mt-2 relative inline-block">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                onMouseEnter={() => onSetHoveredWorkflow(workflow.id)}
                onMouseLeave={() => onSetHoveredWorkflow(null)}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Tüm Geçmiş
              </button>

              {/* Hover popup */}
              {hoveredWorkflow === workflow.id && (
                <div className="absolute left-0 top-full mt-1 z-50 w-96 rounded-lg border border-slate-200 bg-white p-3 shadow-lg max-h-[500px] overflow-y-auto">
                  <div className="mb-2 font-semibold text-slate-900 text-sm border-b border-slate-200 pb-2">
                    📋 Workflow Geçmişi
                  </div>
                  <WorkflowExecutionLog workflow={workflow} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Workflow actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenAddStepForm(workflow.id)}
            className="rounded border border-blue-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-700 hover:bg-blue-50"
          >
            + Adım Ekle
          </button>
          {workflow.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => onAdvanceWorkflow(workflow.id)}
              className="rounded border border-emerald-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              disabled={actionLoading === `${workflow.id}:advance`}
            >
              {actionLoading === `${workflow.id}:advance` ? "İlerletiliyor..." : "İlerlet"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemoveWorkflow(workflow.id)}
            className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
            disabled={actionLoading === `${workflow.id}:remove`}
          >
            {actionLoading === `${workflow.id}:remove` ? "Siliniyor..." : "Kaldır"}
          </button>
        </div>
      </div>

      {/* Context panel */}
      <div className="mb-4">
        <WorkflowContextPanel instanceId={workflow.id} />
      </div>

      {/* Step form */}
      {renderStepForm()}

      {/* Workflow steps */}
      <div className="space-y-3">
        {workflow.steps.length === 0 ? (
          <div className="rounded border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Bu workflow&apos;da henüz adım yok. Yukarıdan &quot;+ Adım Ekle&quot; butonuna
            tıklayarak adım ekleyin.
          </div>
        ) : (
          workflow.steps.map((step, idx) => (
            <WorkflowStepCard
              key={step.id}
              step={step}
              workflow={workflow}
              matterId={matterId}
              index={idx}
              actionLoading={actionLoading}
              hoveredStep={hoveredStep}
              currentUserRole={currentUserRole}
              onSetHoveredStep={onSetHoveredStep}
              onOpenEditStep={openEditStep}
              onRunStepAction={onRunStepAction}
              onMoveStep={onMoveStep}
              onDeleteStep={onDeleteStep}
              checklistStates={checklistStates}
              approvalComments={approvalComments}
              documentFiles={documentFiles}
              onSetChecklistStates={onSetChecklistStates}
              onSetApprovalComments={onSetApprovalComments}
              onSetDocumentFiles={onSetDocumentFiles}
            />
          ))
        )}
      </div>
    </div>
  );
}
