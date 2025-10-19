"use client";

import {
  type ConditionConfig,
  type ConditionType,
  type SimpleCondition,
  type CompoundCondition,
  isCompoundCondition,
  OPERATORS,
} from "./types";

interface ConditionDisplayProps {
  conditionType: ConditionType;
  conditionConfig: ConditionConfig | null;
  compact?: boolean;
}

export function ConditionDisplay({
  conditionType,
  conditionConfig,
  compact = false,
}: ConditionDisplayProps) {
  if (conditionType === "ALWAYS") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-md ${
          compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        } bg-slate-100 text-slate-600 font-medium`}
      >
        <span>⚙️</span>
        <span>Always</span>
      </div>
    );
  }

  if (!conditionConfig) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-md ${
          compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        } bg-amber-100 text-amber-700 font-medium`}
      >
        <span>⚠️</span>
        <span>No condition set</span>
      </div>
    );
  }

  const icon = conditionType === "IF_TRUE" ? "✓" : "✗";
  const bgColor = conditionType === "IF_TRUE" ? "bg-emerald-100" : "bg-red-100";
  const textColor = conditionType === "IF_TRUE" ? "text-emerald-700" : "text-red-700";

  return (
    <div
      className={`inline-flex items-start gap-2 rounded-lg ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
      } ${bgColor} ${textColor} font-medium`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="font-semibold mb-0.5">
          {conditionType === "IF_TRUE" ? "If TRUE:" : "If FALSE:"}
        </div>
        <ConditionSummary condition={conditionConfig} compact={compact} />
      </div>
    </div>
  );
}

function ConditionSummary({
  condition,
  compact,
}: {
  condition: ConditionConfig;
  compact: boolean;
}) {
  if (isCompoundCondition(condition)) {
    return <CompoundConditionSummary condition={condition} compact={compact} />;
  }

  return <SimpleConditionSummary condition={condition} compact={compact} />;
}

function SimpleConditionSummary({
  condition,
  compact,
}: {
  condition: SimpleCondition;
  compact: boolean;
}) {
  const operator = OPERATORS.find((op) => op.value === condition.operator);
  const operatorLabel = operator?.label ?? condition.operator;

  let valueDisplay = "";
  if (operator?.requiresValue) {
    if (Array.isArray(condition.value)) {
      valueDisplay = `[${condition.value.join(", ")}]`;
    } else if (typeof condition.value === "string") {
      valueDisplay = `"${condition.value}"`;
    } else {
      valueDisplay = String(condition.value);
    }
  }

  return (
    <code
      className={`${
        compact ? "text-xs" : "text-sm"
      } bg-white/50 rounded px-1.5 py-0.5 font-mono`}
    >
      {condition.field}{" "}
      <span className="font-bold">{operatorLabel}</span>
      {valueDisplay && ` ${valueDisplay}`}
    </code>
  );
}

function CompoundConditionSummary({
  condition,
  compact,
}: {
  condition: CompoundCondition;
  compact: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="font-bold text-xs opacity-75">
        {condition.operator === "AND" ? "All of:" : "Any of:"}
      </div>
      <div className="space-y-0.5 pl-2 border-l-2 border-current/20">
        {condition.conditions.map((subCondition, index) => (
          <div key={index}>
            <ConditionSummary condition={subCondition} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ConditionBadgeProps {
  conditionType: ConditionType;
  size?: "sm" | "md";
}

export function ConditionBadge({ conditionType, size = "sm" }: ConditionBadgeProps) {
  if (conditionType === "ALWAYS") {
    return null; // Don't show badge for default behavior
  }

  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";
  
  if (conditionType === "IF_TRUE") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded ${sizeClasses} bg-emerald-100 text-emerald-700 font-semibold`}
      >
        <span>✓</span>
        <span>Conditional</span>
      </span>
    );
  }

  if (conditionType === "IF_FALSE") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded ${sizeClasses} bg-red-100 text-red-700 font-semibold`}
      >
        <span>✗</span>
        <span>Negative</span>
      </span>
    );
  }

  return null;
}
