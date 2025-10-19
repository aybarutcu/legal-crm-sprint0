"use client";

export type DependencyLogic = "ALL" | "ANY" | "CUSTOM";

interface DependencyLogicSelectorProps {
  /** Current selected logic */
  value: DependencyLogic;
  /** Callback when logic changes */
  onChange: (logic: DependencyLogic) => void;
  /** Number of dependencies (to show/hide the selector) */
  dependencyCount: number;
  /** Optional: Disable the selector */
  disabled?: boolean;
}

/**
 * Radio/select component for choosing dependency evaluation logic
 * 
 * Features:
 * - ALL: All dependencies must be complete
 * - ANY: At least one dependency must be complete
 * - CUSTOM: Custom evaluation logic (not yet implemented)
 * - Shows explanatory tooltips
 * - Auto-hides when < 2 dependencies
 */
export function DependencyLogicSelector({
  value,
  onChange,
  dependencyCount,
  disabled = false,
}: DependencyLogicSelectorProps) {
  // Only show when there are 2+ dependencies
  if (dependencyCount < 2) {
    return null;
  }

  const options: Array<{
    value: DependencyLogic;
    label: string;
    description: string;
    icon: string;
    disabled?: boolean;
  }> = [
    {
      value: "ALL",
      label: "ALL (Default)",
      description: "This step becomes ready only when ALL dependencies are complete",
      icon: "&&",
    },
    {
      value: "ANY",
      label: "ANY (First-Wins)",
      description: "This step becomes ready when ANY dependency is complete",
      icon: "||",
    },
    {
      value: "CUSTOM",
      label: "CUSTOM (Advanced)",
      description: "Custom evaluation logic (not yet implemented)",
      icon: "{ }",
      disabled: true,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-700">
          Dependency Logic
        </label>
        <div className="group relative">
          <svg
            className="h-4 w-4 text-slate-400 cursor-help"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-10">
            <p className="text-xs text-slate-600">
              Controls how multiple dependencies are evaluated. Use <strong>ALL</strong> for fork-join
              patterns where all parallel tasks must complete. Use <strong>ANY</strong> for
              first-wins scenarios.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          const isDisabled = disabled || option.disabled;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
                isSelected
                  ? "border-accent bg-accent/5"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start gap-3">
                {/* Radio Circle */}
                <div
                  className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "border-accent"
                      : "border-slate-300"
                  }`}
                >
                  {isSelected && (
                    <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-accent/20 text-accent" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {option.icon}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? "text-accent" : "text-slate-900"
                      }`}
                    >
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual Example */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">
          Example with {dependencyCount} dependencies:
        </div>
        <div className="space-y-1 text-xs text-slate-600">
          {value === "ALL" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-red-500">✗</span>
                <span>Step 1: ✓ Complete, Step 2: ⏳ In Progress → <strong>NOT READY</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Step 1: ✓ Complete, Step 2: ✓ Complete → <strong>READY</strong></span>
              </div>
            </>
          )}
          {value === "ANY" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Step 1: ✓ Complete, Step 2: ⏳ In Progress → <strong>READY</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Step 1: ⏳ In Progress, Step 2: ✓ Complete → <strong>READY</strong></span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
