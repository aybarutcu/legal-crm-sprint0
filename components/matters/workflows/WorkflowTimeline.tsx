"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, XCircle, MinusCircle, Clock, AlertCircle } from "lucide-react";

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

export type WorkflowTimelineStep = {
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
  dependsOn: string[];
};

export type WorkflowTimelineInstance = {
  id: string;
  template: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  steps: WorkflowTimelineStep[];
};

type WorkflowTimelineProps = {
  workflows: WorkflowTimelineInstance[];
  selectedStepId: string | null;
  currentUserRole?: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";
  onStepClick: (workflowId: string, stepId: string) => void;
  onAddWorkflow?: () => void;
  onRemoveWorkflow?: (workflowId: string) => void;
  onAddStep?: (workflowId: string) => void;
};

function getStepIcon(state: ActionState) {
  switch (state) {
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5" />;
    case "FAILED":
      return <XCircle className="h-5 w-5" />;
    case "SKIPPED":
      return <MinusCircle className="h-5 w-5" />;
    case "IN_PROGRESS":
      return <Clock className="h-5 w-5" />;
    case "BLOCKED":
      return <AlertCircle className="h-5 w-5" />;
    case "READY":
      return <Circle className="h-5 w-5 fill-current" />;
    case "PENDING":
    default:
      return <Circle className="h-5 w-5" />;
  }
}

// Group steps into chains (rows) where each row is a sequence of dependent steps
function groupStepsByLevel(steps: WorkflowTimelineStep[]): WorkflowTimelineStep[][] {
  const chains: WorkflowTimelineStep[][] = [];
  const visited = new Set<string>();
  
  // Create a map of step ID to step for quick lookup
  const stepMap = new Map<string, WorkflowTimelineStep>();
  steps.forEach(step => stepMap.set(step.id, step));
  
  // Create a map of dependents: which steps depend on this step
  const dependentsMap = new Map<string, string[]>();
  steps.forEach(step => {
    step.dependsOn?.forEach(depId => {
      if (!dependentsMap.has(depId)) {
        dependentsMap.set(depId, []);
      }
      dependentsMap.get(depId)!.push(step.id);
    });
  });
  
  // Find root steps (steps with no dependencies)
  const rootSteps = steps
    .filter(step => !step.dependsOn || step.dependsOn.length === 0)
    .sort((a, b) => a.order - b.order);
  
  // Build chains starting from each root
  function buildChain(startStep: WorkflowTimelineStep): WorkflowTimelineStep[] {
    const chain: WorkflowTimelineStep[] = [];
    let currentStep: WorkflowTimelineStep | null = startStep;
    
    while (currentStep && !visited.has(currentStep.id)) {
      visited.add(currentStep.id);
      chain.push(currentStep);
      
      const currentStepId: string = currentStep.id;
      
      // Find next step: a step that depends ONLY on the current step
      const dependents: string[] = dependentsMap.get(currentStepId) || [];
      const nextStepId: string | undefined = dependents.find((depId: string): boolean => {
        const step = stepMap.get(depId);
        if (!step || visited.has(step.id)) return false;
        // Check if this step depends ONLY on current step (linear chain)
        return step.dependsOn?.length === 1 && step.dependsOn[0] === currentStepId;
      });
      
      currentStep = nextStepId ? stepMap.get(nextStepId) || null : null;
    }
    
    return chain;
  }
  
  // Build chains starting from root steps
  rootSteps.forEach(rootStep => {
    if (!visited.has(rootStep.id)) {
      const chain = buildChain(rootStep);
      if (chain.length > 0) {
        chains.push(chain);
      }
    }
  });
  
  // Handle remaining steps that have multiple dependencies or are in branches
  const remainingSteps = steps
    .filter(step => !visited.has(step.id))
    .sort((a, b) => a.order - b.order);
  
  remainingSteps.forEach(step => {
    if (!visited.has(step.id)) {
      const chain = buildChain(step);
      if (chain.length > 0) {
        chains.push(chain);
      }
    }
  });
  
  return chains;
}

function getStepStyles(state: ActionState, isSelected: boolean) {
  const baseStyles = "transition-all duration-200 cursor-pointer hover:scale-105";
  
  if (isSelected) {
    switch (state) {
      case "COMPLETED":
        return `${baseStyles} bg-emerald-100 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500 ring-offset-2`;
      case "FAILED":
        return `${baseStyles} bg-red-100 border-red-500 text-red-900 ring-2 ring-red-500 ring-offset-2`;
      case "SKIPPED":
        return `${baseStyles} bg-slate-100 border-slate-400 text-slate-700 ring-2 ring-slate-400 ring-offset-2`;
      case "IN_PROGRESS":
        return `${baseStyles} bg-amber-100 border-amber-500 text-amber-900 ring-2 ring-amber-500 ring-offset-2`;
      case "BLOCKED":
        return `${baseStyles} bg-red-100 border-red-500 text-red-900 ring-2 ring-red-500 ring-offset-2`;
      case "READY":
        return `${baseStyles} bg-blue-100 border-blue-500 text-blue-900 ring-2 ring-blue-500 ring-offset-2`;
      case "PENDING":
      default:
        return `${baseStyles} bg-slate-50 border-slate-300 text-slate-700 ring-2 ring-slate-300 ring-offset-2`;
    }
  }

  switch (state) {
    case "COMPLETED":
      return `${baseStyles} bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100`;
    case "FAILED":
      return `${baseStyles} bg-red-50 border-red-300 text-red-800 hover:bg-red-100`;
    case "SKIPPED":
      return `${baseStyles} bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100`;
    case "IN_PROGRESS":
      return `${baseStyles} bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100`;
    case "BLOCKED":
      return `${baseStyles} bg-red-50 border-red-300 text-red-800 hover:bg-red-100`;
    case "READY":
      return `${baseStyles} bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100`;
    case "PENDING":
    default:
      return `${baseStyles} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`;
  }
}

function getActionTypeLabel(type: ActionType): string {
  switch (type) {
    case "APPROVAL_LAWYER":
      return "Lawyer Approval";
    case "SIGNATURE_CLIENT":
      return "Client Signature";
    case "REQUEST_DOC":
      return "Document Request";
    case "PAYMENT_CLIENT":
      return "Payment";
    case "CHECKLIST":
      return "Checklist";
    case "WRITE_TEXT":
      return "Write Text";
    case "POPULATE_QUESTIONNAIRE":
      return "Questionnaire";
    default:
      return type;
  }
}

function getStateLabel(state: ActionState): string {
  switch (state) {
    case "PENDING":
      return "Pending";
    case "READY":
      return "Ready";
    case "IN_PROGRESS":
      return "In Progress";
    case "BLOCKED":
      return "Blocked";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    default:
      return state;
  }
}

export function WorkflowTimeline({ 
  workflows, 
  selectedStepId, 
  currentUserRole,
  onStepClick,
  onAddWorkflow,
  onRemoveWorkflow,
  onAddStep,
}: WorkflowTimelineProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedStepRef = useRef<any>(null);

  // Auto-scroll to the selected step within its local container
  useEffect(() => {
    if (selectedStepId && selectedStepRef.current) {
      selectedStepRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedStepId]);

  const canManageWorkflows = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";

  if (workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="mb-4 text-sm text-slate-500">No workflows yet</p>
        {onAddWorkflow && canManageWorkflows && (
          <button
            type="button"
            onClick={onAddWorkflow}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add Workflow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card max-w-full" data-testid="workflow-timeline">
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Workflow Progress</h3>
          <p className="text-sm text-slate-500">Click on any step to view details</p>
        </div>
        {onAddWorkflow && canManageWorkflows && (
          <button
            type="button"
            onClick={onAddWorkflow}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add Workflow
          </button>
        )}
      </div>
      
      <div className="px-6 py-6">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="mb-8 last:mb-0">
              {/* Workflow Header */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{workflow.template.name}</h4>
                  <p className="text-xs text-slate-500">
                    Status: <span className="font-medium">{workflow.status}</span>
                    {workflow.createdBy && (
                      <> · Created by {workflow.createdBy.name || workflow.createdBy.email}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 text-xs text-slate-500" data-testid="workflow-progress">
                    {workflow.steps.filter((step) => step.actionState === "COMPLETED").length} / {workflow.steps.length} completed
                  </div>
                  {canManageWorkflows && (
                    <>
                      {onAddStep && workflow.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => onAddStep(workflow.id)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          title="Add Step"
                        >
                          + Add Step
                        </button>
                      )}
                      {/* Edit Workflow Button - before Remove */}
                      <a
                        href={`/workflows/instances/${workflow.id}/edit`}
                        className="rounded-lg border-2 border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5"
                        title="Edit entire workflow"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit Workflow
                      </a>
                      {onRemoveWorkflow && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to remove this workflow?")) {
                              onRemoveWorkflow(workflow.id);
                            }
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          title="Remove Workflow"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Timeline Steps - Grouped by Dependency Level */}
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="space-y-4 p-4">
                  {groupStepsByLevel(workflow.steps).map((levelSteps, levelIndex) => (
                    <div key={levelIndex} className="flex w-max items-stretch gap-0">
                      {levelSteps.map((step, stepIndex) => {
                        const isSelected = step.id === selectedStepId;
                        
                        return (
                          <div key={step.id} className="flex shrink-0 items-stretch gap-0">
                            {/* Step Card */}
                            <div
                              ref={isSelected ? selectedStepRef : null}
                              onClick={() => onStepClick(workflow.id, step.id)}
                              data-testid={`timeline-step-${step.id}`}
                              data-state={step.actionState}
                              className={`flex w-64 shrink-0 flex-col gap-3 rounded-xl border-2 p-4 transition-transform duration-200 ${getStepStyles(step.actionState, isSelected)}`}
                            >
                        {/* Header with Icon and Title */}
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {getStepIcon(step.actionState)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-base font-semibold">
                              {step.title}
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Type:</span>
                            <span className="font-medium">{getActionTypeLabel(step.actionType)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Status:</span>
                            <span className="font-medium">{getStateLabel(step.actionState)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Role:</span>
                            <span className="font-medium">{step.roleScope}</span>
                          </div>
                          {step.required && (
                            <div className="mt-1 rounded bg-black/10 px-2 py-0.5 text-center text-xs font-medium">
                              Required
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow Connector - only between steps in the same chain */}
                      {stepIndex < levelSteps.length - 1 && (
                        <div className="flex items-center px-3 text-slate-400">
                          <svg
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
