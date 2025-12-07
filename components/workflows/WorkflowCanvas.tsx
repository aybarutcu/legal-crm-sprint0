"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { ActionType } from "./config-forms/ActionConfigForm";
import { Role } from "@prisma/client";
import { StepNode } from "./nodes/StepNode";
import { NodePalette } from "./NodePalette";
import { StepPropertyPanel } from "./StepPropertyPanel";
import type { NotificationPolicy } from "@/lib/workflows/notification-policy";
import { createStepId } from "@/components/workflows/create-step-id";

// WorkflowStep interface matching our validation schema
export interface WorkflowStep {
  id: string;
  title: string;
  actionType: ActionType;
  roleScope: Role;
  required?: boolean;
  actionConfig?: Record<string, unknown> | unknown[];
  positionX?: number;
  positionY?: number;
  notificationPolicies?: NotificationPolicy[];
  order?: number;
  dependsOn?: number[];
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
}

export interface WorkflowDependency {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
}

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  dependencies?: WorkflowDependency[];
  onChange: (steps: WorkflowStep[], dependencies?: WorkflowDependency[]) => void;
  onValidate?: (validation: { valid: boolean; errors: string[] }) => void;
  readOnly?: boolean;
}

// Define nodeTypes outside component to prevent recreation on every render
const nodeTypes = {
  stepNode: StepNode,
};

// Define defaultEdgeOptions outside component to prevent recreation on every render
const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: false,
};

export function WorkflowCanvas({
  steps,
  dependencies = [],
  onChange,
  onValidate,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Initialize nodes and edges from steps and dependencies
  const initialNodes = useMemo(() => stepsToNodes(steps, dependencies || [], selectedNodeId), [steps, dependencies, selectedNodeId]);
  const initialEdges = useMemo(() => dependenciesToEdges(dependencies), [dependencies]);

  // Internal state for visual positioning (ReactFlow needs this for dragging)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when steps or dependencies change from parent (simplified)
  useEffect(() => {
    setNodes(stepsToNodes(steps, dependencies, selectedNodeId));
    setEdges(dependenciesToEdges(dependencies));
  }, [steps, dependencies, selectedNodeId, setNodes, setEdges]);

  // Validate current workflow
  const validation = useMemo(() => {
    if (!onValidate) return { valid: true, errors: [] };
    return validateWorkflowDependencies(steps, dependencies);
  }, [steps, dependencies, onValidate]);

  // Call onValidate when validation changes
  useEffect(() => {
    if (onValidate && validation) {
      onValidate(validation);
    }
  }, [validation, onValidate]);

  // Handle new connections (dependencies)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;

      const sourceId = connection.source;
      const targetId = connection.target;
      if (!sourceId || !targetId) return;

      const sourceStep = steps.find((step) => step.id === sourceId);
      const targetStep = steps.find((step) => step.id === targetId);

      if (!sourceStep || !targetStep) {
        console.error("Unable to locate source or target step for connection");
        return;
      }

      if (sourceId === targetId) {
        console.error("Cannot create connection to the same step");
        return;
      }

      // Check if dependency already exists
      const existingDep = dependencies.find(
        (dep) => dep.sourceStepId === sourceId && dep.targetStepId === targetId
      );

      if (existingDep) {
        console.warn("Dependency already exists");
        return;
      }

      // Create new dependency
      const newDependency: WorkflowDependency = {
        id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sourceStepId: sourceId,
        targetStepId: targetId,
        dependencyType: "DEPENDS_ON",
        dependencyLogic: "ALL", // Default to ALL for new connections
      };

      const updatedDependencies = [...dependencies, newDependency];
      onChange(steps, updatedDependencies);
    },
    [steps, dependencies, onChange, readOnly]
  );

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Handle node drag stop - save positions
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (readOnly) return;

      const updatedSteps = steps.map((step) => {
        if (step.id === node.id) {
          return {
            ...step,
            positionX: node.position.x,
            positionY: node.position.y,
          };
        }
        return step;
      });

      onChange(updatedSteps, dependencies);
    },
    [steps, dependencies, onChange, readOnly]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (readOnly) return;

      const updatedDependencies = dependencies.filter(dep => 
        !deletedEdges.some(edge => edge.id === `${dep.sourceStepId}-${dep.targetStepId}`)
      );

      onChange(steps, updatedDependencies);
    },
    [steps, dependencies, onChange, readOnly]
  );

  // Get selected step
  const selectedStep = useMemo(() => {
    if (!selectedNodeId) return null;
    return steps.find((s) => s.id === selectedNodeId);
  }, [selectedNodeId, steps]);

  // Handle step property updates
  const handleStepUpdate = useCallback(
    (updatedStep: WorkflowStep) => {
      const updatedSteps = steps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step
      );
      onChange(updatedSteps, dependencies);
    },
    [steps, dependencies, onChange]
  );

  // Handle step deletion
  const handleStepDelete = useCallback(
    (stepId: string) => {
      const filtered = steps.filter((step) => step.id !== stepId);

      // Remove all dependencies that reference the deleted step
      const filteredDependencies = (dependencies || []).filter(
        (dep) => dep.sourceStepId !== stepId && dep.targetStepId !== stepId
      );

      onChange(filtered, filteredDependencies);
      setSelectedNodeId(null);
    },
    [steps, dependencies, onChange]
  );

  return (
    <div className="relative w-full h-full min-h-[600px] border rounded-lg bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={defaultEdgeOptions}
        selectNodesOnDrag={false}
        selectionKeyCode={null}
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Validation Panel */}
        <Panel position="top-center">
          {!validation.valid ? (
            <div className="bg-red-50 border-2 border-red-500 rounded-lg px-4 py-2 shadow-lg">
              <span className="text-red-700 font-semibold">
                ⚠ Validation Errors: {validation.errors.length}
              </span>
              <div className="text-xs text-red-600 mt-1">
                {validation.errors[0]}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg px-4 py-2 shadow-lg">
              <span className="text-green-700 font-semibold">
                ✓ Workflow Valid
              </span>
            </div>
          )}
        </Panel>

        {/* Empty State */}
        {steps.length === 0 && (
          <Panel position="top-left" className="m-8">
            <div className="text-center text-gray-500 bg-white rounded-lg p-8 shadow-lg border-2 border-dashed border-gray-300">
              <p className="text-lg font-semibold mb-2">
                🎨 Start Building Your Workflow
              </p>
              <p className="text-sm">
                Drag action types from the palette to build your workflow
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Node Palette */}
      {!readOnly && <NodePalette onAddNode={handleAddNodeFromPalette} />}

      {/* Property Panel */}
      {selectedStep && !readOnly && (
        <StepPropertyPanel
          step={selectedStep}
          allSteps={steps}
          dependencies={dependencies}
          onUpdate={handleStepUpdate}
          onUpdateDependencies={(updatedDependencies) => onChange(steps, updatedDependencies)}
          onDelete={handleStepDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );

  // Helper: Add node from palette
  function handleAddNodeFromPalette(actionType: ActionType) {
    const newStep: WorkflowStep = {
      id: createStepId(),
      title: `New ${actionType.replace(/_/g, " ")} Step`,
      actionType,
      roleScope: actionType.includes("CLIENT") ? Role.CLIENT : Role.LAWYER,
      required: true,
      actionConfig: {},
      notificationPolicies: [],
    };

    onChange([...steps, newStep], dependencies);
  }
}

// Helper: Convert steps to React Flow nodes
function stepsToNodes(steps: WorkflowStep[], dependencies: WorkflowDependency[], selectedNodeId?: string | null): Node[] {
  const nodes = steps.map((step, index) => {
    const dependencyCount = dependencies.filter(dep => dep.targetStepId === step.id).length;
    const dependencyLogic = dependencies.find(dep => dep.targetStepId === step.id)?.dependencyLogic || "ALL";

    const position = { 
      x: step.positionX ?? index * 300 + 50, // Use saved position or default based on index
      y: step.positionY ?? 100 
    };

    return {
      id: step.id,
      type: "stepNode",
      position,
      selected: step.id === selectedNodeId,
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
  
  return nodes;
}

// Helper: Convert dependencies to React Flow edges
function dependenciesToEdges(dependencies: WorkflowDependency[]): Edge[] {
  return dependencies.map((dep) => ({
    id: `${dep.sourceStepId}-${dep.targetStepId}`,
    source: dep.sourceStepId,
    target: dep.targetStepId,
    type: "smoothstep",
    label: dep.dependencyLogic,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { dependency: dep },
  }));
}

// Helper: Validate workflow dependencies
function validateWorkflowDependencies(
  steps: WorkflowStep[],
  dependencies: WorkflowDependency[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const stepIds = new Set(steps.map((step) => step.id));

  // Check for invalid dependencies
  for (const dep of dependencies) {
    if (!stepIds.has(dep.sourceStepId)) {
      errors.push(`Dependency references unknown source step: ${dep.sourceStepId}`);
    }
    if (!stepIds.has(dep.targetStepId)) {
      errors.push(`Dependency references unknown target step: ${dep.targetStepId}`);
    }
    if (dep.sourceStepId === dep.targetStepId) {
      const step = steps.find(s => s.id === dep.sourceStepId);
      errors.push(`Step "${step?.title || dep.sourceStepId}" cannot depend on itself`);
    }
  }

  // Check for cycles
  const cycles = detectCyclesInDependencies(dependencies, steps);
  errors.push(...cycles);

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Helper: Detect cycles in dependency graph
function detectCyclesInDependencies(
  dependencies: WorkflowDependency[],
  steps: WorkflowStep[]
): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const adjacency = new Map<string, string[]>();

  // Build adjacency list from dependencies
  dependencies.forEach((dep) => {
    if (!adjacency.has(dep.targetStepId)) {
      adjacency.set(dep.targetStepId, []);
    }
    adjacency.get(dep.targetStepId)!.push(dep.sourceStepId);
  });

  function dfs(stepId: string, path: string[]): boolean {
    if (recStack.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      const cyclePath = path.slice(cycleStart).concat(stepId);
      const titles = cyclePath
        .map((id) => steps.find((s) => s.id === id)?.title ?? id)
        .join(" → ");
      errors.push(`Circular dependency detected: ${titles}`);
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recStack.add(stepId);

    const deps = adjacency.get(stepId) ?? [];
    for (const dep of deps) {
      if (dfs(dep, [...path, stepId])) {
        return true;
      }
    }

    recStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return errors;
}
