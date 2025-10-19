"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { StartWorkflowDialog } from "./start-workflow-dialog";
import { WorkflowTimeline, WorkflowStepDetail } from "@/components/matters/workflows";
import type { WorkflowTimelineInstance } from "@/components/matters/workflows/WorkflowTimeline";

type WorkflowInstanceWithDetails = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  template: {
    id: string;
    name: string;
    description: string | null;
  };
  steps: Array<{
    id: string;
    title: string;
    actionType: string;
    actionState: string;
    actionData: Record<string, unknown> | null;
    roleScope: string;
    required: boolean;
    order: number;
    assignedToId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
};

interface ContactWorkflowsSectionProps {
  contactId: string;
  workflows: WorkflowInstanceWithDetails[];
  currentUserRole: Role;
  canManageWorkflows: boolean;
  onRefresh?: () => void;
}

export function ContactWorkflowsSection({
  contactId,
  workflows,
  currentUserRole,
  canManageWorkflows,
  onRefresh,
}: ContactWorkflowsSectionProps) {
  const router = useRouter();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [checklistStates, setChecklistStates] = useState<Record<string, Set<string>>>({});
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});

  const handleWorkflowStarted = () => {
    // Refresh the page to show the new workflow
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
  };

  // Transform workflows to the format expected by WorkflowTimeline
  const timelineWorkflows: WorkflowTimelineInstance[] = workflows.map((wf) => ({
    id: wf.id,
    template: { id: wf.template.id, name: wf.template.name },
    createdBy: null, // Not fetched for contacts
    createdAt: wf.createdAt.toISOString(),
    status: wf.status as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED",
    steps: wf.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      actionType: step.actionType as "APPROVAL_LAWYER" | "SIGNATURE_CLIENT" | "REQUEST_DOC_CLIENT" | "PAYMENT_CLIENT" | "CHECKLIST" | "WRITE_TEXT" | "POPULATE_QUESTIONNAIRE",
      roleScope: step.roleScope as "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT",
      required: step.required,
      actionState: step.actionState as "PENDING" | "READY" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "FAILED" | "SKIPPED",
      actionData: step.actionData,
      assignedToId: step.assignedToId,
      startedAt: step.startedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
    })),
  }));

  const runStepAction = useCallback(
    async (stepId: string) => {
      setActionLoading(stepId);
      try {
        // Call the API to execute the workflow step
        const response = await fetch(`/api/workflows/instances/${selectedWorkflowId}/steps/${stepId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checklistState: checklistStates,
            approvalComment: approvalComments[stepId],
            documentFiles: documentFiles[stepId],
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to execute step");
        }

        // Refresh the page to show updated workflow
        handleWorkflowStarted();
      } catch (error) {
        console.error("Error executing step:", error);
        window.alert("Failed to execute step");
      } finally {
        setActionLoading(null);
      }
    },
    [selectedWorkflowId, checklistStates, approvalComments, documentFiles, handleWorkflowStarted]
  );

  if (workflows.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-gray-500 mb-4">
            No workflows started yet. Start a workflow to track progress for this lead.
          </p>
          {canManageWorkflows && (
            <button
              onClick={() => setShowStartDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              + Start Workflow
            </button>
          )}
        </div>
        <StartWorkflowDialog
          contactId={contactId}
          open={showStartDialog}
          onOpenChange={setShowStartDialog}
          onSuccess={handleWorkflowStarted}
        />
      </>
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
        onAddWorkflow={canManageWorkflows ? () => setShowStartDialog(true) : undefined}
      />

      {/* Workflow Step Detail - Shows selected step with action buttons */}
      <WorkflowStepDetail
        step={
          selectedStepId
            ? timelineWorkflows.flatMap((w) => w.steps).find((s) => s.id === selectedStepId) ?? null
            : null
        }
        workflow={
          selectedWorkflowId ? timelineWorkflows.find((w) => w.id === selectedWorkflowId) ?? null : null
        }
        matterId={contactId} // Using contactId as matterId for the component
        actionLoading={actionLoading}
        hoveredStep={null}
        currentUserRole={currentUserRole}
        onClose={() => {
          setSelectedStepId(null);
          setSelectedWorkflowId(null);
        }}
        onSetHoveredStep={() => {}} // Not used for contacts
        onOpenEditStep={() => {}} // Not editable for contacts
        onRunStepAction={runStepAction}
        onMoveStep={() => Promise.resolve()} // Not moveable for contacts
        onDeleteStep={() => Promise.resolve()} // Not deletable for contacts
        checklistStates={checklistStates}
        approvalComments={approvalComments}
        documentFiles={documentFiles}
        onSetChecklistStates={setChecklistStates}
        onSetApprovalComments={setApprovalComments}
        onSetDocumentFiles={setDocumentFiles}
      />

      {/* Start Workflow Dialog */}
      <StartWorkflowDialog
        contactId={contactId}
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onSuccess={handleWorkflowStarted}
      />
    </div>
  );
}
