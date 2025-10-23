"use client";

import { Dispatch, SetStateAction, useState, useEffect } from "react";
import Link from "next/link";
import { 
  X, 
  CheckCircle2, 
  Clock, 
  Circle, 
  AlertCircle, 
  MinusCircle, 
  ChevronDown,
  ChevronRight,
  Play,
  UserCheck,
  XCircle,
  ArrowRight
} from "lucide-react";
import { ActionConfigDisplay } from "@/components/workflows/ActionConfigDisplay";
import {
  ChecklistExecution,
  ApprovalExecution,
  SignatureExecution,
  DocumentRequestExecution,
  PaymentExecution,
  WriteTextExecution,
  PopulateQuestionnaireExecution,
  TaskExecution,
} from "@/components/workflows/execution";
import {
  QuestionnaireResponseViewer,
  WriteTextViewer,
  DocumentViewer,
  ChecklistViewer,
  RequestDocViewer,
  TaskViewer,
} from "@/components/workflows/output";
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
  onUpdateStepMetadata?: (instanceId: string, stepId: string, data: { dueDate?: string | null; assignedToId?: string | null; priority?: string | null }) => Promise<void>;
  onAddDocumentForStep?: (stepId: string, documentName: string) => void;
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
  hoveredStep: _hoveredStep,
  currentUserRole,
  onClose,
  onSetHoveredStep: _onSetHoveredStep,
  onOpenEditStep,
  onRunStepAction,
  onMoveStep,
  onDeleteStep,
  onUpdateStepMetadata,
  onAddDocumentForStep,
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
        <div className="flex flex-col items-center gap-3">
          <Circle className="h-16 w-16 text-slate-300" />
          <p className="text-slate-500 font-medium">Select a step from the timeline above</p>
          <p className="text-sm text-slate-400">Click any step to view details and take action</p>
        </div>
      </div>
    );
  }

  const stepIndex = workflow.steps.findIndex(s => s.id === step.id);
  const isCompleted = step.actionState === "COMPLETED";
  const isSkipped = step.actionState === "SKIPPED";
  const isFailed = step.actionState === "FAILED";
  const isInProgress = step.actionState === "IN_PROGRESS";
  const isReady = step.actionState === "READY";
  const isPending = step.actionState === "PENDING";
  const isBlocked = step.actionState === "BLOCKED";

  // Find next step
  const nextStep = workflow.steps.find(s => s.order === step.order + 1);

  // Calculate duration for completed steps
  const calculateDuration = () => {
    if (!step.startedAt || !step.completedAt) return null;
    const start = new Date(step.startedAt);
    const end = new Date(step.completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "< 1 minute";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  };

  // Format relative time
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden" data-testid="workflow-step-detail">
      {/* Header with close button */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900" data-testid="step-title">{step.title}</h3>
          <p className="text-sm text-slate-500" data-testid="action-type">{workflow.template.name} · Step {step.order + 1} of {workflow.steps.length}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit Workflow Button - Only for ADMIN/LAWYER */}
          {(currentUserRole === "ADMIN" || currentUserRole === "LAWYER") && (
            <Link
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
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Step Body - State-specific rendering */}
      <div className="p-6">
        {/* Hero Status Badge */}
        <HeroStatusBadge 
          step={step}
          formatRelativeTime={formatRelativeTime}
        />

        {/* READY/PENDING STATE */}
        {(isReady || isPending || isBlocked) && (
          <ReadyStateView
            step={step}
            workflow={workflow}
            stepIndex={stepIndex}
            actionLoading={actionLoading}
            currentUserRole={currentUserRole}
            matterId={matterId}
            onRunStepAction={onRunStepAction}
            onOpenEditStep={onOpenEditStep}
            onMoveStep={onMoveStep}
            onDeleteStep={onDeleteStep}
            onUpdateStepMetadata={onUpdateStepMetadata}
          />
        )}

        {/* IN_PROGRESS STATE */}
        {isInProgress && (
          <InProgressStateView
            step={step}
            matterId={matterId}
            actionLoading={actionLoading}
            formatRelativeTime={formatRelativeTime}
            checklistStates={checklistStates}
            approvalComments={approvalComments}
            documentFiles={documentFiles}
            onSetChecklistStates={onSetChecklistStates}
            onSetApprovalComments={onSetApprovalComments}
            onSetDocumentFiles={onSetDocumentFiles}
            onRunStepAction={onRunStepAction}
            onAddDocumentForStep={onAddDocumentForStep}
          />
        )}

        {/* COMPLETED STATE */}
        {isCompleted && (
          <CompletedStateView
            step={step}
            workflow={workflow}
            nextStep={nextStep}
            matterId={matterId}
            calculateDuration={calculateDuration}
          />
        )}

        {/* SKIPPED STATE */}
        {isSkipped && (
          <SkippedStateView
            step={step}
            actionLoading={actionLoading}
            onRunStepAction={onRunStepAction}
          />
        )}

        {/* FAILED STATE */}
        {isFailed && (
          <FailedStateView
            step={step}
            actionLoading={actionLoading}
            onRunStepAction={onRunStepAction}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface HeroStatusBadgeProps {
  step: WorkflowInstanceStep;
  formatRelativeTime: (dateString: string | null) => string | null;
}

function HeroStatusBadge({ step, formatRelativeTime }: HeroStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (step.actionState) {
      case "COMPLETED":
        return {
          icon: <CheckCircle2 className="h-6 w-6" />,
          label: "COMPLETED",
          bgColor: "bg-emerald-100",
          borderColor: "border-emerald-400",
          textColor: "text-emerald-900",
          iconColor: "text-emerald-600",
          subtitle: step.completedAt ? new Date(step.completedAt).toLocaleString("tr-TR") : null,
        };
      case "IN_PROGRESS":
        return {
          icon: <Clock className="h-6 w-6 animate-pulse" />,
          label: "IN PROGRESS",
          bgColor: "bg-blue-100",
          borderColor: "border-blue-400",
          textColor: "text-blue-900",
          iconColor: "text-blue-600",
          subtitle: step.startedAt ? `Started ${formatRelativeTime(step.startedAt)}` : null,
        };
      case "READY":
        return {
          icon: <Circle className="h-6 w-6 fill-current" />,
          label: "READY TO START",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-300",
          textColor: "text-blue-800",
          iconColor: "text-blue-500",
          subtitle: "Click the button below to begin",
        };
      case "PENDING":
        return {
          icon: <Circle className="h-6 w-6" />,
          label: "PENDING",
          bgColor: "bg-slate-100",
          borderColor: "border-slate-300",
          textColor: "text-slate-700",
          iconColor: "text-slate-500",
          subtitle: "Waiting for previous steps",
        };
      case "BLOCKED":
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          label: "BLOCKED",
          bgColor: "bg-red-100",
          borderColor: "border-red-400",
          textColor: "text-red-900",
          iconColor: "text-red-600",
          subtitle: "Cannot proceed",
        };
      case "SKIPPED":
        return {
          icon: <MinusCircle className="h-6 w-6" />,
          label: "SKIPPED",
          bgColor: "bg-yellow-100",
          borderColor: "border-yellow-400",
          textColor: "text-yellow-900",
          iconColor: "text-yellow-600",
          subtitle: step.completedAt ? new Date(step.completedAt).toLocaleString("tr-TR") : null,
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-6 w-6" />,
          label: "FAILED",
          bgColor: "bg-red-100",
          borderColor: "border-red-400",
          textColor: "text-red-900",
          iconColor: "text-red-600",
          subtitle: step.completedAt ? new Date(step.completedAt).toLocaleString("tr-TR") : null,
        };
      default:
        return {
          icon: <Circle className="h-6 w-6" />,
          label: step.actionState,
          bgColor: "bg-slate-100",
          borderColor: "border-slate-300",
          textColor: "text-slate-700",
          iconColor: "text-slate-500",
          subtitle: null,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex flex-col items-center gap-3 py-6 border-b border-slate-100">
      <div className={`flex items-center gap-3 rounded-full px-6 py-3 border-2 ${config.bgColor} ${config.borderColor}`}>
        <div className={config.iconColor}>{config.icon}</div>
        <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
        {config.subtitle && (
          <>
            <span className={`text-xs ${config.textColor} opacity-70`}>•</span>
            <span className={`text-xs ${config.textColor} opacity-70`}>{config.subtitle}</span>
          </>
        )}
      </div>
      
      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {step.actionType.replace(/_/g, " ")}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {step.roleScope}
        </span>
        {step.required && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
            Required
          </span>
        )}
      </div>
    </div>
  );
}

interface ReadyStateViewProps {
  step: WorkflowInstanceStep;
  workflow: WorkflowInstance;
  stepIndex: number;
  actionLoading: string | null;
  currentUserRole: string;
  matterId: string;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onOpenEditStep: (instanceId: string, step: WorkflowInstanceStep) => void;
  onMoveStep: (instanceId: string, stepId: string, direction: -1 | 1) => Promise<void>;
  onDeleteStep: (instanceId: string, stepId: string) => Promise<void>;
  onUpdateStepMetadata?: (instanceId: string, stepId: string, data: { dueDate?: string | null; assignedToId?: string | null; priority?: string | null }) => Promise<void>;
}

function ReadyStateView({
  step,
  workflow,
  actionLoading,
  currentUserRole,
  matterId: _matterId,
  onRunStepAction,
  onUpdateStepMetadata,
}: ReadyStateViewProps) {
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const isReady = step.actionState === "READY";
  const isPending = step.actionState === "PENDING";
  const isBlocked = step.actionState === "BLOCKED";
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionData = step.actionData as any;
  const config = actionData?.config;
  
  const canEditMetadata = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";
  
  // Fetch users when metadata section is expanded
  useEffect(() => {
    if (metadataExpanded && availableUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true);
      fetch(`/api/users`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableUsers(data);
          }
        })
        .catch(err => {
          console.error("Failed to load users:", err);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [metadataExpanded, availableUsers.length, loadingUsers]);
  
  const handleMetadataUpdate = async (field: 'dueDate' | 'assignedToId' | 'priority', value: string | null) => {
    if (!onUpdateStepMetadata) return;
    
    try {
      let processedValue = value;
      
      // Convert date string (YYYY-MM-DD) to ISO datetime string
      if (field === 'dueDate' && value) {
        const date = new Date(value);
        processedValue = date.toISOString();
      }
      
      await onUpdateStepMetadata(workflow.id, step.id, { [field]: processedValue });
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Task Preview Card */}
      {config && (
        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">What you'll do:</h4>
          <ActionConfigDisplay
            actionType={step.actionType}
            config={config}
            variant="compact"
          />
        </div>
      )}

      {/* Primary Actions */}
      {isReady && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onRunStepAction(step.id, "start")}
            disabled={actionLoading === `${step.id}:start`}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200/50 hover:shadow-xl"
          >
            <Play className="h-5 w-5" />
            {actionLoading === `${step.id}:start` ? "Starting..." : "Start Task"}
          </button>
          
          {!step.assignedToId && (
            <button
              type="button"
              onClick={() => onRunStepAction(step.id, "claim")}
              disabled={actionLoading === `${step.id}:claim`}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <UserCheck className="h-4 w-4" />
              {actionLoading === `${step.id}:claim` ? "Claiming..." : "Claim Task"}
            </button>
          )}
        </div>
      )}

      {/* Step Metadata Info - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Due Date */}
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Due Date</div>
          {step.dueDate ? (
            <>
              <div className="text-sm font-bold text-blue-900">
                {new Date(step.dueDate).toLocaleDateString("tr-TR", { 
                  day: "numeric", 
                  month: "short", 
                  year: "numeric" 
                })}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {(() => {
                  const dueDate = new Date(step.dueDate);
                  const now = new Date();
                  const diffMs = dueDate.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
                  if (diffDays === 0) return "Due today";
                  if (diffDays === 1) return "Due tomorrow";
                  return `${diffDays} days remaining`;
                })()}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-400">Not set</div>
              <div className="text-xs text-slate-400 mt-1">No deadline</div>
            </>
          )}
        </div>

        {/* Assigned To */}
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3">
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Assigned To</div>
          {step.assignedTo ? (
            <>
              <div className="text-sm font-bold text-purple-900">
                {step.assignedTo.name || "Unknown"}
              </div>
              {step.assignedTo.email && (
                <div className="text-xs text-purple-600 mt-1 truncate">
                  {step.assignedTo.email}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-400">Unassigned</div>
              <div className="text-xs text-slate-400 mt-1">Role: {step.roleScope}</div>
            </>
          )}
        </div>

        {/* Priority */}
        <div className={`rounded-lg border-2 p-3 ${
          step.priority === "HIGH" 
            ? "border-red-200 bg-red-50/50" 
            : step.priority === "LOW"
            ? "border-slate-200 bg-slate-50/50"
            : "border-amber-200 bg-amber-50/50"
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            step.priority === "HIGH" 
              ? "text-red-700" 
              : step.priority === "LOW"
              ? "text-slate-700"
              : "text-amber-700"
          }`}>
            Priority
          </div>
          <div className={`text-sm font-bold ${
            step.priority === "HIGH" 
              ? "text-red-900" 
              : step.priority === "LOW"
              ? "text-slate-900"
              : "text-amber-900"
          }`}>
            {step.priority || "MEDIUM"}
          </div>
          <div className={`text-xs mt-1 ${
            step.priority === "HIGH" 
              ? "text-red-600" 
              : step.priority === "LOW"
              ? "text-slate-600"
              : "text-amber-600"
          }`}>
            {step.priority === "HIGH" ? "Urgent" : step.priority === "LOW" ? "Normal" : "Important"}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <Clock className="h-5 w-5 text-slate-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 mb-1">Waiting for Dependencies</p>
              <p className="text-xs text-slate-600">This step cannot start until all required dependencies are completed.</p>
            </div>
          </div>
          
          {step.dependsOn && step.dependsOn.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 mb-2">
                Required steps ({step.dependsOn.length}):
              </div>
              <div className="space-y-2">
                {step.dependsOn.map(depId => {
                  const depStep = workflow.steps.find(s => s.id === depId);
                  if (!depStep) return null;
                  
                  const isDepCompleted = depStep.actionState === 'COMPLETED';
                  const isDepInProgress = depStep.actionState === 'IN_PROGRESS';
                  
                  return (
                    <div
                      key={depId}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                        isDepCompleted
                          ? 'bg-green-50 border-green-200'
                          : isDepInProgress
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isDepCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : isDepInProgress ? (
                          <Clock className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {depStep.title}
                        </div>
                        <div className="text-xs text-slate-600">
                          {depStep.actionType.replace(/_/g, ' ')} • {depStep.roleScope}
                        </div>
                      </div>
                      <div className={`text-xs font-semibold px-2 py-1 rounded ${
                        isDepCompleted
                          ? 'bg-green-100 text-green-700'
                          : isDepInProgress
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isDepCompleted ? 'Done' : isDepInProgress ? 'In Progress' : 'Pending'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isBlocked && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 font-medium">This step is blocked and cannot proceed.</p>
        </div>
      )}

      {/* Step Metadata - Collapsible (for ADMIN/LAWYER only) */}
      {canEditMetadata && onUpdateStepMetadata && (
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setMetadataExpanded(!metadataExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span>Step Details</span>
            {metadataExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {metadataExpanded && (
            <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {/* Due Date */}
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Due Date</span>
                <input
                  type="date"
                  value={step.dueDate ? new Date(step.dueDate).toISOString().slice(0, 10) : ""}
                  onChange={(e) => {
                    const value = e.target.value || null;
                    void handleMetadataUpdate('dueDate', value);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                />
              </label>

              {/* Assigned To */}
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Assigned To</span>
                <select
                  value={step.assignedToId || ""}
                  onChange={(e) => {
                    const value = e.target.value || null;
                    void handleMetadataUpdate('assignedToId', value);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  disabled={loadingUsers}
                >
                  <option value="">Unassigned (role: {step.roleScope})</option>
                  {loadingUsers ? (
                    <option disabled>Loading users...</option>
                  ) : (
                    availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.email ? ` (${user.email})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {/* Priority */}
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Priority</span>
                <select
                  value={step.priority || "MEDIUM"}
                  onChange={(e) => {
                    void handleMetadataUpdate('priority', e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>

              {/* Current Assignment Info */}
              {step.assignedTo && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">Currently assigned to:</p>
                  <p>{step.assignedTo.name || step.assignedTo.email}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

interface InProgressStateViewProps {
  step: WorkflowInstanceStep;
  matterId: string;
  actionLoading: string | null;
  formatRelativeTime: (dateString: string | null) => string | null;
  checklistStates: Record<string, Set<string>>;
  approvalComments: Record<string, string>;
  documentFiles: Record<string, File | null>;
  onSetChecklistStates: Dispatch<SetStateAction<Record<string, Set<string>>>>;
  onSetApprovalComments: Dispatch<SetStateAction<Record<string, string>>>;
  onSetDocumentFiles: Dispatch<SetStateAction<Record<string, File | null>>>;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
  onAddDocumentForStep?: (stepId: string, documentName: string) => void;
}

function InProgressStateView({
  step,
  matterId: _matterId,
  actionLoading,
  formatRelativeTime,
  checklistStates,
  approvalComments,
  documentFiles: _documentFiles,
  onSetChecklistStates,
  onSetApprovalComments,
  onSetDocumentFiles: _onSetDocumentFiles,
  onRunStepAction,
  onAddDocumentForStep,
}: InProgressStateViewProps) {
  const checkedItems = checklistStates[step.id] ?? new Set<string>();
  const comment = approvalComments[step.id] ?? "";

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

  const isLoading = actionLoading === `${step.id}:complete`;

  const renderExecutionUI = () => {
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
      case "REQUEST_DOC":
        return (
          <DocumentRequestExecution
            step={step}
            onAddDocument={onAddDocumentForStep ? (documentName) => onAddDocumentForStep(step.id, documentName) : undefined}
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
            matterId={_matterId}
            onComplete={(payload) => {
              void onRunStepAction(step.id, "complete", { payload });
            }}
            isLoading={isLoading}
          />
        );
      case "TASK":
        return (
          <TaskExecution
            step={step}
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

  return (
    <div className="mt-6 space-y-4">
      {/* Focus Mode Container */}
      <div className="rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-white p-6 shadow-lg shadow-blue-200/50">
        {renderExecutionUI()}
      </div>
      
      {/* Minimal footer metadata */}
      <div className="text-xs text-slate-500 text-center space-y-1">
        {step.startedAt && (
          <p>Started {formatRelativeTime(step.startedAt)}</p>
        )}
        <button
          type="button"
          onClick={() => {
            const reason = window.prompt("Reason for failure:");
            if (reason) {
              void onRunStepAction(step.id, "fail", { reason });
            }
          }}
          disabled={actionLoading === `${step.id}:fail`}
          className="text-red-600 hover:text-red-700 underline"
        >
          Mark as Failed
        </button>
      </div>
    </div>
  );
}

interface CompletedStateViewProps {
  step: WorkflowInstanceStep;
  workflow: WorkflowInstance;
  nextStep: WorkflowInstanceStep | undefined;
  matterId: string;
  calculateDuration: () => string | null;
}

function CompletedStateView({
  step,
  workflow: _workflow,
  nextStep,
  matterId: _matterId,
  calculateDuration,
}: CompletedStateViewProps) {
  const renderOutputUI = () => {
    if (!step.actionData) return null;

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

      case "REQUEST_DOC":
        // Use new multi-document viewer
        if (actionData.data && actionData.config) {
          return (
            <RequestDocViewer
              config={actionData.config}
              data={actionData.data}
            />
          );
        }
        // Fallback for old single-document format
        if (actionData.documentId) {
          return <DocumentViewer documentIds={[actionData.documentId]} />;
        }
        return null;

      case "CHECKLIST":
        if (actionData.completedItems && Array.isArray(actionData.completedItems)) {
          const config = actionData?.config;
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

      case "TASK":
        // TASK stores notes directly in actionData, not nested in data
        return (
          <TaskViewer
            config={actionData.config || {}}
            data={{ notes: actionData.notes }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Success Header */}
      <div className="flex items-center justify-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-6 w-6" />
        <span className="font-semibold">Task Completed Successfully</span>
      </div>

      {/* Results Card */}
      {renderOutputUI() && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6">
          {renderOutputUI()}
        </div>
      )}

      {/* Timeline Footer */}
      <div className="grid grid-cols-3 gap-4 text-sm border-t border-slate-200 pt-4">
        <div>
          <div className="text-slate-500 mb-1">Started</div>
          <div className="font-medium">
            {step.startedAt ? new Date(step.startedAt).toLocaleString("tr-TR") : "—"}
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-1">Completed</div>
          <div className="font-medium">
            {step.completedAt ? new Date(step.completedAt).toLocaleString("tr-TR") : "—"}
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-1">Duration</div>
          <div className="font-medium">{calculateDuration() || "—"}</div>
        </div>
      </div>

      {/* Next Step CTA */}
      {nextStep && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600 mb-2">Next Step:</p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{nextStep.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {nextStep.actionType.replace(/_/g, " ")} · {nextStep.actionState}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SkippedStateViewProps {
  step: WorkflowInstanceStep;
  actionLoading: string | null;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
}

function SkippedStateView({
  step,
  actionLoading,
  onRunStepAction,
}: SkippedStateViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionData = step.actionData as any;
  const reason = actionData?.reason;

  return (
    <div className="mt-6 space-y-6">
      {/* Reason Card */}
      <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-yellow-900 mb-3">
          <AlertCircle className="h-5 w-5" />
          Reason for Skipping
        </h4>
        <p className="text-sm text-yellow-800">
          {reason || "No reason provided"}
        </p>
        {step.completedAt && (
          <p className="text-xs text-yellow-700 mt-2">
            Skipped on {new Date(step.completedAt).toLocaleString("tr-TR")}
          </p>
        )}
      </div>

      {/* Restart Option */}
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Are you sure you want to restart this step?")) {
            void onRunStepAction(step.id, "start", {});
          }
        }}
        disabled={actionLoading === `${step.id}:start`}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ArrowRight className="h-4 w-4 transform rotate-180" />
        {actionLoading === `${step.id}:start` ? "Restarting..." : "Restart This Step"}
      </button>
    </div>
  );
}

interface FailedStateViewProps {
  step: WorkflowInstanceStep;
  actionLoading: string | null;
  onRunStepAction: (stepId: string, action: string, payload?: unknown) => Promise<void>;
}

function FailedStateView({
  step,
  actionLoading,
  onRunStepAction,
}: FailedStateViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionData = step.actionData as any;
  const reason = actionData?.reason;

  return (
    <div className="mt-6 space-y-6">
      {/* Error Card */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-red-900 mb-3">
          <XCircle className="h-5 w-5" />
          Failure Reason
        </h4>
        <p className="text-sm text-red-800">
          {reason || "No reason provided"}
        </p>
        {step.completedAt && (
          <p className="text-xs text-red-700 mt-2">
            Failed on {new Date(step.completedAt).toLocaleString("tr-TR")}
          </p>
        )}
      </div>

      {/* Retry Option */}
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Are you sure you want to retry this step?")) {
            void onRunStepAction(step.id, "start", {});
          }
        }}
        disabled={actionLoading === `${step.id}:start`}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ArrowRight className="h-4 w-4 transform rotate-180" />
        {actionLoading === `${step.id}:start` ? "Retrying..." : "Retry This Step"}
      </button>
    </div>
  );
}
