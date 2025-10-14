"use client";

import { useState } from "react";
import { TemplateCard } from "./TemplateCard";
import type { WorkflowTemplate } from "./types";

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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
        <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
      </div>
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {versions
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
      )}
    </div>
  );
}