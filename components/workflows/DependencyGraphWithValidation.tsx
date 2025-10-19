"use client";

import React, { useMemo } from "react";
import { DependencyGraph, WorkflowStepData } from "./DependencyGraph";
import { detectCycles, validateStepDependencies } from "@/lib/workflows/cycle-detection-client";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export interface DependencyGraphWithValidationProps {
  steps: WorkflowStepData[];
  onNodeClick?: (stepOrder: number) => void;
  highlightedStepOrders?: number[];
  className?: string;
  height?: number;
  showValidation?: boolean;
}

export function DependencyGraphWithValidation({
  steps,
  onNodeClick,
  highlightedStepOrders = [],
  className = "",
  height = 600,
  showValidation = true,
}: DependencyGraphWithValidationProps) {
  // Run cycle detection
  const cycleResult = useMemo(() => {
    return detectCycles(steps);
  }, [steps]);

  // Run full validation
  const validationErrors = useMemo(() => {
    return validateStepDependencies(steps);
  }, [steps]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSteps = steps.length;
    const stepsWithDeps = steps.filter(
      (s) => s.dependsOn && s.dependsOn.length > 0
    ).length;
    const totalDeps = steps.reduce(
      (sum, s) => sum + (s.dependsOn?.length || 0),
      0
    );
    const parallelSteps = new Set<number>();

    // Find steps that can run in parallel
    steps.forEach((step) => {
      if (step.dependsOn && step.dependsOn.length > 0) {
        steps.forEach((otherStep) => {
          if (
            step.order !== otherStep.order &&
            otherStep.dependsOn &&
            JSON.stringify(step.dependsOn) === JSON.stringify(otherStep.dependsOn)
          ) {
            parallelSteps.add(step.order);
            parallelSteps.add(otherStep.order);
          }
        });
      }
    });

    return {
      totalSteps,
      stepsWithDeps,
      totalDeps,
      parallelSteps: parallelSteps.size,
      avgDepsPerStep: stepsWithDeps > 0 ? (totalDeps / stepsWithDeps).toFixed(1) : "0",
    };
  }, [steps]);

  const hasErrors = validationErrors.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Validation Summary */}
      {showValidation && (
        <div className="space-y-2">
          {/* Overall Status */}
          {hasErrors ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-red-800 mb-1">
                  Validation Failed ({validationErrors.length}{" "}
                  {validationErrors.length === 1 ? "error" : "errors"})
                </div>
                <ul className="text-xs text-red-700 space-y-1">
                  {validationErrors.slice(0, 3).map((error, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>
                        {error.stepOrder !== undefined && (
                          <span className="font-medium">
                            Step {error.stepOrder}:{" "}
                          </span>
                        )}
                        {error.message}
                      </span>
                    </li>
                  ))}
                  {validationErrors.length > 3 && (
                    <li className="text-red-600 font-medium">
                      +{validationErrors.length - 3} more errors
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-300 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-800 font-medium">
                ✓ All dependencies valid
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-blue-900 font-semibold mb-1.5">
                Dependency Analysis
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-blue-600 font-medium">
                    {stats.totalSteps}
                  </div>
                  <div className="text-blue-700">Total Steps</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">
                    {stats.stepsWithDeps}
                  </div>
                  <div className="text-blue-700">With Dependencies</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">
                    {stats.parallelSteps}
                  </div>
                  <div className="text-blue-700">Parallel Steps</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">
                    {stats.avgDepsPerStep}
                  </div>
                  <div className="text-blue-700">Avg Deps/Step</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graph */}
      <DependencyGraph
        steps={steps}
        onNodeClick={onNodeClick}
        highlightedStepOrders={highlightedStepOrders}
        cycleEdges={cycleResult.cycles}
        height={height}
      />
    </div>
  );
}
