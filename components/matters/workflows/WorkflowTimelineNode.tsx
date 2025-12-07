"use client";

import { memo } from "react";
import type { ReactElement } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { CheckCircle2, Clock, Circle, AlertTriangle, XCircle, Minus, Pause } from "lucide-react";
import type { WorkflowTimelineStep } from "./WorkflowTimeline";

type TimelineNodeData = {
  step: WorkflowTimelineStep;
  isSelected: boolean;
  showDefaultHandle: boolean;
};

const STATE_STYLES: Record<
  WorkflowTimelineStep["actionState"],
  {
    bg: string;
    border: string;
    text: string;
    accent: string;
    label: string;
    icon: ReactElement;
  }
> = {
  COMPLETED: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    text: "text-emerald-900",
    accent: "text-emerald-600",
    label: "Completed",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  READY: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    text: "text-blue-900",
    accent: "text-blue-600",
    label: "Ready",
    icon: <Circle className="h-4 w-4 fill-current" />,
  },
  IN_PROGRESS: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-900",
    accent: "text-amber-600",
    label: "In Progress",
    icon: <Clock className="h-4 w-4" />,
  },
  BLOCKED: {
    bg: "bg-rose-50",
    border: "border-rose-400",
    text: "text-rose-900",
    accent: "text-rose-600",
    label: "Blocked",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  FAILED: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-900",
    accent: "text-red-600",
    label: "Failed",
    icon: <XCircle className="h-4 w-4" />,
  },
  SKIPPED: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700",
    accent: "text-slate-500",
    label: "Skipped",
    icon: <Minus className="h-4 w-4" />,
  },
  PENDING: {
    bg: "bg-white",
    border: "border-slate-200",
    text: "text-slate-700",
    accent: "text-slate-500",
    label: "Pending",
    icon: <Pause className="h-4 w-4" />,
  },
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  LAWYER: "bg-blue-100 text-blue-700",
  PARALEGAL: "bg-green-100 text-green-700",
  CLIENT: "bg-orange-100 text-orange-700",
};

const ACTION_LABELS: Record<string, string> = {
  APPROVAL: "Approval",
  SIGNATURE: "Client Signature",
  REQUEST_DOC: "Document Request",
  PAYMENT: "Payment",
  CHECKLIST: "Checklist",
  WRITE_TEXT: "Write Text",
  POPULATE_QUESTIONNAIRE: "Questionnaire",
  TASK: "Task",
  AUTOMATION_EMAIL: "Automation · Email",
  AUTOMATION_WEBHOOK: "Automation · Webhook",
};

export const WorkflowTimelineNode = memo(({ data }: NodeProps<TimelineNodeData>) => {
  const { step, isSelected, showDefaultHandle } = data;
  const state = STATE_STYLES[step.actionState] ?? STATE_STYLES.PENDING;
  const roleBadge = ROLE_BADGE_COLORS[step.roleScope] ?? "bg-slate-100 text-slate-600";
  const isHighPriority = step.priority === "HIGH";

  return (
    <div
      className={`relative w-64 rounded-2xl border-2 px-4 py-3 shadow-sm transition-all duration-200 ${
        state.bg
      } ${state.border} ${isSelected ? "ring-4 ring-blue-400 ring-offset-2" : ""}`}
    >
      {/* High Priority Indicator - Top Right Badge */}
      {isHighPriority && (
        <div
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg border-2 border-white"
          title="High Priority"
        >
          <span className="text-xs font-bold">!</span>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, backgroundColor: "#94a3b8", border: "2px solid white" }}
      />

      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${state.accent} bg-white/70`}>
          {state.icon}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${state.text}`}>{step.title || "Untitled Step"}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            {ACTION_LABELS[step.actionType] ?? step.actionType.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${state.accent} bg-white/60`}>
          {state.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${roleBadge}`}>Role: {step.roleScope}</span>
      </div>

      {showDefaultHandle && (
        <Handle
          type="source"
          id="next"
          position={Position.Right}
          style={{
            top: "50%",
            transform: "translate(50%, -50%)",
            backgroundColor: "#94a3b8",
            border: "2px solid white",
            width: 12,
            height: 12,
          }}
        />
      )}

      {step.nextStepOnTrue && (
        <Handle
          type="source"
          id="approve"
          position={Position.Right}
          style={{
            top: "35%",
            transform: "translate(50%, -50%)",
            backgroundColor: "#10b981",
            border: "2px solid white",
            width: 12,
            height: 12,
          }}
        />
      )}

      {step.nextStepOnFalse && (
        <Handle
          type="source"
          id="reject"
          position={Position.Right}
          style={{
            top: "65%",
            transform: "translate(50%, -50%)",
            backgroundColor: "#ef4444",
            border: "2px solid white",
            width: 12,
            height: 12,
          }}
        />
      )}
    </div>
  );
});

WorkflowTimelineNode.displayName = "WorkflowTimelineNode";
