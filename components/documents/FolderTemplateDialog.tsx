"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";

interface FolderNode {
  name: string;
  color?: string;
  children?: FolderNode[];
}

interface FolderTemplateFormData {
  name: string;
  description: string;
  structure: FolderNode;
}

interface FolderTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  onSuccess?: () => void;
}

const COLORS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
  { value: "gray", label: "Gray" },
];

function FolderNodeEditor({
  node,
  onChange,
  onDelete,
}: {
  node: FolderNode;
  onChange: (node: FolderNode) => void;
  onDelete?: () => void;
}) {
  const addChild = () => {
    onChange({
      ...node,
      children: [...(node.children || []), { name: "New Folder" }],
    });
  };

  const updateChild = (index: number, child: FolderNode) => {
    const newChildren = [...(node.children || [])];
    newChildren[index] = child;
    onChange({ ...node, children: newChildren });
  };

  const deleteChild = (index: number) => {
    const newChildren = [...(node.children || [])];
    newChildren.splice(index, 1);
    onChange({ ...node, children: newChildren });
  };

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-gray-50">
      <div className="flex gap-2">
        <input
          type="text"
          value={node.name}
          onChange={(e) => onChange({ ...node, name: e.target.value })}
          placeholder="Folder name"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={node.color || ""}
          onChange={(e) =>
            onChange({
              ...node,
              color: e.target.value || undefined,
            })
          }
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">No color</option>
          {COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 text-gray-600 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="ml-6 space-y-2">
        {node.children?.map((child, index) => (
          <FolderNodeEditor
            key={index}
            node={child}
            onChange={(updated) => updateChild(index, updated)}
            onDelete={() => deleteChild(index)}
          />
        ))}
        <button
          type="button"
          onClick={addChild}
          className="w-full border border-dashed rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Subfolder
        </button>
      </div>
    </div>
  );
}

export function FolderTemplateDialog({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: FolderTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [formData, setFormData] = useState<FolderTemplateFormData>({
    name: "",
    description: "",
    structure: { name: "Root Folder" },
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (open && templateId) {
      // Load existing template
      fetch(`/api/folder-templates/${templateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.template) {
            setFormData({
              name: data.template.name,
              description: data.template.description || "",
              structure: data.template.structure,
            });
          }
        })
        .catch(() => {
          setToast({ message: "Failed to load template", variant: "error" });
        });
    } else if (open && !templateId) {
      // Reset for new template
      setFormData({
        name: "",
        description: "",
        structure: { name: "Root Folder" },
      });
    }
  }, [open, templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = templateId
        ? `/api/folder-templates/${templateId}`
        : "/api/folder-templates";
      const method = templateId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save template");
      }

      setToast({
        message: templateId ? "Template updated successfully" : "Template created successfully",
        variant: "success",
      });

      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1000);
    } catch (error: any) {
      setToast({ message: error.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">
            {templateId ? "Edit" : "Create"} Folder Template
          </h2>
          <p className="text-gray-600 mb-6">
            Create a reusable folder structure for matters and contacts.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Template Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Standard Case Folders"
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe when to use this template..."
                rows={2}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Folder Structure
              </label>
              <FolderNodeEditor
                node={formData.structure}
                onChange={(structure) =>
                  setFormData({ ...formData, structure })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : templateId
                  ? "Update Template"
                  : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded shadow-lg ${
              toast.variant === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
