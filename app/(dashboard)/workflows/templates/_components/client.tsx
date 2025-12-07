"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { TemplateGroup } from "@/components/workflows/TemplateGroup";
import type { WorkflowTemplate } from "@/components/workflows/types";

export function WorkflowTemplatesClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "steps">("name");

  useEffect(() => {
    void fetchTemplates();
  }, []);

  // Filter and sort templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && template.isActive) ||
      (statusFilter === "draft" && !template.isActive);

    return matchesSearch && matchesStatus;
  });

  // Group by name after filtering
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.name]) {
      acc[template.name] = [];
    }
    acc[template.name].push(template);
    return acc;
  }, {} as Record<string, WorkflowTemplate[]>);

  // Sort groups
  const sortedGroups = Object.entries(groupedTemplates).sort(([nameA, versionsA], [nameB, versionsB]) => {
    switch (sortBy) {
      case "name":
        return nameA.localeCompare(nameB);
      case "updated": {
        const latestA = Math.max(...versionsA.map(v => new Date(v.updatedAt).getTime()));
        const latestB = Math.max(...versionsB.map(v => new Date(v.updatedAt).getTime()));
        return latestB - latestA;
      }
      case "steps": {
        const stepsA = versionsA[0]?.steps.length || 0;
        const stepsB = versionsB[0]?.steps.length || 0;
        return stepsB - stepsA;
      }
      default:
        return 0;
    }
  });

  async function fetchTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows/templates");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = (await response.json()) as WorkflowTemplate[];

      setTemplates(
        data.map((template) => ({
          ...template,
          steps: template.steps
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        }))
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }

  function startNewVersion(template: WorkflowTemplate) {
    router.push(`/workflows/templates/new?sourceId=${template.id}&mode=version`);
  }

  function duplicateTemplate(template: WorkflowTemplate) {
    router.push(`/workflows/templates/new?sourceId=${template.id}&mode=duplicate`);
  }

  async function deleteTemplate(id: string) {
    // Find the template to check if it has instances
    const template = templates.find(t => t.id === id);
    const instanceCount = template?._count?.instances ?? 0;
    const hasInstances = instanceCount > 0;
    
    const confirmMessage = hasInstances
      ? `This template is being used by ${instanceCount} matter${instanceCount === 1 ? '' : 's'}.\n\nNote: You can only archive templates with completed or cancelled workflows. If you have active workflows, complete or cancel them first.\n\nAre you sure you want to archive this template?`
      : "Are you sure you want to delete this template?";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setIsDeleting(id);
    try {
      const response = await fetch(`/api/workflows/templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to ${hasInstances ? 'archive' : 'delete'} template`);
      }
      await fetchTemplates();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : `Failed to ${hasInstances ? 'archive' : 'delete'} template`);
    } finally {
      setIsDeleting(null);
    }
  }

  async function publishTemplate(id: string) {
    setPublishingId(id);
    try {
      const response = await fetch(`/api/workflows/templates/${id}/publish`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to publish template");
      }
      await fetchTemplates();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to publish template");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflow Templates</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create reusable workflow templates with visual canvas editor
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/workflows/ai"
            className="inline-flex items-center justify-center rounded-lg gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Sparkles className="h-4 w-4" />
            AI ile Oluştur
          </Link>
          <Link
            href="/workflows/templates/new"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
          >
            + New Template
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="all">All Templates</option>
              <option value="active">Active Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="name">Name (A-Z)</option>
              <option value="updated">Recently Updated</option>
              <option value="steps">Step Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4">
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading templates...</p>
          </div>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== "all"
              ? "No templates match your search criteria"
              : "No workflow templates yet"}
          </p>
          <Link
            href="/workflows/templates/new"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Create Your First Template
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([name, versions]) => (
            <TemplateGroup
              key={name}
              name={name}
              versions={versions}
              startNewVersion={startNewVersion}
              duplicateTemplate={duplicateTemplate}
              publishTemplate={publishTemplate}
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
