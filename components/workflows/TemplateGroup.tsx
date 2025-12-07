"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WorkflowTemplate, WorkflowStep, WorkflowDependency } from "./types";
import { WorkflowTemplatePreview } from "@/components/workflows/WorkflowTemplatePreview";
import type { WorkflowTemplatePreviewStep, WorkflowTemplatePreviewDependency } from "@/components/workflows/WorkflowTemplatePreview";
import { TemplateInstancesDialog } from "@/components/workflows/TemplateInstancesDialog";
import { ChevronDown, ChevronRight, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import type { ActionType, RoleScope } from "@prisma/client";

type TemplateGroupProps = {
  name: string;
  versions: WorkflowTemplate[];
  startNewVersion: (template: WorkflowTemplate) => void;
  duplicateTemplate: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  isDeleting: string | null;
  publishingId: string | null;
};

export function TemplateGroup({ 
  name, 
  versions, 
  startNewVersion,
  duplicateTemplate, 
  publishTemplate, 
  deleteTemplate, 
  isDeleting, 
  publishingId 
}: TemplateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-emerald-200" />
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                  Active Version
                </span>
                <div className="h-px flex-1 bg-emerald-200" />
              </div>
              <VersionCard
                template={activeVersion}
                startNewVersion={startNewVersion}
                duplicateTemplate={duplicateTemplate}
                publishTemplate={publishTemplate}
                deleteTemplate={deleteTemplate}
                isDeleting={isDeleting === activeVersion.id}
                isPublishing={publishingId === activeVersion.id}
              />
            </div>
          )}

          {/* Draft Versions */}
          {draftVersions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Draft Version{draftVersions.length !== 1 ? "s" : ""}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-4">
                {draftVersions.map((draft) => (
                  <VersionCard
                    key={draft.id}
                    template={draft}
                    startNewVersion={startNewVersion}
                    duplicateTemplate={duplicateTemplate}
                    publishTemplate={publishTemplate}
                    deleteTemplate={deleteTemplate}
                    isDeleting={isDeleting === draft.id}
                    isPublishing={publishingId === draft.id}
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

type VersionCardProps = {
  template: WorkflowTemplate;
  startNewVersion: (template: WorkflowTemplate) => void;
  duplicateTemplate: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  isDeleting: boolean;
  isPublishing: boolean;
};

function VersionCard({
  template,
  startNewVersion,
  duplicateTemplate,
  publishTemplate,
  deleteTemplate,
  isDeleting,
  isPublishing,
}: VersionCardProps) {
  const previewSteps = useMemo(() => mapToPreviewSteps(template.steps), [template.steps]);
  const previewDependencies = useMemo(() => mapToPreviewDependencies(template.dependencies || []), [template.dependencies]);
  const updatedDate = useMemo(() => new Date(template.updatedAt), [template.updatedAt]);
  const stepCount = previewSteps.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-lg font-semibold text-slate-900">
            Version {template.version}
          </h4>
          <p className="text-xs text-slate-500">
            Updated {updatedDate.toLocaleDateString()} &nbsp;•&nbsp; {stepCount}{" "}
            {stepCount === 1 ? "step" : "steps"}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            template.isActive
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {template.isActive ? "Active" : "Draft"}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <WorkflowTemplatePreview steps={previewSteps} dependencies={previewDependencies} height={260} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {template.isActive ? (
          <button
            type="button"
            onClick={() => startNewVersion(template)}
            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
            title="Create a new version of this template"
          >
            Edit Template (New Version)
          </button>
        ) : (
          <Link
            href={`/workflows/templates/${template.id}/edit`}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Edit Template
          </Link>
        )}
        <button
          type="button"
          onClick={() => duplicateTemplate(template)}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Duplicate as New Template
        </button>
        {!template.isActive && (
          <button
            type="button"
            onClick={() => publishTemplate(template.id)}
            disabled={isPublishing}
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        )}
        {template._count && template._count.instances > 0 && (
          <TemplateInstancesDialog
            templateId={template.id}
            templateName={template.name}
            instanceCount={template._count.instances}
          />
        )}
        <button
          type="button"
          onClick={() => deleteTemplate(template.id)}
          disabled={isDeleting}
          className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            template._count && template._count.instances > 0
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          }`}
          title={
            template._count && template._count.instances > 0
              ? `Archive this template (${template._count.instances} matter${template._count.instances === 1 ? '' : 's'} using it)`
              : "Delete this template"
          }
        >
          {isDeleting
            ? template._count && template._count.instances > 0
              ? "Archiving..."
              : "Deleting..."
            : template._count && template._count.instances > 0
            ? "Archive"
            : "Delete"}
        </button>
      </div>
    </div>
  );
}

function mapToPreviewSteps(steps: WorkflowStep[]): WorkflowTemplatePreviewStep[] {
  return steps.map((step, index) => {
    const order = (step.order ?? index) as number;

    return {
      id: step.id ?? `step-${index}`,
      title: step.title,
      order,
      actionType: step.actionType as ActionType,
      roleScope: step.roleScope as RoleScope,
      required: step.required,
      actionConfig: step.actionConfig,
      positionX: step.positionX,
      positionY: step.positionY,
    } satisfies WorkflowTemplatePreviewStep;
  });
}

function mapToPreviewDependencies(dependencies: WorkflowDependency[]): WorkflowTemplatePreviewDependency[] {
  return dependencies.map((dep) => ({
    id: dep.id,
    sourceStepId: dep.sourceStepId,
    targetStepId: dep.targetStepId,
    dependencyType: dep.dependencyType,
    dependencyLogic: dep.dependencyLogic,
    conditionType: dep.conditionType,
    conditionConfig: dep.conditionConfig,
  }));
}
