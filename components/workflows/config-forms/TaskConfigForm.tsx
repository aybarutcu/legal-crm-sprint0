"use client";

import { useState, useEffect } from "react";

interface TaskConfigFormProps {
  initialConfig: {
    description?: string;
    requiresEvidence?: boolean;
    estimatedMinutes?: number;
  };
  onChange: (config: {
    description?: string;
    requiresEvidence?: boolean;
    estimatedMinutes?: number;
  }) => void;
}

export function TaskConfigForm({ initialConfig, onChange }: TaskConfigFormProps) {
  const [description, setDescription] = useState(initialConfig.description || "");
  const [requiresEvidence, setRequiresEvidence] = useState(initialConfig.requiresEvidence || false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initialConfig.estimatedMinutes?.toString() || ""
  );

  useEffect(() => {
    onChange({
      description: description.trim() || undefined,
      requiresEvidence,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
    });
  }, [description, requiresEvidence, estimatedMinutes]); // Removed onChange from deps

  return (
    <div className="space-y-4">
      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Task Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          placeholder="Describe what needs to be done (e.g., 'Call client to confirm appointment time')"
        />
        <p className="mt-1 text-xs text-slate-500">
          Clear instructions for the person completing this task
        </p>
      </div>

      {/* Estimated Time */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Estimated Time (minutes)
        </label>
        <input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
          min="1"
          step="1"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="e.g., 15, 30, 60"
        />
        <p className="mt-1 text-xs text-slate-500">
          Optional: How long should this task take?
        </p>
      </div>

      {/* Requires Evidence */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="requiresEvidence"
          checked={requiresEvidence}
          onChange={(e) => setRequiresEvidence(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        />
        <div className="flex-1">
          <label htmlFor="requiresEvidence" className="text-xs font-medium text-slate-700 cursor-pointer">
            Require Evidence Documents
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            User must attach documents (receipts, filed papers, etc.) to complete this task
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs font-medium text-slate-700 mb-2">Preview:</p>
        <div className="rounded-lg bg-white border border-slate-200 p-3">
          {description ? (
            <p className="text-sm text-slate-700">{description}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">No description provided</p>
          )}
          {(estimatedMinutes || requiresEvidence) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {estimatedMinutes && (
                <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 border border-cyan-200">
                  ~{estimatedMinutes} min
                </span>
              )}
              {requiresEvidence && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                  Evidence Required
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
