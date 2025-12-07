import { useState, useCallback } from "react";
import { Node, Edge, MarkerType } from "reactflow";
import { WorkflowStep } from "../WorkflowCanvas";

export function useCanvasState(initialSteps: WorkflowStep[]) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);

  // Convert steps to nodes
  const stepsToNodes = useCallback((steps: WorkflowStep[]): Node[] => {
    return steps.map((step, index) => ({
      id: step.id || `step-${index}`,
      type: "stepNode",
      position: { x: 250, y: index * 150 + 50 },
      data: {
        step,
        label: step.title,
        actionType: step.actionType,
        roleScope: step.roleScope,
        dependencyCount: step.dependsOn?.length || 0,
        dependencyLogic: step.dependencyLogic,
      },
    }));
  }, []);

  // Convert steps to edges
  const stepsToEdges = useCallback((steps: WorkflowStep[]): Edge[] => {
    const edges: Edge[] = [];

    steps.forEach((step, index) => {
      step.dependsOn?.forEach((depOrder: number) => {
        const depStep = steps[depOrder];
        if (depStep) {
          const sourceId = depStep.id || `step-${depOrder}`;
          const targetId = step.id || `step-${index}`;

          edges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        }
      });
    });

    return edges;
  }, []);

  // Update steps and recalculate nodes/edges
  const updateSteps = useCallback((newSteps: WorkflowStep[]) => {
    // Clean up orphaned dependencies before updating
    const cleanedSteps = newSteps.map(step => ({
      ...step,
      dependsOn: step.dependsOn?.filter((depOrder: number) => depOrder < newSteps.length) ?? [],
    }));
    
    setSteps(cleanedSteps);
  }, []);

  return {
    steps,
    updateSteps,
    stepsToNodes,
    stepsToEdges,
  };
}
