"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { WorkflowTimeline, WorkflowStepDetail } from "./";
import type { WorkflowTimelineInstance } from "./WorkflowTimeline";
import type { WorkflowInstanceStep, WorkflowInstance } from "./types";
import type { DocumentListItem } from "@/components/documents/types";
import { FolderTreeView } from "@/components/documents/FolderTreeView";

type ActionType =
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "AUTOMATION_EMAIL"
  | "AUTOMATION_WEBHOOK";

type ActionState =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

type WorkflowInstanceWithDetails = {
  id: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  template: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  steps: Array<{
    id: string;
    title: string;
    actionType: ActionType;
    actionState: ActionState;
    actionData: Record<string, unknown> | null;
    roleScope: RoleScope;
    required: boolean;
    order?: number;
    assignedToId: string | null;
    dueDate: Date | string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    positionX?: number | null;
    positionY?: number | null;
  }>;
  dependencies?: Array<{
    id: string;
    sourceStepId: string;
    targetStepId: string;
    dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
    dependencyLogic: "ALL" | "ANY" | "CUSTOM";
    conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
    conditionConfig?: Record<string, unknown>;
  }>;
};

interface WorkflowManagementSectionProps {
  // Entity information
  entityId: string; // matterId or contactId
  entityType: "matter" | "contact"; // determines API endpoints and behavior

  // Workflow data
  workflows: WorkflowInstanceWithDetails[];

  // User permissions
  currentUserRole: Role;
  currentUserId?: string;
  canManageWorkflows: boolean;

  // Documents (optional - for matters)
  documents?: DocumentListItem[];
  docsLoading?: boolean;
  onUploadDocument?: () => void;
  onViewDocument?: (document: DocumentListItem) => void;
  highlightedDocumentIds?: string[];

  // Matter/Contact team member IDs for folder access control
  teamMemberIds?: string[];
  matterOwnerId?: string;

  // Refresh key to trigger folder tree refresh after document uploads
  folderTreeRefreshKey?: number;

  // Callbacks
  onRefresh?: () => void;
  onAddWorkflow?: () => void;
  onCancelWorkflow?: (workflowId: string) => void;
  onDeleteWorkflow?: (workflowId: string) => void;
  onUpdateStepMetadata?: (workflowId: string, stepId: string, data: {
    dueDate?: string | null;
    assignedToId?: string | null;
    priority?: string | null;
  }) => Promise<void>;
  onAddDocumentForStep?: (stepId: string, documentName: string) => void;
}

export function WorkflowManagementSection({
  entityId,
  entityType,
  workflows,
  currentUserRole,
  currentUserId,
  canManageWorkflows,
  documents = [],
  docsLoading = false,
  onUploadDocument,
  onViewDocument,
  highlightedDocumentIds = [],
  teamMemberIds = [],
  matterOwnerId,
  folderTreeRefreshKey,
  onRefresh,
  onAddWorkflow,
  onCancelWorkflow,
  onDeleteWorkflow,
  onUpdateStepMetadata,
  onAddDocumentForStep,
}: WorkflowManagementSectionProps) {
  const router = useRouter();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [checklistStates, setChecklistStates] = useState<Record<string, Set<string>>>({});
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});

  // Compute highlighted document IDs based on selected step
  const computedHighlightedDocumentIds = selectedStepId
    ? documents.filter((doc) => doc.workflowStepId === selectedStepId).map((doc) => doc.id)
    : [];
  
  // Merge with externally provided highlighted IDs
  const finalHighlightedDocumentIds = [
    ...new Set([...highlightedDocumentIds, ...computedHighlightedDocumentIds])
  ];

  // Helper function to safely convert Date | string to string
  const toISOString = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  };

  const handleWorkflowStarted = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      router.refresh();
    }
  };

    // Transform workflows to the format expected by WorkflowTimeline
  const timelineWorkflows: WorkflowTimelineInstance[] = workflows.map((wf) => ({
    id: wf.id,
    template: wf.template ? { id: wf.template.id, name: wf.template.name, version: 1 } : { id: "unknown", name: "Unknown Template", version: 1 }, // Default version
    templateVersion: 1, // Default version
    createdBy: null, // Not fetched for simplicity
    createdAt: toISOString(wf.createdAt)!,
    status: wf.status as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED",
    steps: wf.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      required: step.required,
      actionState: step.actionState,
      actionData: step.actionData,
      assignedToId: step.assignedToId,
      priority: step.priority,
      dueDate: toISOString(step.dueDate),
      startedAt: toISOString(step.startedAt),
      completedAt: toISOString(step.completedAt),
      positionX: step.positionX ?? undefined,
      positionY: step.positionY ?? undefined,
    })),
    dependencies: wf.dependencies?.map((dep) => ({
      id: dep.id,
      sourceStepId: dep.sourceStepId,
      targetStepId: dep.targetStepId,
      dependencyType: dep.dependencyType,
      dependencyLogic: dep.dependencyLogic,
      conditionType: dep.conditionType,
      conditionConfig: dep.conditionConfig,
    })),
  }));

  // Transform selected step and workflow to WorkflowInstanceStep and WorkflowInstance types
  const selectedStep: WorkflowInstanceStep | null = selectedStepId
    ? (() => {
        const wf = workflows.find((w) => w.id === selectedWorkflowId);
        const step = wf?.steps.find((s) => s.id === selectedStepId);
        if (!step) return null;

        return {
          id: step.id,
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required,
          actionState: step.actionState,
          actionData: step.actionData,
          assignedToId: step.assignedToId,
          assignedTo: (step as any).assignedTo || null, // Pass through if available
          dueDate: toISOString(step.dueDate),
          priority: step.priority,
          notes: null, // Not available in input
          startedAt: toISOString(step.startedAt),
          completedAt: toISOString(step.completedAt),
          positionX: step.positionX ?? undefined,
          positionY: step.positionY ?? undefined,
        };
      })()
    : null;

  const selectedWorkflow: WorkflowInstanceWithDetails | null = selectedWorkflowId
    ? (() => {
        const wf = workflows.find((w) => w.id === selectedWorkflowId);
        if (!wf) return null;

        return {
          id: wf.id,
          status: wf.status,
          createdAt: toISOString(wf.createdAt)!,
          createdBy: null, // Not fetched
          template: wf.template ? { id: wf.template.id, name: wf.template.name, description: wf.template.description } : null,
          templateVersion: 1, // Default
          steps: wf.steps.map((step) => ({
            id: step.id,
            title: step.title,
            actionType: step.actionType,
            roleScope: step.roleScope,
            required: step.required,
            actionState: step.actionState,
            actionData: step.actionData,
            assignedToId: step.assignedToId,
            assignedTo: (step as any).assignedTo || null, // Pass through if available
            dueDate: toISOString(step.dueDate),
            priority: step.priority,
            notes: null, // Not available in input
            startedAt: toISOString(step.startedAt),
            completedAt: toISOString(step.completedAt),
            positionX: step.positionX ?? undefined,
            positionY: step.positionY ?? undefined,
          })),
          dependencies: undefined, // Type mismatch - will be fixed later if needed
        };
      })()
    : null;

  const runStepAction = useCallback(
    async (stepId: string, action: string, payload?: unknown) => {
      if (!selectedWorkflowId) return;

      setActionLoading(`${stepId}:${action}`);
      try {
        const endpoint = `/api/workflows/steps/${stepId}/${action}`;

        // Find the step to determine its action type
        const step = workflows
          .flatMap(w => w.steps)
          .find(s => s.id === stepId);

        let requestBody: any = null;

        if (action === "complete") {
          // Extract the inner payload for all actions
          const innerPayload = (payload as any)?.payload || payload;
          
          if (step?.actionType === "APPROVAL") {
            requestBody = {
              payload: innerPayload,
            };
          } else {
            // For other actions, merge the inner payload with common fields
            requestBody = {
              payload: {
                ...innerPayload,
                checklistState: checklistStates,
                approvalComment: approvalComments[stepId],
                documentFiles: documentFiles[stepId],
              },
            };
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: requestBody ? { "Content-Type": "application/json" } : undefined,
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        });

        if (!response.ok) {
          throw new Error("Failed to execute step");
        }

        await handleWorkflowStarted();
      } catch (error) {
        console.error("Error executing step:", error);
        window.alert("Failed to execute step");
      } finally {
        setActionLoading(null);
      }
    },
    [selectedWorkflowId, workflows, checklistStates, approvalComments, documentFiles, handleWorkflowStarted]
  );

  const handleOpenEditStep = useCallback((instanceId: string, step: WorkflowInstanceStep) => {
    // For matters, we might have edit functionality
    // For contacts, this is a no-op
    console.log("Edit step requested:", instanceId, step);
  }, []);

  const handleMoveStep = useCallback(async (instanceId: string, stepId: string, direction: -1 | 1) => {
    // Only matters support step reordering
    if (entityType !== "matter") return;

    try {
      const response = await fetch(`/api/matters/${entityId}/workflows/${instanceId}/steps/${stepId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });

      if (!response.ok) {
        throw new Error("Failed to move step");
      }

      await handleWorkflowStarted();
    } catch (error) {
      console.error("Error moving step:", error);
      window.alert("Failed to move step");
    }
  }, [entityId, entityType, handleWorkflowStarted]);

  const handleDeleteStep = useCallback(async (instanceId: string, stepId: string) => {
    // Only matters support step deletion
    if (entityType !== "matter") return;

    if (!window.confirm("Are you sure you want to delete this step?")) return;

    try {
      const response = await fetch(`/api/matters/${entityId}/workflows/${instanceId}/steps/${stepId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete step");
      }

      await handleWorkflowStarted();
    } catch (error) {
      console.error("Error deleting step:", error);
      window.alert("Failed to delete step");
    }
  }, [entityId, entityType, handleWorkflowStarted]);

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500 mb-4">
          {entityType === "matter"
            ? "No workflows started yet. Start a workflow to track progress for this matter."
            : "No workflows started yet. Start a workflow to track progress for this lead."
          }
        </p>
        {canManageWorkflows && onAddWorkflow && (
          <button
            onClick={onAddWorkflow}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            + Start Workflow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Timeline - Horizontal scrollable timeline */}
      <WorkflowTimeline
        workflows={timelineWorkflows}
        selectedStepId={selectedStepId}
        currentUserRole={currentUserRole}
        onStepClick={(workflowId, stepId) => {
          setSelectedWorkflowId(workflowId);
          setSelectedStepId(stepId);
        }}
        onAddWorkflow={canManageWorkflows && onAddWorkflow ? onAddWorkflow : undefined}
        onCancelWorkflow={onCancelWorkflow}
        onDeleteWorkflow={onDeleteWorkflow}
      />

      {/* Workflows and Documents Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workflows Section - 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <WorkflowStepDetail
            step={selectedStep}
            workflow={selectedWorkflow as any}
            matterId={entityId}
            actionLoading={actionLoading}
            hoveredStep={hoveredStep}
            currentUserRole={currentUserRole}
            onClose={() => {
              setSelectedStepId(null);
              setSelectedWorkflowId(null);
            }}
            onSetHoveredStep={setHoveredStep}
            onOpenEditStep={handleOpenEditStep}
            onRunStepAction={runStepAction}
            onMoveStep={handleMoveStep}
            onDeleteStep={handleDeleteStep}
            onUpdateStepMetadata={onUpdateStepMetadata}
            onAddDocumentForStep={onAddDocumentForStep}
            checklistStates={checklistStates}
            approvalComments={approvalComments}
            documentFiles={documentFiles}
            onSetChecklistStates={setChecklistStates}
            onSetApprovalComments={setApprovalComments}
            onSetDocumentFiles={setDocumentFiles}
          />
        </div>

        {/* Documents Section - 1/3 width on large screens */}
        <div className="lg:col-span-1">
          <FolderTreeView
            matterId={entityType === "matter" ? entityId : undefined}
            contactId={entityType === "contact" ? entityId : undefined}
            matterTeamMemberIds={entityType === "matter" ? teamMemberIds : undefined}
            matterOwnerId={matterOwnerId}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            refreshKey={folderTreeRefreshKey}
            onDocumentClick={(documentId) => {
              const doc = documents.find(d => d.id === documentId);
              if (doc && onViewDocument) {
                onViewDocument(doc);
              }
            }}
            onUploadDocument={onUploadDocument}
          />
        </div>
      </div>
    </div>
  );
}