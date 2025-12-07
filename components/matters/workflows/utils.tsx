import React from "react";
import type { ActionState, ActionType } from "./types";

export function getStepClasses(
  kind: "prev" | "current" | "next",
  state?: ActionState
): string {
  if (kind === "next") return "border-slate-200 bg-white text-slate-700";
  if (kind === "prev") {
    switch (state) {
      case "COMPLETED":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "FAILED":
        return "border-red-200 bg-red-50 text-red-700";
      case "SKIPPED":
        return "border-slate-200 bg-slate-50 text-slate-600";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600";
    }
  }
  switch (state) {
    case "READY":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "IN_PROGRESS":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "BLOCKED":
      return "border-red-200 bg-red-50 text-red-700";
    case "PENDING":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function defaultConfigFor(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    case "APPROVAL":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC":
      return { requestText: "", documentNames: [] };
    case "PAYMENT":
      return { amount: 0, currency: "USD", provider: "mock" };
    case "WRITE_TEXT":
      return {
        title: "",
        description: "",
        placeholder: "Enter your text here...",
        minLength: 0,
        maxLength: undefined,
        required: true,
      };
    case "POPULATE_QUESTIONNAIRE":
      return { questionnaireId: null, title: "", description: "", dueInDays: undefined };
    case "AUTOMATION_EMAIL":
      return {
        recipients: ["{{contact.email}}"],
        cc: [],
        subjectTemplate: "Automated update for {{matter.title}}",
        bodyTemplate: "Hello {{contact.firstName}},\n\nWe will keep you posted.\n",
        sendStrategy: "IMMEDIATE",
        delayMinutes: null,
      };
    case "AUTOMATION_WEBHOOK":
      return {
        url: "https://example.com/webhooks/workflow",
        method: "POST",
        headers: [],
        payloadTemplate: JSON.stringify(
          {
            matterId: "{{matter.id}}",
            stepId: "{{step.id}}",
          },
          null,
          2,
        ),
        sendStrategy: "IMMEDIATE",
        delayMinutes: null,
      };
    case "CHECKLIST":
    default:
      return { items: [] };
  }
}

export function isTerminalState(state: ActionState): boolean {
  return state === "COMPLETED" || state === "FAILED" || state === "SKIPPED";
}

export function renderStateBadge(state: ActionState): React.ReactElement {
  const classes: Record<ActionState, string> = {
    PENDING: "bg-slate-100 text-slate-600",
    READY: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    BLOCKED: "bg-red-100 text-red-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    SKIPPED: "bg-slate-200 text-slate-600",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${classes[state]}`}>
      {state.replace(/_/g, " ")}
    </span>
  );
}
