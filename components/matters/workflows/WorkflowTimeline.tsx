"use client";

import { useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  MarkerType,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { WorkflowTimelineNode } from "./WorkflowTimelineNode";
import type { NotificationPolicy } from "@/lib/workflows/notification-policy";

type ActionType =
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "TASK"
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

export type WorkflowTimelineStep = {
  id: string;
  order?: number;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: Record<string, unknown> | null;
  assignedToId: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | null;
  dueDate?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  dependsOn?: string[];
  positionX?: number | null;
  positionY?: number | null;
  nextStepOnTrue?: string | null;
  nextStepOnFalse?: string | null;
  notificationPolicies?: NotificationPolicy[];
  automationLog?: unknown;
  notificationLog?: unknown;
};

export type WorkflowTimelineInstance = {
  id: string;
  template: { id: string; name: string; version?: number };
  templateVersion: number;
  createdBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  steps: WorkflowTimelineStep[];
  dependencies?: WorkflowTimelineDependency[];
};

export type WorkflowTimelineDependency = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
};

type WorkflowTimelineProps = {
  workflows: WorkflowTimelineInstance[];
  selectedStepId: string | null;
  currentUserRole?: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";
  onStepClick: (workflowId: string, stepId: string) => void;
  onAddWorkflow?: () => void;
  onCancelWorkflow?: (workflowId: string) => void;
  onDeleteWorkflow?: (workflowId: string) => void;
  onAddStep?: (workflowId: string) => void;
};

export function WorkflowTimeline({
  workflows,
  selectedStepId,
  currentUserRole,
  onStepClick,
  onAddWorkflow,
  onCancelWorkflow,
  onDeleteWorkflow,
}: WorkflowTimelineProps) {
  const canManageWorkflows = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";
  const [expandedWorkflowIds, setExpandedWorkflowIds] = useState<Record<string, boolean>>({});
  const toggleWorkflow = (id: string) => {
    setExpandedWorkflowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
                <h4 className="font-medium text-slate-900">
                  {workflow.template.name} · v{workflow.template.version ?? workflow.templateVersion}
                </h4>
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
                    {/* Cancel Workflow Button */}
                    {onCancelWorkflow && (
                      <button
                        type="button"
                        onClick={() => onCancelWorkflow(workflow.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        title="Cancel Workflow"
                      >
                        Cancel Workflow
                      </button>
                    )}
                    {/* Delete Workflow Button */}
                    {onDeleteWorkflow && (
                      <button
                        type="button"
                        onClick={() => onDeleteWorkflow(workflow.id)}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                        title="Delete Workflow"
                        style={{ marginLeft: 4 }}
                      >
                        Delete Workflow
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleWorkflow(workflow.id)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-600 hover:shadow transition-colors"
                    >
                      <span>{expandedWorkflowIds[workflow.id] ?? true ? "Hide Timeline" : "Show Timeline"}</span>
                      {expandedWorkflowIds[workflow.id] ?? true ? (
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.062L10.53 12.53a.75.75 0 01-1.06 0L5.21 8.293a.75.75 0 01.02-1.082z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M14.77 12.79a.75.75 0 01-1.06-.02L10 9.061l-3.71 3.71a.75.75 0 11-1.06-1.062l4.24-4.24a.75.75 0 011.06 0l4.24 4.24a.75.75 0 01-.02 1.082z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {(expandedWorkflowIds[workflow.id] ?? true) ? (
              <WorkflowTimelineCanvas
                workflow={workflow}
                selectedStepId={selectedStepId}
                onStepClick={onStepClick}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-center text-xs text-slate-500">
                Canvas hidden. Click "Show Canvas" to visualize steps.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
type WorkflowTimelineCanvasProps = {
  workflow: WorkflowTimelineInstance;
  selectedStepId: string | null;
  onStepClick: (workflowId: string, stepId: string) => void;
};

const nodeTypes = { timelineNode: WorkflowTimelineNode };

function WorkflowTimelineCanvas({ workflow, selectedStepId, onStepClick }: WorkflowTimelineCanvasProps) {
  if (workflow.steps.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        This workflow has no steps yet.
      </div>
    );
  }

  const nodes = buildTimelineNodes(workflow, selectedStepId);
  const edges = buildTimelineEdges(workflow);
  const height = computeCanvasHeight(workflow.steps);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-2">
      <div style={{ height }} className="w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          onNodeClick={(_, node) => onStepClick(workflow.id, node.id)}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function buildTimelineNodes(workflow: WorkflowTimelineInstance, selectedStepId: string | null): Node[] {
  return workflow.steps.map((step, index) => {
    const fallback = getFallbackPosition(index);
    const position = {
      x: typeof step.positionX === "number" ? step.positionX : fallback.x,
      y: typeof step.positionY === "number" ? step.positionY : fallback.y,
    };
    const showDefaultHandle = hasDefaultOutgoingDependency(step, workflow);

    return {
      id: step.id,
      type: "timelineNode",
      position,
      data: {
        step,
        isSelected: step.id === selectedStepId,
        showDefaultHandle,
      },
      draggable: false,
    };
  });
}

function buildTimelineEdges(workflow: WorkflowTimelineInstance): Edge[] {
  const edges: Edge[] = [];
  const steps = workflow.steps;
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const dependencies = workflow.dependencies || [];

  // Build edges from dependencies array
  dependencies.forEach((dep) => {
    if (!stepById.has(dep.sourceStepId) || !stepById.has(dep.targetStepId)) return;

    let edgeStyle = { stroke: "#cbd5f5", strokeWidth: 2 };
    let markerColor = "#94a3b8";
    let sourceHandle = "next";
    let label: string | undefined;

    // Handle different dependency types
    switch (dep.dependencyType) {
      case "IF_TRUE_BRANCH":
        edgeStyle = { stroke: "#10b981", strokeWidth: 2 };
        markerColor = "#10b981";
        sourceHandle = "approve";
        label = "Approve";
        break;
      case "IF_FALSE_BRANCH":
        edgeStyle = { stroke: "#ef4444", strokeWidth: 2 };
        markerColor = "#ef4444";
        sourceHandle = "reject";
        label = "Reject";
        break;
      case "DEPENDS_ON":
      default:
        // Default dependency styling
        break;
    }

    edges.push({
      id: `${dep.sourceStepId}-${dep.targetStepId}`,
      source: dep.sourceStepId,
      sourceHandle,
      target: dep.targetStepId,
      type: "smoothstep",
      animated: false,
      label,
      style: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: markerColor },
      data: dep.dependencyType === "IF_TRUE_BRANCH" ? { branchCase: "approve" } :
            dep.dependencyType === "IF_FALSE_BRANCH" ? { branchCase: "reject" } : undefined,
    });
  });

  return edges;
}

function getFallbackPosition(index: number) {
  const columnWidth = 260;
  const rowHeight = 180;
  const columns = 4;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: column * columnWidth + 40,
    y: row * rowHeight + 40,
  };
}

function computeCanvasHeight(steps: WorkflowTimelineStep[]) {
  if (steps.length === 0) return 240;
  const maxY = Math.max(
    ...steps.map((step, index) =>
      typeof step.positionY === "number" ? step.positionY : getFallbackPosition(index).y,
    ),
  );

  return Math.max(280, maxY + 160);
}

function hasDefaultOutgoingDependency(step: WorkflowTimelineStep, workflow: WorkflowTimelineInstance) {
  const dependencies = workflow.dependencies || [];
  const branchTrueTarget = step.nextStepOnTrue;
  const branchFalseTarget = step.nextStepOnFalse;

  return dependencies.some((dep) => {
    if (dep.sourceStepId !== step.id) {
      return false;
    }

    // Exclude branching dependencies
    if (branchTrueTarget && dep.targetStepId === branchTrueTarget && dep.dependencyType === "IF_TRUE_BRANCH") {
      return false;
    }
    if (branchFalseTarget && dep.targetStepId === branchFalseTarget && dep.dependencyType === "IF_FALSE_BRANCH") {
      return false;
    }

    // Include DEPENDS_ON and TRIGGERS dependencies
    return dep.dependencyType === "DEPENDS_ON" || dep.dependencyType === "TRIGGERS";
  });
}
