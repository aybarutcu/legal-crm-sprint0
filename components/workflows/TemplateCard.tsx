"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ActionConfigDisplay } from "./ActionConfigDisplay";
import { ConditionDisplay, ConditionBadge } from "./conditions";
import type { ConditionConfig, ConditionType } from "./conditions/types";
import { ChevronDown, ChevronRight, CheckCircle, FileText, Edit2, Trash2, GitBranch, Play, Clock, User } from "lucide-react";

type WorkflowStep = {
  id?: string;
  title: string;
  actionType: string;
  roleScope: string;
  required: boolean;
  actionConfig: Record<string, unknown>;
  order: number;
  conditionType?: ConditionType;
  conditionConfig?: ConditionConfig | null;
  nextStepOnTrue?: number | null;
  nextStepOnFalse?: number | null;
  dependsOn?: number[];
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

type TemplateCardProps = {
  template: WorkflowTemplate;
  startNewVersion: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  isDeleting: string | null;
  publishingId: string | null;
};

// Icon mapping for action types
const ACTION_ICONS = {
  TASK: CheckCircle,
  CHECKLIST: FileText,
  APPROVAL_LAWYER: User,
  SIGNATURE_CLIENT: Edit2,
  REQUEST_DOC_CLIENT: FileText,
  PAYMENT_CLIENT: CheckCircle,
  WRITE_TEXT: Edit2,
  POPULATE_QUESTIONNAIRE: FileText,
};

// Group steps by dependency chains (same logic as WorkflowTimeline)
function groupStepsByDependencies(steps: WorkflowStep[]): WorkflowStep[][] {
  if (steps.length === 0) return [];

  const stepsByOrder = new Map<number, WorkflowStep>();
  steps.forEach((step) => stepsByOrder.set(step.order, step));

  const visited = new Set<number>();
  const chains: WorkflowStep[][] = [];

  // Build a chain starting from a given step
  function buildChain(startStep: WorkflowStep): WorkflowStep[] {
    const chain: WorkflowStep[] = [];
    let currentStep: WorkflowStep | undefined = startStep;

    while (currentStep && !visited.has(currentStep.order)) {
      visited.add(currentStep.order);
      chain.push(currentStep);

      // Find next step that depends ONLY on current step (linear dependency)
      const currentStepOrder: number = currentStep.order;
      const dependents = Array.from(stepsByOrder.values()).filter(
        (s) => !visited.has(s.order) && (s.dependsOn || []).includes(currentStepOrder)
      );

      const nextStepId: number | undefined = dependents.find((depStep: WorkflowStep): boolean => {
        return (depStep.dependsOn?.length === 1 && depStep.dependsOn[0] === currentStepOrder) || false;
      })?.order;

      currentStep = nextStepId !== undefined ? stepsByOrder.get(nextStepId) : undefined;
    }

    return chain;
  }

  // Start with root steps (no dependencies)
  const rootSteps = steps.filter((step) => !step.dependsOn || step.dependsOn.length === 0);

  rootSteps.forEach((rootStep) => {
    if (!visited.has(rootStep.order)) {
      const chain = buildChain(rootStep);
      if (chain.length > 0) {
        chains.push(chain);
      }
    }
  });

  // Handle remaining steps (steps that are part of branches or convergence points)
  steps.forEach((step) => {
    if (!visited.has(step.order)) {
      const chain = buildChain(step);
      if (chain.length > 0) {
        chains.push(chain);
      }
    }
  });

  return chains;
}

export function TemplateCard({ 
  template, 
  startNewVersion, 
  publishTemplate, 
  deleteTemplate, 
  isDeleting, 
  publishingId 
}: TemplateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group steps by dependency chains
  const stepChains = useMemo(() => groupStepsByDependencies(template.steps), [template.steps]);

  return (
    <article className={`rounded-xl border-2 overflow-hidden transition-all ${
      template.isActive 
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-md hover:shadow-lg' 
        : 'border-slate-200 bg-white shadow-sm hover:shadow-md'
    }`}>
      {/* Header Section */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)} 
        className={`cursor-pointer p-5 transition-colors ${
          template.isActive ? 'hover:bg-emerald-50/30' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Template Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Expand/Collapse Icon */}
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5 transition-transform" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5 transition-transform" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-base font-bold text-slate-900 truncate">
                  {template.name}
                </h4>
                <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                  template.isActive 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  v{template.version}
                </span>
              </div>
              
              {template.description && (
                <p className="text-sm text-slate-600 line-clamp-1 mb-2">
                  {template.description}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {template.steps.length} {template.steps.length === 1 ? 'step' : 'steps'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Intl.DateTimeFormat("en-US", { 
                    month: "short", 
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(template.updatedAt))}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {template.isActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startNewVersion(template);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors"
                title="Create new version"
              >
                <GitBranch className="h-3.5 w-3.5" />
                New Version
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  publishTemplate(template.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={publishingId === template.id}
                title="Publish this version"
              >
                <Play className="h-3.5 w-3.5" />
                {publishingId === template.id ? "Publishing..." : "Publish"}
              </button>
            )}
            
            {template.isActive ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 opacity-40 cursor-not-allowed"
                title="Cannot edit active version"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : (
              <Link
                href={`/workflows/templates/${template.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                title="Edit template"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Link>
            )}
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteTemplate(template.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting === template.id}
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting === template.id ? "..." : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content - Steps grouped by dependency chains */}
      {isExpanded && (
        <div className="border-t-2 border-slate-200 bg-slate-50/30 p-5">
          <div className="space-y-4">
            {stepChains.map((chain, chainIndex) => (
              <div key={chainIndex} className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="flex items-stretch gap-0 w-max">
                  {chain.map((step, stepIndex) => {
                    const ActionIcon = ACTION_ICONS[step.actionType as keyof typeof ACTION_ICONS] || CheckCircle;
                    
                    return (
                      <div key={`${template.id}-${step.order}`} className="flex items-stretch gap-0">
                        <div className="relative rounded-lg border-2 border-slate-200 bg-white p-4 hover:border-slate-300 transition-all w-72 flex-shrink-0 flex flex-col">
                          <div className="flex items-start gap-3 flex-1">
                          {/* Action Icon */}
                          <div className="flex-shrink-0 mt-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 border border-blue-200">
                              <ActionIcon className="h-5 w-5" />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Step Title */}
                            <div className="font-semibold text-slate-900 mb-2">
                              {step.title}
                            </div>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                                {step.actionType.replace(/_/g, " ")}
                              </span>
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                {step.roleScope}
                              </span>
                              {step.required && (
                                <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                                  ★ Required
                                </span>
                              )}
                              {/* Condition Badge */}
                              {step.conditionType && step.conditionType !== "ALWAYS" && (
                                <ConditionBadge conditionType={step.conditionType} size="sm" />
                              )}
                            </div>
                            
                            {/* Condition Display */}
                            {step.conditionType && step.conditionType !== "ALWAYS" && step.conditionConfig && (
                              <div className="mb-3">
                                <ConditionDisplay
                                  conditionType={step.conditionType}
                                  conditionConfig={step.conditionConfig as ConditionConfig}
                                  compact
                                />
                              </div>
                            )}
                            
                            {/* Action Config */}
                            {step.actionConfig && Object.keys(step.actionConfig).length > 0 && (
                              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <ActionConfigDisplay
                                  actionType={step.actionType}
                                  config={step.actionConfig}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Arrow connector between steps in same chain */}
                      {stepIndex < chain.length - 1 && (
                        <div className="flex items-center px-2 text-slate-400">
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
