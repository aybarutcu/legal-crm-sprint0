"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ActionType } from "../config-forms/ActionConfigForm";
import { Role } from "@prisma/client";
import { WorkflowStep } from "../WorkflowCanvas";

// Icons for action types
const ACTION_ICONS: Record<ActionType, string> = {
  TASK: "📋",
  CHECKLIST: "☑️",
  APPROVAL: "✅",
  SIGNATURE: "✍️",
  REQUEST_DOC: "📄",
  PAYMENT: "💳",
  WRITE_TEXT: "📝",
  POPULATE_QUESTIONNAIRE: "❓",
  AUTOMATION_EMAIL: "📧",
  AUTOMATION_WEBHOOK: "🌐",
};

// Colors for action types (matching NodePalette)
const ACTION_TYPE_COLORS: Record<ActionType, { bg: string; border: string; text: string }> = {
  TASK: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700" },
  CHECKLIST: { bg: "bg-green-100", border: "border-green-400", text: "text-green-700" },
  APPROVAL: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700" },
  SIGNATURE: { bg: "bg-indigo-100", border: "border-indigo-400", text: "text-indigo-700" },
  REQUEST_DOC: { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-700" },
  PAYMENT: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700" },
  WRITE_TEXT: { bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-700" },
  POPULATE_QUESTIONNAIRE: { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-700" },
  AUTOMATION_EMAIL: { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-700" },
  AUTOMATION_WEBHOOK: { bg: "bg-fuchsia-100", border: "border-fuchsia-400", text: "text-fuchsia-700" },
};

// Colors for roles (used in badge only)
const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-purple-50", text: "text-purple-600" },
  LAWYER: { bg: "bg-blue-50", text: "text-blue-600" },
  PARALEGAL: { bg: "bg-green-50", text: "text-green-600" },
  CLIENT: { bg: "bg-orange-50", text: "text-orange-600" },
};

type OutputHandleConfig = {
  id: string;
  label?: string;
  color: string;
};

const DEFAULT_OUTPUT_HANDLES: OutputHandleConfig[] = [
  { id: "next", color: "#10b981" },
];

interface StepNodeData {
  step: WorkflowStep;
  label: string;
  actionType: ActionType;
  roleScope: Role;
  dependencyCount: number;
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
}

export const StepNode = memo(({ data, selected }: NodeProps<StepNodeData>) => {
  const { step, label, actionType, roleScope, dependencyCount, dependencyLogic } = data;

  const actionColor = ACTION_TYPE_COLORS[actionType];
  const roleColor = ROLE_COLORS[roleScope];
  const icon = ACTION_ICONS[actionType];
  const actionLabel = actionType.replace(/_/g, " ");

  // Generate output handles based on action type and branches
  const outputHandles: OutputHandleConfig[] = DEFAULT_OUTPUT_HANDLES;

  return (
    <div
      className={`
        relative rounded-lg shadow-lg border-2 min-w-[200px] max-w-[250px] p-3
        transition-all duration-200 cursor-pointer
        ${actionColor.bg} ${actionColor.border}
        ${selected ? "ring-4 ring-blue-500 shadow-xl" : ""}
        hover:shadow-xl
      `}
    >
      {/* Left Handle (input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: '#3b82f6',
          border: '3px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      {/* Dependency Logic Badge */}
      {dependencyCount > 1 && (
        <div
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shadow-md"
          title={`Dependency Logic: ${dependencyLogic}`}
        >
          {dependencyLogic === "ALL" ? "&&" : "||"}
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Action Type */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-medium text-gray-600">{actionLabel}</span>
        </div>

        {/* Title */}
        <div className={`font-semibold ${actionColor.text} truncate`} title={label}>
          {label}
        </div>

        {/* Role Badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${roleColor.bg} ${roleColor.text} border border-gray-300`}>
            {roleScope}
          </span>
          {step.required && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 border border-red-400 text-red-700">
              Required
            </span>
          )}
        </div>

        {/* Dependency Count */}
        {dependencyCount > 0 && (
          <div className="text-xs text-gray-500">
            Depends on {dependencyCount} step{dependencyCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Right Handle(s) (output) */}
      {outputHandles.map((handle, index) => {
        const position = Position.Right;
        const topPosition = ((index + 1) / (outputHandles.length + 1)) * 100 + "%";
        const rightPosition = "-10px";

        const handleStyle = {
          width: "22px",
          height: "22px",
          backgroundColor: handle.color,
          border: "3px solid white",
          boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
          zIndex: 20 - index,
          cursor: "crosshair",
          borderRadius: "50%",
          top: topPosition,
          right: rightPosition,
          transform: "translate(50%, -50%)",
        };

        return (
          <React.Fragment key={handle.id}>
            <Handle
              id={handle.id}
              type="source"
              position={position}
              style={handleStyle}
            />
            {handle.label && (
              <span
                className="absolute rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-md border"
                style={{
                  top: topPosition,
                  right: "-38px",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  zIndex: 15 - index,
                  whiteSpace: "nowrap",
                }}
              >
                {handle.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

StepNode.displayName = "StepNode";
