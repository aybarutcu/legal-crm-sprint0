"use client";

import React, { useState, useEffect } from "react";
import { ActionType, Role } from "@prisma/client";
import { WorkflowStep } from "./WorkflowCanvas";
import { ActionConfigForm } from "./config-forms";
import { X } from "lucide-react";

interface StepPropertyPanelProps {
  step: WorkflowStep;
  onUpdate: (step: WorkflowStep) => void;
  onDelete: (stepOrder: number) => void;
  onClose: () => void;
}

export function StepPropertyPanel({
  step,
  onUpdate,
  onDelete,
  onClose,
}: StepPropertyPanelProps) {
  const [editedStep, setEditedStep] = useState<WorkflowStep>(step);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync editedStep when step prop changes (when clicking different nodes)
  useEffect(() => {
    setEditedStep(step);
    setHasChanges(false);
  }, [step]);

  const handleFieldChange = (field: keyof WorkflowStep, value: unknown) => {
    setEditedStep((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdate(editedStep);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setEditedStep(step);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${step.title}"?`)) {
      onDelete(step.order);
    }
  };

  return (
    <div className="absolute top-0 right-0 z-20 w-96 h-full bg-white shadow-2xl border-l-2 border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">{step.title || "Edit Step"}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">
            Basic Information
          </h4>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Step Title *
            </label>
            <input
              type="text"
              value={editedStep.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter step title"
            />
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Type *
            </label>
            <select
              value={editedStep.actionType}
              onChange={(e) =>
                handleFieldChange("actionType", e.target.value as ActionType)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TASK">Task</option>
              <option value="CHECKLIST">Checklist</option>
              <option value="APPROVAL_LAWYER">Approval (Lawyer)</option>
              <option value="SIGNATURE_CLIENT">Signature (Client)</option>
              <option value="REQUEST_DOC">Request Document</option>
              <option value="PAYMENT_CLIENT">Payment</option>
              <option value="WRITE_TEXT">Write Text</option>
              <option value="POPULATE_QUESTIONNAIRE">Questionnaire</option>
            </select>
          </div>

          {/* Role Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned To *
            </label>
            <select
              value={editedStep.roleScope}
              onChange={(e) =>
                handleFieldChange("roleScope", e.target.value as Role)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ADMIN">Admin</option>
              <option value="LAWYER">Lawyer</option>
              <option value="PARALEGAL">Paralegal</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>

          {/* Required */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="required"
              checked={editedStep.required ?? true}
              onChange={(e) => handleFieldChange("required", e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="required" className="ml-2 text-sm text-gray-700">
              Required Step
            </label>
          </div>
        </div>

        {/* Dependencies Section */}
        {step.dependsOn && step.dependsOn.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">
              Dependencies
            </h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-600">
                This step depends on {step.dependsOn.length} step
                {step.dependsOn.length > 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-2">
                {step.dependsOn.map((depOrder) => (
                  <span
                    key={depOrder}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-300"
                  >
                    Step {depOrder + 1}
                  </span>
                ))}
              </div>
              {step.dependsOn.length > 1 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dependency Logic
                  </label>
                  <select
                    value={editedStep.dependencyLogic || "ALL"}
                    onChange={(e) =>
                      handleFieldChange(
                        "dependencyLogic",
                        e.target.value as "ALL" | "ANY"
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="ALL">ALL (wait for all dependencies)</option>
                    <option value="ANY">ANY (wait for any dependency)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">
            Action Configuration
          </h4>
          <ActionConfigForm
            actionType={editedStep.actionType as ActionType}
            config={(editedStep.actionConfig as Record<string, unknown>) || {}}
            onChange={(newConfig) => {
              handleFieldChange("actionConfig", newConfig);
            }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2">
        <button
          onClick={handleDelete}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
        >
          Delete Step
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
