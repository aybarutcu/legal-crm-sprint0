"use client";

import { useState } from "react";
import { SimpleConditionEditor } from "./SimpleConditionEditor";
import { CompoundConditionEditor } from "./CompoundConditionEditor";
import {
  type ConditionConfig,
  type ConditionType,
  type SimpleCondition,
  type CompoundCondition,
  isCompoundCondition,
} from "./types";

interface ConditionBuilderProps {
  conditionType: ConditionType;
  conditionConfig: ConditionConfig | null;
  onChange: (config: { conditionType: ConditionType; conditionConfig: ConditionConfig | null }) => void;
  nextStepOnTrue?: number | null;
  nextStepOnFalse?: number | null;
  onNextStepChange?: (nextStepOnTrue: number | null, nextStepOnFalse: number | null) => void;
  maxStepOrder?: number;
}

export function ConditionBuilder({
  conditionType,
  conditionConfig,
  onChange,
  nextStepOnTrue,
  nextStepOnFalse,
  onNextStepChange,
  maxStepOrder = 10,
}: ConditionBuilderProps) {
  const [conditionMode, setConditionMode] = useState<"simple" | "compound">(
    conditionConfig && isCompoundCondition(conditionConfig) ? "compound" : "simple"
  );

  const requiresCondition = conditionType === "IF_TRUE" || conditionType === "IF_FALSE";

  const handleConditionTypeChange = (newType: ConditionType) => {
    if (newType === "ALWAYS") {
      // ALWAYS doesn't need conditions
      onChange({ conditionType: newType, conditionConfig: null });
    } else if (newType === "IF_TRUE" || newType === "IF_FALSE") {
      // Create default condition if none exists
      if (!conditionConfig) {
        const defaultCondition: SimpleCondition = {
          field: "",
          operator: "==",
          value: "",
        };
        onChange({ conditionType: newType, conditionConfig: defaultCondition });
      } else {
        onChange({ conditionType: newType, conditionConfig });
      }
    } else {
      onChange({ conditionType: newType, conditionConfig });
    }
  };

  const handleConditionConfigChange = (newConfig: ConditionConfig) => {
    onChange({ conditionType, conditionConfig: newConfig });
  };

  const switchToCompound = () => {
    const defaultCompound: CompoundCondition = {
      operator: "AND",
      conditions: [
        { field: "", operator: "==", value: "" },
        { field: "", operator: "==", value: "" },
      ],
    };
    setConditionMode("compound");
    handleConditionConfigChange(defaultCompound);
  };

  const switchToSimple = () => {
    const defaultSimple: SimpleCondition = {
      field: "",
      operator: "==",
      value: "",
    };
    setConditionMode("simple");
    handleConditionConfigChange(defaultSimple);
  };

  return (
    <div className="space-y-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Conditional Logic</h4>
        <span className="text-xs text-slate-500">Configure when this step should execute</span>
      </div>

      {/* Condition Type Selector */}
      <div>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-700">Execution Condition</span>
          <select
            value={conditionType}
            onChange={(e) => handleConditionTypeChange(e.target.value as ConditionType)}
            className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
          >
            <option value="ALWAYS">Always Execute (Default)</option>
            <option value="IF_TRUE">Execute if Condition is True</option>
            <option value="IF_FALSE">Execute if Condition is False</option>
            <option value="SWITCH" disabled>
              Switch/Case (Coming Soon)
            </option>
          </select>
        </label>

        {/* Condition Type Description */}
        <div className="mt-2 text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">
          {conditionType === "ALWAYS" && (
            <>
              <strong>Always Execute:</strong> This step will execute in sequential order, regardless of
              any conditions.
            </>
          )}
          {conditionType === "IF_TRUE" && (
            <>
              <strong>Conditional Execution:</strong> This step will only execute if the condition
              evaluates to TRUE. Otherwise, it will be skipped.
            </>
          )}
          {conditionType === "IF_FALSE" && (
            <>
              <strong>Negative Conditional:</strong> This step will only execute if the condition
              evaluates to FALSE. Otherwise, it will be skipped.
            </>
          )}
        </div>
      </div>

      {/* Condition Configuration (only for IF_TRUE/IF_FALSE) */}
      {requiresCondition && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Condition Configuration</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={switchToSimple}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  conditionMode === "simple"
                    ? "bg-accent text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={switchToCompound}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  conditionMode === "compound"
                    ? "bg-accent text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                AND/OR
              </button>
            </div>
          </div>

          {conditionMode === "simple" && conditionConfig && !isCompoundCondition(conditionConfig) ? (
            <SimpleConditionEditor
              condition={conditionConfig}
              onChange={handleConditionConfigChange}
              showRemove={false}
            />
          ) : conditionMode === "compound" && conditionConfig && isCompoundCondition(conditionConfig) ? (
            <CompoundConditionEditor
              condition={conditionConfig}
              onChange={handleConditionConfigChange}
            />
          ) : null}
        </div>
      )}

      {/* Next Step Configuration (for branching) */}
      {requiresCondition && onNextStepChange && (
        <div className="space-y-3 pt-3 border-t border-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Branching</span>
            <span className="text-xs text-slate-500">(Optional - override default sequential flow)</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-emerald-700">
                ✓ If Condition TRUE → Go to Step:
              </span>
              <select
                value={nextStepOnTrue ?? ""}
                onChange={(e) =>
                  onNextStepChange(
                    e.target.value ? Number(e.target.value) : null,
                    nextStepOnFalse ?? null
                  )
                }
                className="rounded-lg border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Next Step (Default)</option>
                {Array.from({ length: maxStepOrder }, (_, i) => i + 1).map((step) => (
                  <option key={step} value={step}>
                    Step {step}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-red-700">
                ✗ If Condition FALSE → Go to Step:
              </span>
              <select
                value={nextStepOnFalse ?? ""}
                onChange={(e) =>
                  onNextStepChange(
                    nextStepOnTrue ?? null,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="rounded-lg border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="">Next Step (Default)</option>
                {Array.from({ length: maxStepOrder }, (_, i) => i + 1).map((step) => (
                  <option key={step} value={step}>
                    Step {step}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-xs text-slate-500 bg-white rounded px-2 py-1.5 border border-slate-200">
            💡 Leave empty to proceed to the next sequential step. Set custom targets to create
            branching workflows (e.g., skip steps based on conditions).
          </div>
        </div>
      )}
    </div>
  );
}
