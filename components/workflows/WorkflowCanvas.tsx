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

import { ActionType, Role } from "@prisma/client";
import { StepNode } from "./nodes/StepNode";
import { NodePalette } from "./NodePalette";
import { StepPropertyPanel } from "./StepPropertyPanel";

// WorkflowStep interface matching our validation schema
export interface WorkflowStep {
  id?: string;
  order: number;
  title: string;
  actionType: ActionType;
  roleScope: Role;
  required?: boolean;
  actionConfig?: Record<string, unknown> | unknown[];
  dependsOn?: number[];
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  conditionType?: string;
  conditionConfig?: unknown;
  positionX?: number;
  positionY?: number;
}

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
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
  onChange,
  onValidate,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Initialize nodes and edges from steps
  const initialNodes = useMemo(() => stepsToNodes(steps), []);
  const initialEdges = useMemo(() => stepsToEdges(steps), []);

  // Internal state for visual positioning (ReactFlow needs this for dragging)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when steps change from parent (preserve node positions)
  useEffect(() => {
    const newNodes = stepsToNodes(steps);
    const newEdges = stepsToEdges(steps);
    
    // Preserve positions from current nodes
    const updatedNodes = newNodes.map(newNode => {
      const existingNode = nodes.find(n => n.id === newNode.id);
      if (existingNode) {
        return {
          ...newNode,
          position: existingNode.position, // Keep the visual position
        };
      }
      return newNode;
    });
    
    setNodes(updatedNodes);
    setEdges(newEdges);
  }, [steps, setNodes, setEdges]);

  // Validate current workflow
  const validation = useMemo(() => {
    const result = validateStepDependencies(steps);
    if (onValidate) {
      onValidate(result);
    }
    return result;
  }, [steps, onValidate]);

  // Handle new connections (dependencies)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;

      const sourceOrder = getStepOrderById(steps, connection.source!);
      const targetOrder = getStepOrderById(steps, connection.target!);

      if (sourceOrder === undefined || targetOrder === undefined) return;

      // Validate connection before creating
      const validationResult = isValidConnection(
        connection,
        steps,
        sourceOrder,
        targetOrder
      );

      if (!validationResult.valid) {
        // Show error in console for now (will add toast notification later)
        console.error(`Cannot create connection: ${validationResult.error}`);
        return;
      }

      // Add dependency
      const updatedSteps = steps.map((step) => {
        if (step.order === targetOrder) {
          return {
            ...step,
            dependsOn: [...(step.dependsOn || []), sourceOrder],
          };
        }
        return step;
      });

      onChange(updatedSteps);
    },
    [steps, onChange, readOnly]
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

      const stepOrder = getStepOrderById(steps, node.id);
      if (stepOrder === undefined) return;

      const updatedSteps = steps.map((step) => {
        if (step.order === stepOrder) {
          return {
            ...step,
            positionX: node.position.x,
            positionY: node.position.y,
          };
        }
        return step;
      });

      onChange(updatedSteps);
    },
    [steps, onChange, readOnly]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (readOnly) return;

      deletedEdges.forEach((edge) => {
        const sourceOrder = getStepOrderById(steps, edge.source);
        const targetOrder = getStepOrderById(steps, edge.target);

        if (sourceOrder === undefined || targetOrder === undefined) return;

        const updatedSteps = steps.map((step) => {
          if (step.order === targetOrder) {
            return {
              ...step,
              dependsOn: step.dependsOn?.filter((o) => o !== sourceOrder) || [],
            };
          }
          return step;
        });

        onChange(updatedSteps);
      });
    },
    [steps, onChange, readOnly]
  );

  // Get selected step
  const selectedStep = useMemo(() => {
    if (!selectedNodeId) return null;
    return steps.find((s) => (s.id || `step-${s.order}`) === selectedNodeId);
  }, [selectedNodeId, steps]);

  // Handle step property updates
  const handleStepUpdate = useCallback(
    (updatedStep: WorkflowStep) => {
      const updatedSteps = steps.map((step) =>
        step.order === updatedStep.order ? updatedStep : step
      );
      onChange(updatedSteps);
    },
    [steps, onChange]
  );

  // Handle step deletion
  const handleStepDelete = useCallback(
    (stepOrder: number) => {
      // Remove step
      const updatedSteps = steps.filter((s) => s.order !== stepOrder);

      // Remove dependencies pointing to deleted step
      updatedSteps.forEach((step) => {
        if (step.dependsOn?.includes(stepOrder)) {
          step.dependsOn = step.dependsOn.filter((o) => o !== stepOrder);
        }
      });

      // Recalculate orders
      const reordered = updatedSteps.map((step, index) => ({
        ...step,
        order: index,
      }));

      onChange(reordered);
      setSelectedNodeId(null);
    },
    [steps, onChange]
  );

  return (
    <div className="relative w-full h-[calc(100vh-320px)] min-h-[600px] border rounded-lg bg-gray-50">
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
          onUpdate={handleStepUpdate}
          onDelete={handleStepDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );

  // Helper: Add node from palette
  function handleAddNodeFromPalette(actionType: ActionType) {
    const newStep: WorkflowStep = {
      id: `temp-${Date.now()}`,
      title: `New ${actionType.replace(/_/g, " ")} Step`,
      actionType,
      roleScope: actionType.includes("CLIENT") ? Role.CLIENT : Role.LAWYER,
      required: true,
      actionConfig: {},
      order: steps.length,
      dependsOn: [],
      dependencyLogic: "ALL",
    };

    onChange([...steps, newStep]);
  }
}

// Helper: Convert steps to React Flow nodes
function stepsToNodes(steps: WorkflowStep[]): Node[] {
  const nodes = steps.map((step) => {
    const position = { 
      x: step.positionX ?? step.order * 300 + 50, // Use saved position or default
      y: step.positionY ?? 100 
    };

    return {
      id: step.id || `step-${step.order}`,
      type: "stepNode",
      position,
      data: {
        step,
        label: step.title,
        actionType: step.actionType,
        roleScope: step.roleScope,
        dependencyCount: step.dependsOn?.length || 0,
        dependencyLogic: step.dependencyLogic,
      },
    };
  });
  
  return nodes;
}

// Helper: Convert steps to React Flow edges
function stepsToEdges(steps: WorkflowStep[]): Edge[] {
  const edges: Edge[] = [];

  steps.forEach((step) => {
    step.dependsOn?.forEach((depOrder) => {
      const depStep = steps.find((s) => s.order === depOrder);
      if (depStep) {
        const sourceId = depStep.id || `step-${depStep.order}`;
        const targetId = step.id || `step-${step.order}`;

        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: "smoothstep",
          animated: false,
          style: { strokeWidth: 3 }, // Thicker arrows
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
    });
  });

  return edges;
}

// Helper: Get step order by node ID
function getStepOrderById(
  steps: WorkflowStep[],
  nodeId: string
): number | undefined {
  const step = steps.find((s) => (s.id || `step-${s.order}`) === nodeId);
  return step?.order;
}

// Helper: Validate connection before creating
function isValidConnection(
  connection: Connection,
  steps: WorkflowStep[],
  sourceOrder: number,
  targetOrder: number
): { valid: boolean; error?: string } {
  // No self-dependencies
  if (sourceOrder === targetOrder) {
    return { valid: false, error: "Step cannot depend on itself" };
  }

  // Check for cycles
  const testSteps = steps.map((step) => {
    if (step.order === targetOrder) {
      return {
        ...step,
        dependsOn: [...(step.dependsOn || []), sourceOrder],
      };
    }
    return step;
  });

  const validation = validateStepDependencies(testSteps);

  if (!validation.valid) {
    return { valid: false, error: validation.errors[0] };
  }

  return { valid: true };
}

// Helper: Validate step dependencies for cycles
function validateStepDependencies(
  steps: WorkflowStep[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for self-dependencies
  for (const step of steps) {
    if (step.dependsOn?.includes(step.order)) {
      errors.push(`Step "${step.title}" cannot depend on itself`);
    }
  }

  // Check for cycles using DFS
  const cycles = detectCyclesInSteps(steps);
  if (cycles.length > 0) {
    errors.push(...cycles);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Helper: Detect cycles in step dependencies
function detectCyclesInSteps(steps: WorkflowStep[]): string[] {
  const errors: string[] = [];
  const visited = new Set<number>();
  const recStack = new Set<number>();

  function dfs(order: number, path: number[]): boolean {
    if (recStack.has(order)) {
      // Cycle detected
      const cycleStart = path.indexOf(order);
      const cyclePath = path.slice(cycleStart).concat(order);
      const cycleStr = cyclePath
        .map((o) => `Step ${o + 1}`)
        .join(" → ");
      errors.push(`Circular dependency detected: ${cycleStr}`);
      return true;
    }

    if (visited.has(order)) {
      return false;
    }

    visited.add(order);
    recStack.add(order);

    const step = steps.find((s) => s.order === order);
    if (step?.dependsOn) {
      for (const depOrder of step.dependsOn) {
        if (dfs(depOrder, [...path, order])) {
          return true;
        }
      }
    }

    recStack.delete(order);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.order)) {
      dfs(step.order, []);
    }
  }

  return errors;
}
