"use client";

import { useState } from "react";
import type { WorkflowTemplate } from "./types";
import { ActionConfigDisplay } from "./ActionConfigDisplay";

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
        <div className="mt-6 space-y-3">
          {template.steps.map((step, index) => (
            <div
              key={`${template.id}-${step.order}`}
              className="relative flex flex-col rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm hover:border-slate-300 transition-colors"
            >
              <div className="absolute -left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 border-2 border-white">
                {index + 1}
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 text-base">{step.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700 border border-blue-200">
                      {step.actionType.replace(/_/g, " ")}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200">
                      {step.roleScope}
                    </span>
                    {step.required && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 border border-amber-200">
                        Required
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <ActionConfigDisplay
                  actionType={step.actionType}
                  config={step.actionConfig}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
