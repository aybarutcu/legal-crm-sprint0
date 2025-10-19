"use client";

import { useState } from "react";
import {
  type SimpleCondition,
  type ConditionOperator,
  OPERATORS,
  WORKFLOW_CONTEXT_FIELDS,
} from "./types";

interface SimpleConditionEditorProps {
  condition: SimpleCondition;
  onChange: (condition: SimpleCondition) => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export function SimpleConditionEditor({
  condition,
  onChange,
  onRemove,
  showRemove = true,
}: SimpleConditionEditorProps) {
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);
  
  const selectedOperator = OPERATORS.find((op) => op.value === condition.operator);
  const requiresValue = selectedOperator?.requiresValue ?? true;
  
  // Filter field suggestions based on input
  const fieldSuggestions = WORKFLOW_CONTEXT_FIELDS.filter((field) =>
    field.field.toLowerCase().includes(condition.field.toLowerCase()) ||
    field.label.toLowerCase().includes(condition.field.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Condition</span>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            × Remove
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Field Path */}
        <div className="relative">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Field Path</span>
            <input
              type="text"
              value={condition.field}
              onChange={(e) => {
                onChange({ ...condition, field: e.target.value });
                setShowFieldSuggestions(true);
              }}
              onFocus={() => setShowFieldSuggestions(true)}
              onBlur={() => setTimeout(() => setShowFieldSuggestions(false), 200)}
              className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder="e.g., contactType"
            />
          </label>
          
          {/* Field Suggestions Dropdown */}
          {showFieldSuggestions && fieldSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border-2 border-slate-200 bg-white shadow-lg">
              {fieldSuggestions.map((field) => (
                <button
                  key={field.field}
                  type="button"
                  onClick={() => {
                    onChange({ ...condition, field: field.field });
                    setShowFieldSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-slate-900">{field.label}</div>
                  <div className="text-xs text-slate-500">{field.field}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{field.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Operator */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-700">Operator</span>
          <select
            value={condition.operator}
            onChange={(e) =>
              onChange({
                ...condition,
                operator: e.target.value as ConditionOperator,
                // Clear value if new operator doesn't require it
                value: OPERATORS.find(op => op.value === e.target.value)?.requiresValue 
                  ? condition.value 
                  : undefined
              })
            }
            className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
          >
            <optgroup label="Comparison">
              {OPERATORS.filter(op => op.category === "comparison").map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="String">
              {OPERATORS.filter(op => op.category === "string").map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Array">
              {OPERATORS.filter(op => op.category === "array").map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Existence">
              {OPERATORS.filter(op => op.category === "existence").map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {/* Value (conditional on operator) */}
        {requiresValue && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Value</span>
            <input
              type="text"
              value={typeof condition.value === "string" ? condition.value : JSON.stringify(condition.value ?? "")}
              onChange={(e) => {
                let value: unknown = e.target.value;
                
                // Try to parse as JSON for arrays/objects
                if (condition.operator === "in" || condition.operator === "notIn") {
                  try {
                    value = JSON.parse(e.target.value);
                  } catch {
                    value = e.target.value;
                  }
                } else if (e.target.value === "true" || e.target.value === "false") {
                  value = e.target.value === "true";
                } else if (!isNaN(Number(e.target.value)) && e.target.value !== "") {
                  value = Number(e.target.value);
                }
                
                onChange({ ...condition, value });
              }}
              className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder={
                condition.operator === "in" || condition.operator === "notIn"
                  ? '["value1", "value2"]'
                  : "Enter value..."
              }
            />
          </label>
        )}
      </div>

      {/* Operator Description */}
      {selectedOperator && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5">
          💡 {selectedOperator.description}
        </div>
      )}
    </div>
  );
}
