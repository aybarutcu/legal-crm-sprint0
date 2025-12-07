"use client";

import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStepData {
  id: string;
  title: string;
  actionType: string;
  dependsOn?: string[];
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  required?: boolean;
}

export interface DependencyGraphProps {
  steps: WorkflowStepData[];
  onNodeClick?: (stepId: string) => void;
  highlightedStepIds?: string[];
  cycleEdges?: Array<{ from: string; to: string }>;
  className?: string;
  height?: number;
}

interface CustomNodeData {
  label: string;
  stepId: string;
  actionType: string;
  dependencyCount: number;
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  required?: boolean;
  isHighlighted?: boolean;
  isInCycle?: boolean;
}

// ============================================================================
// Custom Node Component
// ============================================================================

function CustomStepNode({ data }: { data: CustomNodeData }) {
  const {
    label,
    stepId,
    actionType,
    dependencyCount,
    dependencyLogic,
    required,
    isHighlighted,
    isInCycle,
  } = data;

  const borderColor = isInCycle
    ? "border-red-500"
    : isHighlighted
      ? "border-accent"
      : "border-slate-300";

  const bgColor = isInCycle
    ? "bg-red-50"
    : isHighlighted
      ? "bg-accent/10"
      : "bg-white";

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} ${bgColor} px-4 py-3 shadow-md min-w-[180px] max-w-[240px] transition-all hover:shadow-lg`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-bold">
            {stepId}
          </span>
          {!required && (
            <span className="text-[10px] text-slate-500 font-medium">
              (optional)
            </span>
          )}
        </div>
        {isInCycle && (
          <span className="text-xs text-red-600 font-semibold">⚠ CYCLE</span>
        )}
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-slate-800 mb-2 break-words">
        {label}
      </div>

      {/* Action Type Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
          {actionType}
        </span>
      </div>

      {/* Dependency Info */}
      {dependencyCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
          <span className="font-medium">
            {dependencyCount} {dependencyCount === 1 ? "dep" : "deps"}
          </span>
          {dependencyLogic && dependencyCount > 1 && (
            <>
              <span className="text-slate-400">•</span>
              <span
                className={`font-mono font-semibold ${
                  dependencyLogic === "ALL"
                    ? "text-blue-600"
                    : "text-purple-600"
                }`}
              >
                {dependencyLogic === "ALL" ? "&&" : "||"}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  customStep: CustomStepNode,
};

// ============================================================================
// Layout Algorithm (Dagre)
// ============================================================================

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// ============================================================================
// Main Component
// ============================================================================

export function DependencyGraph({
  steps,
  onNodeClick,
  highlightedStepIds = [],
  cycleEdges = [],
  className = "",
  height = 600,
}: DependencyGraphProps) {
  // Build cycle detection set
  const cycleEdgeSet = useMemo(() => {
    const set = new Set<string>();
    cycleEdges.forEach((edge) => {
      set.add(`${edge.from}-${edge.to}`);
    });
    return set;
  }, [cycleEdges]);

  const stepsInCycles = useMemo(() => {
    const set = new Set<string>();
    cycleEdges.forEach((edge) => {
      set.add(edge.from);
      set.add(edge.to);
    });
    return set;
  }, [cycleEdges]);

  // Convert steps to React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node<CustomNodeData>[] = steps.map((step) => {
      const isHighlighted = highlightedStepIds.includes(step.id);
      const isInCycle = stepsInCycles.has(step.id);

      return {
        id: `step-${step.id}`,
        type: "customStep",
        position: { x: 0, y: 0 }, // Will be set by layout algorithm
        data: {
          label: step.title || `Step ${step.id}`,
          stepId: step.id,
          actionType: step.actionType,
          dependencyCount: step.dependsOn?.length || 0,
          dependencyLogic: step.dependencyLogic,
          required: step.required ?? true,
          isHighlighted,
          isInCycle,
        },
      };
    });

    const edges: Edge[] = [];
    steps.forEach((step) => {
      if (step.dependsOn && step.dependsOn.length > 0) {
        step.dependsOn.forEach((depId) => {
          const isCycleEdge = cycleEdgeSet.has(`${depId}-${step.id}`);

          edges.push({
            id: `e-${depId}-${step.id}`,
            source: `step-${depId}`,
            target: `step-${step.id}`,
            type: isCycleEdge ? "default" : "smoothstep",
            animated: isCycleEdge,
            style: {
              stroke: isCycleEdge ? "#ef4444" : "#64748b",
              strokeWidth: isCycleEdge ? 3 : 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isCycleEdge ? "#ef4444" : "#64748b",
              width: 20,
              height: 20,
            },
            label: isCycleEdge ? "⚠ CYCLE" : undefined,
            labelStyle: isCycleEdge
              ? {
                  fill: "#ef4444",
                  fontWeight: 700,
                  fontSize: 12,
                }
              : undefined,
            labelBgStyle: isCycleEdge
              ? { fill: "#fee2e2", fillOpacity: 0.9 }
              : undefined,
          });
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [steps, highlightedStepIds, cycleEdgeSet, stepsInCycles]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when props change
  React.useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const stepId = (node.data as CustomNodeData).stepId;
      onNodeClick?.(stepId);
    },
    [onNodeClick]
  );

  const hasCycles = cycleEdges.length > 0;

  return (
    <div className={`relative ${className}`} style={{ height: `${height}px` }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
      >
        <Background color="#e2e8f0" gap={16} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as CustomNodeData;
            if (data.isInCycle) return "#ef4444";
            if (data.isHighlighted) return "#8b5cf6";
            return "#cbd5e1";
          }}
          maskColor="rgba(255, 255, 255, 0.6)"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
          }}
        />
        {hasCycles && (
          <Panel position="top-center">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-red-700">
                <span className="text-lg">⚠️</span>
                <span className="font-semibold text-sm">
                  Circular Dependencies Detected
                </span>
              </div>
              <p className="text-xs text-red-600 mt-1">
                Red animated edges indicate cycles. Fix these before saving.
              </p>
            </div>
          </Panel>
        )}
        <Panel position="bottom-right">
          <div className="bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-md text-xs space-y-1.5">
            <div className="font-semibold text-slate-700 mb-2">Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <span className="text-slate-600">Step Number</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 bg-slate-500"></div>
              <span className="text-slate-600">Dependency</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 bg-red-500"></div>
              <span className="text-slate-600">Cycle</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-blue-600">
                &&
              </span>
              <span className="text-slate-600">ALL logic</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-purple-600">
                ||
              </span>
              <span className="text-slate-600">ANY logic</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ============================================================================
// Compact Preview Version (for small spaces)
// ============================================================================

export function DependencyGraphPreview({
  steps,
  className = "",
  height = 300,
}: {
  steps: WorkflowStepData[];
  className?: string;
  height?: number;
}) {
  return (
    <div className={`${className} border border-slate-300 rounded-lg overflow-hidden`}>
      <DependencyGraph steps={steps} height={height} />
    </div>
  );
}
