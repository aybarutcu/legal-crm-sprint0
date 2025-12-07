"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ActionType, Role, RoleScope } from "@prisma/client";
import { StepNode } from "@/components/workflows/nodes/StepNode";
import type { WorkflowStep as CanvasWorkflowStep } from "@/components/workflows/WorkflowCanvas";

export type WorkflowTemplatePreviewStep = {
  id: string;
  title: string;
  order: number;
  actionType: ActionType;
  roleScope: RoleScope;
  required?: boolean;
  actionConfig?: Record<string, unknown> | null;
  positionX?: number | null;
  positionY?: number | null;
};

export type WorkflowTemplatePreviewDependency = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
};

type WorkflowTemplatePreviewProps = {
  steps: WorkflowTemplatePreviewStep[];
  dependencies?: WorkflowTemplatePreviewDependency[];
  height?: number;
  className?: string;
};

type PreviewCanvasStep = CanvasWorkflowStep & {
  order: number;
};

const previewNodeTypes = {
  stepNode: StepNode,
};

export function WorkflowTemplatePreview({
  steps,
  dependencies = [],
  height = 360,
  className = "",
}: WorkflowTemplatePreviewProps) {
  const canvasSteps = useMemo(() => templateStepsToCanvasSteps(steps), [steps]);
  const nodes = useMemo(() => buildPreviewNodes(canvasSteps, dependencies), [canvasSteps, dependencies]);
  const edges = useMemo(() => buildPreviewEdges(canvasSteps, dependencies), [canvasSteps, dependencies]);

  return (
    <div
      className={`w-full rounded-xl border border-slate-200 bg-white ${className}`}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={previewNodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll
        panOnDrag
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function templateStepsToCanvasSteps(steps: WorkflowTemplatePreviewStep[]): PreviewCanvasStep[] {
  return steps.map((step, index) => ({
    id: step.id,
    order: step.order ?? index,
    title: step.title || `Step ${index + 1}`,
    actionType: step.actionType as CanvasWorkflowStep["actionType"],
    roleScope: (step.roleScope as Role) ?? "ADMIN",
    required: step.required ?? true,
    actionConfig: step.actionConfig ?? {},
    positionX:
      typeof step.positionX === "number" ? step.positionX : (step.order ?? index) * 260 + 50,
    positionY: typeof step.positionY === "number" ? step.positionY : 100,
  }));
}

function buildPreviewNodes(steps: PreviewCanvasStep[], dependencies: WorkflowTemplatePreviewDependency[]): Node[] {
  return steps.map((step) => {
    const stepDependencies = dependencies.filter(dep => dep.targetStepId === step.id);
    const dependencyCount = stepDependencies.length;
    const dependencyLogic = stepDependencies.length > 0 ? stepDependencies[0].dependencyLogic : "ALL";

    return {
      id: step.id,
      type: "stepNode",
      position: {
        x: typeof step.positionX === "number" ? step.positionX : step.order * 260 + 50,
        y: typeof step.positionY === "number" ? step.positionY : 100,
      },
      data: {
        step,
        label: step.title,
        actionType: step.actionType,
        roleScope: step.roleScope,
        dependencyCount,
        dependencyLogic,
      },
    };
  });
}

function buildPreviewEdges(steps: PreviewCanvasStep[], dependencies: WorkflowTemplatePreviewDependency[]): Edge[] {
  return dependencies.map((dep) => {
    const sourceId = dep.sourceStepId;
    const targetId = dep.targetStepId;

    return {
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      sourceHandle: "next",
      target: targetId,
      type: "smoothstep",
      animated: false,
      style: { strokeWidth: 2, stroke: "#94a3b8" },
      markerEnd: { type: MarkerType.ArrowClosed },
      label: dep.dependencyLogic,
    };
  });
}
