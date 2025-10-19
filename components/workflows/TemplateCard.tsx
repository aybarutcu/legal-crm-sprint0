"use client";

import { useState } from "react";
import { ActionConfigDisplay } from "./ActionConfigDisplay";
import { ConditionDisplay, ConditionBadge } from "./conditions";
import type { ConditionConfig, ConditionType } from "./conditions/types";
import { ChevronDown, ChevronRight, CheckCircle, FileText, Edit2, Trash2, GitBranch, Play, Clock, User } from "lucide-react";

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: Array<{
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
  }>;
  createdAt: string;
  updatedAt: string;
};

type TemplateCardProps = {
  template: WorkflowTemplate;
  startNewVersion: (template: WorkflowTemplate) => void;
  publishTemplate: (id: string) => void;
  openEditEditor: (template: WorkflowTemplate) => void;
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
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditEditor(template);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={template.isActive}
              title={template.isActive ? "Cannot edit active version" : "Edit template"}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
            
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

      {/* Expanded Content - Steps */}
      {isExpanded && (
        <div className="border-t-2 border-slate-200 bg-slate-50/30 p-5">
          <div className="space-y-3">
            {template.steps.map((step, index) => {
              const ActionIcon = ACTION_ICONS[step.actionType as keyof typeof ACTION_ICONS] || CheckCircle;
              
              return (
                <div
                  key={`${template.id}-${step.order}`}
                  className="relative rounded-lg border-2 border-slate-200 bg-white p-4 hover:border-slate-300 transition-all"
                >
                  {/* Step Number Badge */}
                  <div className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-xs font-bold text-white shadow-lg border-2 border-white">
                    {index + 1}
                  </div>
                  
                  <div className="flex items-start gap-3">
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
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
