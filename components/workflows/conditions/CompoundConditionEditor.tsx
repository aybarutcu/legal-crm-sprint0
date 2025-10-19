"use client";

import { SimpleConditionEditor } from "./SimpleConditionEditor";
import {
  type CompoundCondition,
  type SimpleCondition,
  type ConditionConfig,
  isCompoundCondition,
  isSimpleCondition,
} from "./types";

interface CompoundConditionEditorProps {
  condition: CompoundCondition;
  onChange: (condition: CompoundCondition) => void;
  onRemove?: () => void;
  depth?: number;
}

export function CompoundConditionEditor({
  condition,
  onChange,
  onRemove,
  depth = 0,
}: CompoundConditionEditorProps) {
  const maxDepth = 3; // Prevent excessive nesting
  const canNest = depth < maxDepth;

  const addSimpleCondition = () => {
    onChange({
      ...condition,
      conditions: [
        ...condition.conditions,
        { field: "", operator: "==", value: "" } as SimpleCondition,
      ],
    });
  };

  const addCompoundCondition = () => {
    if (!canNest) return;
    
    onChange({
      ...condition,
      conditions: [
        ...condition.conditions,
        {
          operator: "AND",
          conditions: [
            { field: "", operator: "==", value: "" },
            { field: "", operator: "==", value: "" },
          ],
        } as CompoundCondition,
      ],
    });
  };

  const removeCondition = (index: number) => {
    // Must keep at least 2 sub-conditions
    if (condition.conditions.length <= 2) return;
    
    onChange({
      ...condition,
      conditions: condition.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, updated: ConditionConfig) => {
    onChange({
      ...condition,
      conditions: condition.conditions.map((c, i) => (i === index ? updated : c)),
    });
  };

  return (
    <div
      className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-4"
      style={{ marginLeft: depth > 0 ? "1rem" : "0" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-700">
            {depth > 0 ? "Nested " : ""}Compound Condition
          </span>
          <select
            value={condition.operator}
            onChange={(e) =>
              onChange({
                ...condition,
                operator: e.target.value as "AND" | "OR",
              })
            }
            className="rounded-md border-2 border-blue-300 bg-white px-2 py-1 text-xs font-bold text-blue-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="AND">AND (all must match)</option>
            <option value="OR">OR (any can match)</option>
          </select>
        </div>
        
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            × Remove Group
          </button>
        )}
      </div>

      {/* Sub-conditions */}
      <div className="space-y-3">
        {condition.conditions.map((subCondition, index) => (
          <div key={index}>
            {isSimpleCondition(subCondition) ? (
              <SimpleConditionEditor
                condition={subCondition}
                onChange={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                showRemove={condition.conditions.length > 2}
              />
            ) : isCompoundCondition(subCondition) ? (
              <CompoundConditionEditor
                condition={subCondition}
                onChange={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                depth={depth + 1}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Add Buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-blue-200">
        <button
          type="button"
          onClick={addSimpleCondition}
          className="flex-1 rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >
          + Add Condition
        </button>
        {canNest && (
          <button
            type="button"
            onClick={addCompoundCondition}
            className="flex-1 rounded-lg border-2 border-blue-300 bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-200 hover:border-blue-400 transition-colors"
          >
            + Add AND/OR Group
          </button>
        )}
      </div>

      {/* Depth Warning */}
      {!canNest && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
          ⚠️ Maximum nesting depth reached (3 levels)
        </div>
      )}
    </div>
  );
}
