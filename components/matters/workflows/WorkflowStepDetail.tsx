"use client";

import { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { WorkflowStepCard } from "./WorkflowStepCard";
import type { WorkflowInstance, WorkflowInstanceStep } from "./types";

interface WorkflowStepDetailProps {
  step: WorkflowInstanceStep | null;
  workflow: WorkflowInstance | null;
  matterId: string;
  actionLoading: string | null;
  hoveredStep: string | null;
  currentUserRole: string;
  onClose: () => void;
  onSetHoveredStep: (stepId: string | null) => void;
  onOpenEditStep: (instanceId: string, step: WorkflowInstanceStep) => void;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  // Execution UI state
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onSetChecklistStates: Dispatch<SetStateAction<Record<string, Set<string>>>>;
  onSetApprovalComments: Dispatch<SetStateAction<Record<string, string>>>;
  onSetDocumentFiles: Dispatch<SetStateAction<Record<string, File | null>>>;
}

export function WorkflowStepDetail({
  step,
  workflow,
  matterId,
  actionLoading,
  hoveredStep,
  currentUserRole,
  onClose,
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
}: WorkflowStepDetailProps) {
  if (!step || !workflow) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center shadow-card">
        <p className="text-slate-500">Select a step from the timeline above to view details</p>
      </div>
    );
  }

  const stepIndex = workflow.steps.findIndex(s => s.id === step.id);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      {/* Header with close button */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Step Details</h3>
          <p className="text-sm text-slate-500">{workflow.template.name} - Step {step.order + 1}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close details"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Step Card Content */}
      <div className="p-6 overflow-x-auto">
        <WorkflowStepCard
          step={step}
          workflow={workflow}
          matterId={matterId}
          index={stepIndex}
          actionLoading={actionLoading}
          hoveredStep={hoveredStep}
          currentUserRole={currentUserRole}
          onSetHoveredStep={onSetHoveredStep}
          onOpenEditStep={onOpenEditStep}
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
      </div>
    </div>
  );
}
