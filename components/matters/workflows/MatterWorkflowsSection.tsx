"use client";

import type React from "react";
import { WorkflowInstanceCard } from "./WorkflowInstanceCard";
import type { WorkflowInstance, WorkflowInstanceStep, ActionType, RoleScope } from "./types";

interface MatterWorkflowsSectionProps {
  workflows: WorkflowInstance[];
  matterId: string;
  actionLoading: string | null;
  hoveredWorkflow: string | null;
  hoveredStep: string | null;
  currentUserRole: string;
  currentStepFormInstanceId: string | null;
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
  onSetWorkflowsModalOpen: (open: boolean) => void;
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

export function MatterWorkflowsSection({
  workflows,
  matterId,
  actionLoading,
  hoveredWorkflow,
  hoveredStep,
  currentUserRole,
  currentStepFormInstanceId,
  stepFormMode,
  editingStep,
  stepFormData,
  onSetHoveredWorkflow,
  onSetHoveredStep,
  onOpenAddStepForm,
  onSetIsStepFormOpen,
  onSetStepFormMode,
  onSetEditingStep,
  onSetStepFormData,
  onSetWorkflowsModalOpen,
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
}: MatterWorkflowsSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Workflows</h2>
        <button
          type="button"
          onClick={() => onSetWorkflowsModalOpen(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Workflow
        </button>
      </div>

      {actionLoading === "workflows:fetch" ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="mb-2 text-sm font-medium text-slate-700">No workflows yet</p>
          <p className="text-xs text-slate-500">
            Click &quot;Add Workflow&quot; to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {workflows.map((workflow) => (
            <WorkflowInstanceCard
              key={workflow.id}
              workflow={workflow}
              matterId={matterId}
              actionLoading={actionLoading}
              hoveredWorkflow={hoveredWorkflow}
              hoveredStep={hoveredStep}
              currentUserRole={currentUserRole}
              isStepFormOpen={currentStepFormInstanceId === workflow.id}
              stepFormMode={stepFormMode}
              editingStep={editingStep}
              stepFormData={stepFormData}
              onSetHoveredWorkflow={onSetHoveredWorkflow}
              onSetHoveredStep={onSetHoveredStep}
              onOpenAddStepForm={onOpenAddStepForm}
              onSetIsStepFormOpen={onSetIsStepFormOpen}
              onSetStepFormMode={onSetStepFormMode}
              onSetEditingStep={onSetEditingStep}
              onSetStepFormData={onSetStepFormData}
              onRunStepAction={onRunStepAction}
              onMoveStep={onMoveStep}
              onDeleteStep={onDeleteStep}
              onRemoveWorkflow={onRemoveWorkflow}
              onAdvanceWorkflow={onAdvanceWorkflow}
              onAddOrEditStep={onAddOrEditStep}
              checklistStates={checklistStates}
              approvalComments={approvalComments}
              documentFiles={documentFiles}
              onSetChecklistStates={onSetChecklistStates}
              onSetApprovalComments={onSetApprovalComments}
              onSetDocumentFiles={onSetDocumentFiles}
            />
          ))}
        </div>
      )}
    </section>
  );
}
