"use client";

import { useState } from "react";
import { TemplateCard } from "./TemplateCard";
import type { WorkflowTemplate } from "./types";
import { ChevronDown, ChevronRight, Layers, CheckCircle2, AlertCircle } from "lucide-react";

type TemplateGroupProps = {
  name: string;
  versions: WorkflowTemplate[];
  startNewVersion: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  openEditEditor: (template: WorkflowTemplate) => void;
  deleteTemplate: (id: string) => void;
  isDeleting: string | null;
  publishingId: string | null;
};

export function TemplateGroup({ 
  name, 
  versions, 
  startNewVersion, 
  publishTemplate, 
  openEditEditor, 
  deleteTemplate, 
  isDeleting, 
  publishingId 
}: TemplateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const activeVersion = versions.find(v => v.isActive);
  const draftVersions = versions.filter(v => !v.isActive);
  const totalSteps = activeVersion?.steps.length || versions[0]?.steps.length || 0;
  const hasActiveVersion = Boolean(activeVersion);

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50/50 overflow-hidden shadow-lg hover:shadow-xl transition-all">
      {/* Header - Always Visible */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="cursor-pointer bg-white border-b-2 border-slate-200 p-6 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Icon & Expand/Collapse */}
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0 transition-transform" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 transition-transform" />
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-md flex-shrink-0">
                <Layers className="h-6 w-6" />
              </div>
            </div>
            
            {/* Template Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-slate-900 mb-1">{name}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">
                  {versions.length} {versions.length === 1 ? 'version' : 'versions'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">
                  {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
                </span>
                {hasActiveVersion && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active
                    </span>
                  </>
                )}
                {!hasActiveVersion && draftVersions.length > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Draft Only
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Version Count Badge */}
          <div className="flex-shrink-0">
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Versions</div>
              <div className="text-2xl font-bold text-slate-900 text-center">{versions.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content - Versions List */}
      {isExpanded && (
        <div className="p-6 space-y-4">
          {/* Active Version First */}
          {activeVersion && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-emerald-200"></div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Active Version</span>
                <div className="h-px flex-1 bg-emerald-200"></div>
              </div>
              <TemplateCard
                key={activeVersion.id}
                template={activeVersion}
                startNewVersion={startNewVersion}
                publishTemplate={publishTemplate}
                openEditEditor={openEditEditor}
                deleteTemplate={deleteTemplate}
                isDeleting={isDeleting}
                publishingId={publishingId}
              />
            </div>
          )}

          {/* Draft Versions */}
          {draftVersions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-200"></div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Draft Version{draftVersions.length !== 1 ? 's' : ''}
                </span>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              <div className="space-y-3">
                {draftVersions
                  .sort((a, b) => b.version - a.version)
                  .map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      startNewVersion={startNewVersion}
                      publishTemplate={publishTemplate}
                      openEditEditor={openEditEditor}
                      deleteTemplate={deleteTemplate}
                      isDeleting={isDeleting}
                      publishingId={publishingId}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}