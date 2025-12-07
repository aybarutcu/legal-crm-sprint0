"use client";

import React, { useState } from "react";
import { ActionType } from "./config-forms/ActionConfigForm";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ActionTypeInfo {
  type: ActionType;
  icon: string;
  label: string;
  description: string;
  color: string;
}

const ACTION_TYPES: ActionTypeInfo[] = [
  {
    type: "TASK",
    icon: "📋",
    label: "Task",
    description: "Assign a task to a team member",
    color: "bg-blue-50 hover:bg-blue-100 border-blue-300",
  },
  {
    type: "CHECKLIST",
    icon: "☑️",
    label: "Checklist",
    description: "Multi-item checklist",
    color: "bg-green-50 hover:bg-green-100 border-green-300",
  },
  {
    type: "APPROVAL",
    icon: "✅",
    label: "Approval",
    description: "Require lawyer approval",
    color: "bg-purple-50 hover:bg-purple-100 border-purple-300",
  },
  {
    type: "SIGNATURE",
    icon: "✍️",
    label: "Signature",
    description: "Request client e-signature",
    color: "bg-indigo-50 hover:bg-indigo-100 border-indigo-300",
  },
  {
    type: "REQUEST_DOC",
    icon: "📄",
    label: "Request Document",
    description: "Request document from client",
    color: "bg-yellow-50 hover:bg-yellow-100 border-yellow-300",
  },
  {
    type: "PAYMENT",
    icon: "💳",
    label: "Payment",
    description: "Request payment from client",
    color: "bg-emerald-50 hover:bg-emerald-100 border-emerald-300",
  },
  {
    type: "WRITE_TEXT",
    icon: "📝",
    label: "Write Text",
    description: "Text input/writing task",
    color: "bg-pink-50 hover:bg-pink-100 border-pink-300",
  },
  {
    type: "POPULATE_QUESTIONNAIRE",
    icon: "❓",
    label: "Questionnaire",
    description: "Dynamic questionnaire",
    color: "bg-orange-50 hover:bg-orange-100 border-orange-300",
  },
  {
    type: "AUTOMATION_EMAIL",
    icon: "📧",
    label: "Automation · Email",
    description: "Send templated emails automatically",
    color: "bg-sky-50 hover:bg-sky-100 border-sky-300",
  },
  {
    type: "AUTOMATION_WEBHOOK",
    icon: "🌐",
    label: "Automation · Webhook",
    description: "Trigger external systems via HTTP",
    color: "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-300",
  },
];

interface NodePaletteProps {
  onAddNode: (actionType: ActionType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`absolute top-0 left-0 z-10 m-4 bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden transition-all duration-300 ${
      isExpanded ? 'w-64' : 'w-12'
    }`}>
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        {isExpanded && (
          <>
            <div>
              <h3 className="font-semibold text-gray-700 text-sm">Action Types</h3>
              <p className="text-xs text-gray-500 mt-1">Click to add to canvas</p>
            </div>
          </>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title={isExpanded ? "Collapse palette" : "Expand palette"}
        >
          {isExpanded ? (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Action Type List */}
      {isExpanded && (
        <>
          <div className="p-2 max-h-[500px] overflow-y-auto space-y-2">
            {ACTION_TYPES.map((actionType) => (
              <button
                key={actionType.type}
                onClick={() => onAddNode(actionType.type)}
                className={`
                  w-full text-left p-3 rounded-lg border-2 transition-all
                  ${actionType.color}
                  hover:shadow-md active:scale-95
                `}
                title={actionType.description}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{actionType.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800 truncate">
                      {actionType.label}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {actionType.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
            💡 Click an action type to add it to the canvas
          </div>
        </>
      )}
    </div>
  );
}
