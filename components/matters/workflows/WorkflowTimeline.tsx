"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, XCircle, MinusCircle, Clock, AlertCircle } from "lucide-react";

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
  onStepClick: (workflowId: string, stepId: string) => void;
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
    case "REQUEST_DOC_CLIENT":
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

export function WorkflowTimeline({ workflows, selectedStepId, onStepClick }: WorkflowTimelineProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedStepRef = useRef<any>(null);

  // Auto-scroll to the selected step within its local container
  useEffect(() => {
    if (selectedStepId && selectedStepRef.current) {
      selectedStepRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedStepId]);

  if (workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-sm text-slate-500">No workflows yet</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card max-w-full">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Workflow Progress</h3>
        <p className="text-sm text-slate-500">Click on any step to view details</p>
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
                <div className="flex-shrink-0 text-xs text-slate-500">
                  {workflow.steps.filter((step) => step.actionState === "COMPLETED").length} / {workflow.steps.length} completed
                </div>
              </div>

              {/* Timeline Steps */}
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="flex w-max items-start gap-3 p-4">
                  {workflow.steps.map((step, index) => {
                  const isSelected = step.id === selectedStepId;
                  
                  return (
                    <div key={step.id} className="flex shrink-0 items-start gap-3">
                      {/* Step Card */}
                      <div
                        ref={isSelected ? selectedStepRef : null}
                        onClick={() => onStepClick(workflow.id, step.id)}
                        className={`flex w-64 shrink-0 flex-col gap-3 rounded-xl border-2 p-4 transition-transform duration-200 ${getStepStyles(step.actionState, isSelected)}`}
                      >
                        {/* Header with Icon and Number */}
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {getStepIcon(step.actionState)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                              Step {step.order + 1}
                            </div>
                            <div className="truncate text-sm font-semibold">
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

                      {/* Arrow Connector (not for last item) */}
                      {index < workflow.steps.length - 1 && (
                        <div className="flex items-center pt-12 text-slate-300">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
