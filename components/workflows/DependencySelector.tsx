"use client";

import { useState } from "react";

interface DependencySelectorProps {
  /** Current step ID (to prevent self-dependency) */
  currentStepId: string;
  /** All steps in the workflow */
  allSteps: Array<{ id: string; title: string }>;
  /** Currently selected dependencies (step IDs) */
  selectedDependencies: string[];
  /** Callback when dependencies change */
  onChange: (dependencies: string[]) => void;
  /** Optional: Disable the selector */
  disabled?: boolean;
}

/**
 * Multi-select component for choosing step dependencies
 *
 * Features:
 * - Shows available steps (excluding current step)
 * - Visual indicators for selected steps
 * - Prevents self-dependency
 * - Badge display for selected items
 */
export function DependencySelector({
  currentStepId,
  allSteps,
  selectedDependencies,
  onChange,
  disabled = false,
}: DependencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter out the current step to prevent self-dependency
  const availableSteps = allSteps.filter((step) => step.id !== currentStepId);

  const toggleDependency = (stepId: string) => {
    if (disabled) return;

    const isSelected = selectedDependencies.includes(stepId);
    if (isSelected) {
      onChange(selectedDependencies.filter((d) => d !== stepId));
    } else {
      onChange([...selectedDependencies, stepId]);
    }
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  // Get step titles for selected dependencies
  const selectedStepTitles = selectedDependencies
    .map((stepId) => {
      const step = allSteps.find((s) => s.id === stepId);
      return step ? { id: stepId, title: step.title } : null;
    })
    .filter((s): s is { id: string; title: string } => s !== null);

  if (availableSteps.length === 0) {
    return (
      <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
        No other steps available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full rounded-lg border-2 border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-600">
            {selectedDependencies.length === 0
              ? "Select dependencies..."
              : `${selectedDependencies.length} step${selectedDependencies.length > 1 ? "s" : ""} selected`}
          </span>
          <svg
            className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Selected Dependencies Badges */}
      {selectedStepTitles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedStepTitles.map(({ id, title }) => (
            <div
              key={id}
              className="flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
            >
              <span className="max-w-[200px] truncate">{title}</span>
              <button
                type="button"
                onClick={() => toggleDependency(id)}
                disabled={disabled}
                className="ml-1 rounded-sm hover:bg-accent/20 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
          {selectedDependencies.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border-2 border-slate-200 bg-white shadow-lg">
            <div className="p-2">
              <div className="mb-2 px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Select steps to depend on
              </div>
              {availableSteps.map((step) => {
                const isSelected = selectedDependencies.includes(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => toggleDependency(step.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-accent/10 text-accent font-medium border-2 border-accent/30"
                        : "hover:bg-slate-50 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Checkbox */}
                      <div
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-accent border-accent"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      
                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <span className="truncate">{step.title || "(Untitled)"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              
              {availableSteps.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-slate-500">
                  No other steps available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
