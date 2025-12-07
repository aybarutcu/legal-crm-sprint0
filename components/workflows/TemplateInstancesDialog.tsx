"use client";

import { useState } from "react";
import { FileText, ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";

type TemplateInstance = {
  id: string;
  status: string;
  createdAt: string;
  matter: {
    id: string;
    title: string;
    type: string;
    status: string;
    client: {
      firstName: string;
      lastName: string;
    };
  } | null;
};

type TemplateInstancesDialogProps = {
  templateId: string;
  templateName: string;
  instanceCount: number;
};

export function TemplateInstancesDialog({
  templateId,
  templateName,
  instanceCount,
}: TemplateInstancesDialogProps) {
  const [open, setOpen] = useState(false);
  const [instances, setInstances] = useState<TemplateInstance[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}/instances`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch (error) {
      console.error("Failed to load template instances:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    loadInstances();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "FAILED":
        return "bg-red-100 text-red-700 border-red-200";
      case "CANCELLED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getMatterStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-700";
      case "IN_PROGRESS":
        return "bg-amber-100 text-amber-700";
      case "CLOSED":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>{instanceCount} {instanceCount === 1 ? "Matter" : "Matters"}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Matters Using &quot;{templateName}&quot;
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {instanceCount} workflow instance{instanceCount !== 1 ? "s" : ""} across {instanceCount} matter{instanceCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : instances.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No matters found using this template
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instances.filter(i => i.matter).map((instance) => (
                      <div
                        key={instance.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-slate-900 truncate">
                                {instance.matter!.title}
                              </h4>
                              <Link
                                href={`/matters/${instance.matter!.id}`}
                                className="flex-shrink-0 text-blue-600 hover:text-blue-700"
                                title="View matter"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-slate-600">
                                Client: {instance.matter!.client.firstName} {instance.matter!.client.lastName}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-600">
                                {instance.matter!.type}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getMatterStatusColor(instance.matter!.status)}`}>
                                {instance.matter!.status}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(instance.status)}`}>
                                Workflow: {instance.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <div className="text-xs text-slate-500">
                              Started
                            </div>
                            <div className="text-sm font-medium text-slate-700">
                              {new Date(instance.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end p-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
