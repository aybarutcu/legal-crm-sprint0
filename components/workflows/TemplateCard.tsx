"use client";

import { useState } from "react";
import type { WorkflowTemplate } from "./types";

type TemplateCardProps = {
  template: WorkflowTemplate;
  startNewVersion: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  openEditEditor: (template: WorkflowTemplate) => void;
  deleteTemplate: (id: string) => void;
  isDeleting: string | null;
  publishingId: string | null;
};

export function TemplateCard({ 
  template, 
  startNewVersion, 
  publishTemplate, 
  openEditEditor, 
  deleteTemplate, 
  isDeleting, 
  publishingId 
}: TemplateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {template.name} <span className="text-xs font-medium text-slate-500">v{template.version}</span>
            </h3>
            <p className="text-sm text-slate-500">
              {template.description || "No description provided."}
            </p>
            <p className="text-xs text-slate-400">
              Updated {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(template.updatedAt))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {template.isActive ? "Active" : "Draft"}
            </span>
            {template.isActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startNewVersion(template);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
              >
                New Version
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  publishTemplate(template.id);
                }}
                className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                disabled={publishingId === template.id}
              >
                {publishingId === template.id ? "Publishing..." : "Publish"}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditEditor(template);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              disabled={template.isActive}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteTemplate(template.id);
              }}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50"
              disabled={isDeleting === template.id}
            >
              {isDeleting === template.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        </header>
      </div>
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {template.steps.map((step) => (
            <div
              key={`${template.id}-${step.order}`}
              className="flex flex-col rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-slate-900">{step.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                      {step.actionType.replace(/_/g, " ")}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                      {step.roleScope}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                      {step.required ? "Required" : "Optional"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                {step.actionType === "CHECKLIST" ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Checklist Items</h4>
                    <ul className="list-disc pl-5 mt-1">
                      {(step.actionConfig.items as { title: string }[]).map((item, i) => (
                        <li key={i}>{item.title}</li>
                      ))}
                    </ul>
                  </div>
                ) : Object.keys(step.actionConfig ?? {}).length > 0 ? (
                  <pre className="mt-2 max-w-full overflow-auto rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600">
                    {JSON.stringify(step.actionConfig, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
