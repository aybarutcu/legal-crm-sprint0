"use client";

import React from "react";
import { ActionConfigDisplay } from "@/components/workflows/ActionConfigDisplay";
import {
  ChecklistExecution,
  ApprovalExecution,
  SignatureExecution,
  DocumentRequestExecution,
  PaymentExecution,
  WriteTextExecution,
  PopulateQuestionnaireExecution,
  StepExecutionLog,
} from "@/components/workflows/execution";
import {
  QuestionnaireResponseViewer,
  WriteTextViewer,
  DocumentViewer,
  ChecklistViewer,
} from "@/components/workflows/output";
import { renderStateBadge } from "./utils";
import type { WorkflowInstance, WorkflowInstanceStep } from "./types";

interface WorkflowStepCardProps {
  step: WorkflowInstanceStep;
  workflow: WorkflowInstance;
  matterId: string;
  index: number;
  actionLoading: string | null;
  hoveredStep: string | null;
  currentUserRole: string;
  onSetHoveredStep: (stepId: string | null) => void;
  onOpenEditStep: (instanceId: string, step: WorkflowInstanceStep) => void;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  // Execution UI state
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onSetChecklistStates: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
  onSetApprovalComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetDocumentFiles: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}

export function WorkflowStepCard({
  step,
  workflow,
  matterId,
  index,
  actionLoading,
  hoveredStep,
  currentUserRole,
  onSetHoveredStep,
  onOpenEditStep,
  onRunStepAction,
  onMoveStep,
  onDeleteStep,
  checklistStates,
  approvalComments,
  documentFiles,
  onSetChecklistStates,
  onSetApprovalComments,
  onSetDocumentFiles,
}: WorkflowStepCardProps) {
  const isCompleted = step.actionState === "COMPLETED";
  const isSkipped = step.actionState === "SKIPPED";
  const isInProgress = step.actionState === "IN_PROGRESS";

  // Render step execution UI
  const renderStepExecutionUI = () => {
    if (step.actionState !== "IN_PROGRESS") {
      return null;
    }

    const checkedItems = checklistStates[step.id] ?? new Set<string>();
    const comment = approvalComments[step.id] ?? "";
    const selectedFile = documentFiles[step.id] ?? null;

    const handleToggleChecklistItem = (item: string) => {
      onSetChecklistStates((prev) => {
        const current = prev[step.id] ?? new Set<string>();
        const next = new Set(current);
        if (next.has(item)) {
          next.delete(item);
        } else {
          next.add(item);
        }
        return { ...prev, [step.id]: next };
      });
    };

    const handleCommentChange = (newComment: string) => {
      onSetApprovalComments((prev) => ({ ...prev, [step.id]: newComment }));
    };

    const handleFileChange = (file: File | null) => {
      onSetDocumentFiles((prev) => ({ ...prev, [step.id]: file }));
    };

    const isLoading = actionLoading === `${step.id}:complete`;

    switch (step.actionType) {
      case "CHECKLIST":
        return (
          <ChecklistExecution
            step={step}
            checkedItems={checkedItems}
            onToggleItem={handleToggleChecklistItem}
            onComplete={(completedItems) => {
              void onRunStepAction(step.id, "complete", { payload: { completedItems } });
            }}
            isLoading={isLoading}
          />
        );
      case "APPROVAL_LAWYER":
        return (
          <ApprovalExecution
            step={step}
            comment={comment}
            onCommentChange={handleCommentChange}
            onApprove={(approvalComment) => {
              void onRunStepAction(step.id, "complete", {
                payload: { approved: true, comment: approvalComment },
              });
            }}
            onReject={(rejectionComment) => {
              void onRunStepAction(step.id, "complete", {
                payload: { approved: false, comment: rejectionComment },
              });
            }}
            isLoading={isLoading}
          />
        );
      case "SIGNATURE_CLIENT":
        return (
          <SignatureExecution
            step={step}
            onComplete={() => {
              void onRunStepAction(step.id, "complete", { payload: {} });
            }}
            isLoading={isLoading}
          />
        );
      case "REQUEST_DOC_CLIENT":
        return (
          <DocumentRequestExecution
            step={step}
            selectedFile={selectedFile}
            onFileChange={handleFileChange}
            onComplete={(documentId) => {
              void onRunStepAction(step.id, "complete", { payload: { documentId } });
            }}
            isLoading={isLoading}
          />
        );
      case "PAYMENT_CLIENT":
        return (
          <PaymentExecution
            step={step}
            onComplete={() => {
              void onRunStepAction(step.id, "complete", { payload: {} });
            }}
            isLoading={isLoading}
          />
        );
      case "WRITE_TEXT":
        return (
          <WriteTextExecution
            step={step}
            onComplete={(payload) => {
              void onRunStepAction(step.id, "complete", { payload });
            }}
            isLoading={isLoading}
          />
        );
      case "POPULATE_QUESTIONNAIRE":
        return (
          <PopulateQuestionnaireExecution
            step={step}
            matterId={matterId}
            onComplete={(payload) => {
              void onRunStepAction(step.id, "complete", { payload });
            }}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  // Render step output for completed steps
  const renderStepOutputUI = () => {
    if (step.actionState !== "COMPLETED" || !step.actionData) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionData = step.actionData as any;

    switch (step.actionType) {
      case "POPULATE_QUESTIONNAIRE":
        if (actionData.responseId) {
          return <QuestionnaireResponseViewer responseId={actionData.responseId} />;
        }
        return null;

      case "WRITE_TEXT":
        if (actionData.content) {
          return (
            <WriteTextViewer
              content={actionData.content}
              metadata={{
                writtenAt: step.completedAt ?? undefined,
              }}
            />
          );
        }
        return null;

      case "REQUEST_DOC_CLIENT":
        if (actionData.documentId) {
          return <DocumentViewer documentIds={[actionData.documentId]} />;
        }
        return null;

      case "CHECKLIST":
        if (actionData.completedItems && Array.isArray(actionData.completedItems)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const config = (step.actionData as any)?.config;
          const items = config?.items || [];
          const checklistItems = items.map((item: string) => ({
            id: item,
            text: item,
            checked: actionData.completedItems.includes(item),
          }));
          return (
            <ChecklistViewer
              items={checklistItems}
              metadata={{
                completedAt: step.completedAt ?? undefined,
              }}
            />
          );
        }
        return null;

      default:
        return null;
    }
  };

  // Render step actions
  const renderStepActions = () => {
    return (
      <div className="flex flex-wrap gap-2">
        {step.actionState === "READY" && (
          <button
            type="button"
            onClick={() => onRunStepAction(step.id, "start")}
            className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            disabled={actionLoading === `${step.id}:start`}
          >
            {actionLoading === `${step.id}:start` ? "Başlatılıyor..." : "Başlat"}
          </button>
        )}
        {step.actionState === "READY" && !step.assignedToId && (
          <button
            type="button"
            onClick={() => onRunStepAction(step.id, "claim")}
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
              onClick={() => {
                const reason = window.prompt("Hata nedeni?");
                if (!reason) return;
                void onRunStepAction(step.id, "fail", { reason });
              }}
              className="rounded border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
              disabled={actionLoading === `${step.id}:fail`}
            >
              {actionLoading === `${step.id}:fail` ? "İşleniyor..." : "Hata"}
            </button>
          </>
        )}
        {/* Skip button: Only show for admins, non-required steps, and incomplete steps */}
        {currentUserRole === "ADMIN" &&
          !step.required &&
          step.actionState !== "COMPLETED" &&
          step.actionState !== "SKIPPED" && (
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt(
                  "Bu adımı atlamak istediğinizden emin misiniz? Sebep (opsiyonel):",
                );
                // Allow empty reason (user can click OK without typing)
                if (reason !== null) {
                  void onRunStepAction(step.id, "skip", { reason: reason || undefined });
                }
              }}
              className="rounded border border-yellow-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-yellow-700 hover:bg-yellow-50 disabled:opacity-60"
              disabled={actionLoading === `${step.id}:skip`}
            >
              {actionLoading === `${step.id}:skip` ? "Atlanıyor..." : "Atla"}
            </button>
          )}
        <button
          type="button"
          onClick={() => onOpenEditStep(workflow.id, step)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
        >
          Düzenle
        </button>
        <button
          type="button"
          onClick={() => onMoveStep(workflow.id, step.id, -1)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          disabled={index === 0 || actionLoading === `${step.id}:move`}
        >
          Yukarı
        </button>
        <button
          type="button"
          onClick={() => onMoveStep(workflow.id, step.id, 1)}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          disabled={index === workflow.steps.length - 1 || actionLoading === `${step.id}:move`}
        >
          Aşağı
        </button>
        <button
          type="button"
          onClick={() => onDeleteStep(workflow.id, step.id)}
          className="rounded border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
          disabled={actionLoading === `${step.id}:delete`}
        >
          Sil
        </button>
      </div>
    );
  };

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 text-sm max-w-full overflow-hidden ${
        isCompleted
          ? "border-emerald-300 bg-emerald-50/50"
          : isSkipped
          ? "border-yellow-300 bg-yellow-50/50"
          : isInProgress
          ? "border-blue-300 bg-blue-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-slate-900">{step.title}</div>
            {isCompleted && (
              <span className="text-emerald-600" title="Tamamlandı">
                ✓
              </span>
            )}
            {isSkipped && (
              <span className="text-yellow-600" title="Atlandı">
                ⊘
              </span>
            )}
          </div>
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
          {/* Task configuration details */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const actionData = step.actionData as any;
            if (actionData?.config) {
              return (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                  <ActionConfigDisplay
                    actionType={step.actionType}
                    config={actionData.config}
                    variant="compact"
                  />
                </div>
              );
            }
            return null;
          })()}

          {/* Execution history hover icon */}
          {(step.startedAt || step.completedAt) && (
            <div className="mt-2 relative inline-block group">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                onMouseEnter={() => onSetHoveredStep(step.id)}
                onMouseLeave={() => onSetHoveredStep(null)}
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Geçmiş
              </button>

              {/* Hover popup */}
              {hoveredStep === step.id && (
                <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 font-semibold text-slate-900 text-sm border-b border-slate-200 pb-2">
                    📋 Görev Geçmişi
                  </div>
                  <StepExecutionLog step={step} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            #{step.order + 1}
          </span>
          {renderStepActions()}
        </div>
      </div>
      {/* Action-specific execution UI */}
      <div className="max-w-full overflow-hidden">
        {renderStepExecutionUI()}
      </div>
      {/* Action output for completed steps */}
      <div className="max-w-full overflow-hidden">
        {renderStepOutputUI()}
      </div>
    </div>
  );
}
