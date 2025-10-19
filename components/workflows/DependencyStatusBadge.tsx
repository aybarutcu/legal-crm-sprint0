"use client";

export type DependencyStatus =
  | "no-dependencies"
  | "waiting"
  | "partial"
  | "ready"
  | "completed"
  | "blocked";

interface DependencyStatusBadgeProps {
  /** Number of dependencies */
  totalDependencies: number;
  /** Number of completed dependencies */
  completedDependencies: number;
  /** Current step state */
  stepState: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "FAILED";
  /** Dependency logic (ALL or ANY) */
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  /** Optional: Names of dependencies still waiting */
  waitingFor?: string[];
  /** Optional: Show detailed tooltip */
  showDetails?: boolean;
}

/**
 * Badge component showing dependency status in workflow instance timeline
 * 
 * Features:
 * - Visual indicators for dependency progress
 * - Color-coded based on status
 * - Tooltip with details about waiting dependencies
 * - Progress indicator for partial completion
 */
export function DependencyStatusBadge({
  totalDependencies,
  completedDependencies,
  stepState,
  dependencyLogic = "ALL",
  waitingFor = [],
  showDetails = true,
}: DependencyStatusBadgeProps) {
  // Determine status
  const status: DependencyStatus = (() => {
    if (totalDependencies === 0) return "no-dependencies";
    if (stepState === "COMPLETED" || stepState === "SKIPPED") return "completed";
    if (completedDependencies === 0) return "waiting";
    if (completedDependencies === totalDependencies) return "ready";
    
    // Partial completion
    if (dependencyLogic === "ANY" && completedDependencies > 0) return "ready";
    return "partial";
  })();

  // Don't show badge if no dependencies
  if (status === "no-dependencies") return null;

  // Badge styling based on status
  const badgeStyles = {
    waiting: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      icon: "⏳",
      label: "Waiting",
    },
    partial: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      icon: "⏸",
      label: `${completedDependencies}/${totalDependencies}`,
    },
    ready: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: "✓",
      label: "Ready",
    },
    completed: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      icon: "✓",
      label: "Complete",
    },
    blocked: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: "⚠",
      label: "Blocked",
    },
  };

  const config = badgeStyles[status];

  return (
    <div className="group relative inline-flex">
      <div
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${config.bg} ${config.text} ${config.border}`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        {status === "partial" && dependencyLogic === "ANY" && (
          <span className="text-[10px] opacity-75">(ANY)</span>
        )}
      </div>

      {/* Tooltip with details */}
      {showDetails && (status === "waiting" || status === "partial") && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-10">
          <div className="text-xs space-y-2">
            <div className="font-semibold text-slate-900">
              {status === "waiting" && "Waiting for dependencies"}
              {status === "partial" && "Partially completed"}
            </div>
            
            <div className="space-y-1">
              <div className="text-slate-600">
                <strong>Progress:</strong> {completedDependencies} of {totalDependencies} complete
              </div>
              <div className="text-slate-600">
                <strong>Logic:</strong> {dependencyLogic}
                {dependencyLogic === "ALL" && " (all must complete)"}
                {dependencyLogic === "ANY" && " (any one can complete)"}
              </div>
            </div>

            {waitingFor.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-200">
                <div className="font-semibold text-slate-700">Waiting for:</div>
                <ul className="space-y-0.5 text-slate-600">
                  {waitingFor.slice(0, 3).map((dep, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span>•</span>
                      <span className="flex-1">{dep}</span>
                    </li>
                  ))}
                  {waitingFor.length > 3 && (
                    <li className="text-slate-500 italic">
                      +{waitingFor.length - 3} more...
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Progress Bar */}
            {totalDependencies > 0 && (
              <div className="pt-2">
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      completedDependencies === totalDependencies
                        ? "bg-emerald-500"
                        : completedDependencies > 0
                        ? "bg-yellow-500"
                        : "bg-slate-400"
                    }`}
                    style={{
                      width: `${(completedDependencies / totalDependencies) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version of the badge for use in small spaces
 */
export function DependencyStatusDot({
  totalDependencies,
  completedDependencies,
  stepState,
  dependencyLogic = "ALL",
}: Omit<DependencyStatusBadgeProps, "waitingFor" | "showDetails">) {
  if (totalDependencies === 0) return null;

  const isReady =
    completedDependencies === totalDependencies ||
    (dependencyLogic === "ANY" && completedDependencies > 0);

  const isCompleted = stepState === "COMPLETED" || stepState === "SKIPPED";

  const color = isCompleted
    ? "bg-blue-500"
    : isReady
    ? "bg-emerald-500"
    : completedDependencies > 0
    ? "bg-yellow-500"
    : "bg-slate-400";

  return (
    <div className="group relative inline-flex">
      <div
        className={`h-2.5 w-2.5 rounded-full ${color} ring-2 ring-white`}
        title={`${completedDependencies}/${totalDependencies} dependencies complete`}
      />
    </div>
  );
}
