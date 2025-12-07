"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Role } from "@prisma/client";
import { WorkflowStep, WorkflowDependency } from "./WorkflowCanvas";
import { ActionConfigForm } from "./config-forms";
import type { ActionType } from "./config-forms/ActionConfigForm";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import type {
  NotificationPolicy,
  NotificationChannel,
  NotificationTrigger,
  NotificationSendStrategy,
} from "@/lib/workflows/notification-policy";

const CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "PUSH"];
const TRIGGERS: NotificationTrigger[] = ["ON_READY", "ON_COMPLETED", "ON_FAILED"];
const SEND_STRATEGIES: NotificationSendStrategy[] = ["IMMEDIATE", "DELAYED"];

const defaultNotificationPolicy: NotificationPolicy = {
  channel: "EMAIL",
  triggers: ["ON_READY"],
  recipients: ["{{step.assignedTo.email}}"],
  cc: [],
  sendStrategy: "IMMEDIATE",
};

interface StepPropertyPanelProps {
  step: WorkflowStep;
  allSteps: WorkflowStep[];
  dependencies?: WorkflowDependency[];
  onUpdate: (step: WorkflowStep) => void;
  onUpdateDependencies?: (dependencies: WorkflowDependency[]) => void;
  onDelete: (stepId: string) => void;
  onClose: () => void;
}

export const StepPropertyPanel = React.memo(function StepPropertyPanel({
  step,
  allSteps,
  dependencies = [],
  onUpdate,
  onUpdateDependencies,
  onDelete,
  onClose,
}: StepPropertyPanelProps) {
  const [editedStep, setEditedStep] = useState<WorkflowStep>(step);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    dependencies: true,
    actionConfig: true,
    notifications: false,
  });

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
      onDelete(step.id);
    }
  };

  const notificationPolicies = useMemo(() => editedStep.notificationPolicies ?? [], [editedStep.notificationPolicies]);

  const updatePolicies = (policies: NotificationPolicy[]) => {
    handleFieldChange("notificationPolicies", policies);
  };

  const handleAddNotificationPolicy = () => {
    updatePolicies([...notificationPolicies, { ...defaultNotificationPolicy }]);
  };

  const handleRemoveNotificationPolicy = (index: number) => {
    const next = notificationPolicies.filter((_, idx) => idx !== index);
    updatePolicies(next);
  };

  const handlePolicyChange = (
    index: number,
    patch: Partial<NotificationPolicy>,
  ) => {
    let updatedPatch = patch;
    if (patch.sendStrategy === "IMMEDIATE") {
      updatedPatch = { ...patch, delayMinutes: null };
    }
    const next = notificationPolicies.map((policy, idx) =>
      idx === index ? { ...policy, ...updatedPatch } : policy,
    );
    updatePolicies(next);
  };

  const handleRecipientChange = (
    index: number,
    value: string,
    field: "recipients" | "cc",
  ) => {
    const list = value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    handlePolicyChange(index, { [field]: list } as Partial<NotificationPolicy>);
  };

  const toggleTrigger = (index: number, trigger: NotificationTrigger) => {
    const current = notificationPolicies[index]?.triggers ?? [];
    const exists = current.includes(trigger);
    const nextTriggers = exists
      ? current.filter((t) => t !== trigger)
      : [...current, trigger];
    handlePolicyChange(index, { triggers: nextTriggers.length ? nextTriggers : [trigger] });
  };

  const dependencySummaries = useMemo(() => dependencies
    .filter(dep => dep.targetStepId === step.id)
    .map((dep) => {
      const sourceStep = allSteps.find((candidate) => candidate.id === dep.sourceStepId);
      return {
        id: dep.id,
        title: sourceStep ? sourceStep.title : dep.sourceStepId,
        logic: dep.dependencyLogic,
      };
    }), [dependencies, step.id, allSteps]);

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
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, basicInfo: !prev.basicInfo }))}
            className="w-full flex items-center justify-between font-semibold text-sm text-gray-700 border-b pb-2 hover:text-gray-900 transition-colors"
          >
            <span>Basic Information</span>
            {expandedSections.basicInfo ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {expandedSections.basicInfo && (
            <>

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
              <option value="APPROVAL">Approval</option>
              <option value="SIGNATURE">Signature</option>
              <option value="REQUEST_DOC">Request Document</option>
              <option value="PAYMENT">Payment</option>
              <option value="WRITE_TEXT">Write Text</option>
              <option value="POPULATE_QUESTIONNAIRE">Questionnaire</option>
              <option value="AUTOMATION_EMAIL">Automation · Email</option>
              <option value="AUTOMATION_WEBHOOK">Automation · Webhook</option>
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
            </>
          )}
        </div>

        {/* Dependencies Section */}
        {dependencySummaries.length > 0 && (
          <div className="space-y-4">
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, dependencies: !prev.dependencies }))}
              className="w-full flex items-center justify-between font-semibold text-sm text-gray-700 border-b pb-2 hover:text-gray-900 transition-colors"
            >
              <span>Dependencies</span>
              {expandedSections.dependencies ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {expandedSections.dependencies && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-600">
                This step depends on {dependencySummaries.length} step
                {dependencySummaries.length > 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-2">
                {dependencySummaries.map((dep) => (
                  <span
                    key={dep.id}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-300"
                  >
                    {dep.title}
                  </span>
                ))}
              </div>
              {dependencySummaries.length > 1 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dependency Logic
                  </label>
                  <select
                    value={dependencySummaries[0]?.logic || "ALL"}
                    onChange={(e) => {
                      if (onUpdateDependencies) {
                        const newLogic = e.target.value as "ALL" | "ANY" | "CUSTOM";
                        const updatedDependencies = dependencies.map(dep =>
                          dep.targetStepId === step.id
                            ? { ...dep, dependencyLogic: newLogic }
                            : dep
                        );
                        onUpdateDependencies(updatedDependencies);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="ALL">ALL (wait for all dependencies)</option>
                    <option value="ANY">ANY (wait for any dependency)</option>
                  </select>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Action Configuration */}
        <div className="space-y-4">
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, actionConfig: !prev.actionConfig }))}
            className="w-full flex items-center justify-between font-semibold text-sm text-gray-700 border-b pb-2 hover:text-gray-900 transition-colors"
          >
            <span>Action Configuration</span>
            {expandedSections.actionConfig ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {expandedSections.actionConfig && (
            <ActionConfigForm
              actionType={editedStep.actionType as import("./config-forms/ActionConfigForm").ActionType}
              config={(editedStep.actionConfig as Record<string, unknown>) || {}}
              onChange={(newConfig) => {
                handleFieldChange("actionConfig", newConfig);
              }}
            />
          )}
        </div>

        {/* Notification Policies */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-700 border-b pb-2 flex-1">
              Notification Policies
            </h4>
            <button
              type="button"
              onClick={handleAddNotificationPolicy}
              className="ml-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              + Add Notification
            </button>
          </div>
          {notificationPolicies.length === 0 ? (
            <p className="text-xs text-slate-500">
              No notifications configured. Add a policy to automatically notify stakeholders when this step changes.
            </p>
          ) : (
            <div className="space-y-4">
              {notificationPolicies.map((policy, index) => (
                <div key={index} className="rounded-xl border-2 border-slate-200 bg-white p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">
                      Notification #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNotificationPolicy(index)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Channel
                    </label>
                    <select
                      value={policy.channel}
                      onChange={(e) =>
                        handlePolicyChange(index, { channel: e.target.value as NotificationChannel })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      {CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel === "EMAIL" ? "Email" : channel === "SMS" ? "SMS" : "In-App Push"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Triggers */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Triggers</p>
                    <div className="flex flex-wrap gap-3">
                      {TRIGGERS.map((trigger) => {
                        const isChecked = policy.triggers?.includes(trigger);
                        return (
                          <label key={trigger} className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTrigger(index, trigger)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            {trigger.replace("ON_", "On ").replace("_", " ")}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recipients */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Recipients
                    </label>
                    <textarea
                      value={(policy.recipients ?? []).join(", ")}
                      onChange={(e) => handleRecipientChange(index, e.target.value, "recipients")}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="user@example.com, {{contact.email}}"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Use commas or new lines to separate recipients. Template tokens supported.</p>
                  </div>

                  {/* CC (email only) */}
                  {policy.channel === "EMAIL" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        CC (optional)
                      </label>
                      <textarea
                        value={(policy.cc ?? []).join(", ")}
                        onChange={(e) => handleRecipientChange(index, e.target.value, "cc")}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="{{matter.owner.email}}"
                      />
                    </div>
                  )}

                  {/* Templates (email/push) */}
                  {policy.channel !== "SMS" && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                          Subject Template
                        </label>
                        <input
                          value={policy.subjectTemplate ?? ""}
                          onChange={(e) => handlePolicyChange(index, { subjectTemplate: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="Workflow update for {{matter.title}}"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                          Body Template
                        </label>
                        <textarea
                          value={policy.bodyTemplate ?? ""}
                          onChange={(e) => handlePolicyChange(index, { bodyTemplate: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="Hello {{contact.firstName}}, ..."
                        />
                      </div>
                    </>
                  )}

                  {/* Send strategy */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Send Strategy
                      </label>
                      <select
                        value={policy.sendStrategy ?? "IMMEDIATE"}
                        onChange={(e) =>
                          handlePolicyChange(index, { sendStrategy: e.target.value as NotificationSendStrategy })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      >
                        {SEND_STRATEGIES.map((strategy) => (
                          <option key={strategy} value={strategy}>
                            {strategy === "IMMEDIATE" ? "Immediately" : "Delay after trigger"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Delay (minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={policy.delayMinutes ?? ""}
                        disabled={(policy.sendStrategy ?? "IMMEDIATE") === "IMMEDIATE"}
                        onChange={(e) => {
                          const minutes = e.target.value ? Number(e.target.value) : null;
                          handlePolicyChange(index, { delayMinutes: minutes });
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                        placeholder="e.g. 15"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
});
