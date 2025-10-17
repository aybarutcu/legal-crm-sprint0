"use client";

import { CheckSquare, Square } from "lucide-react";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistViewerProps {
  items: ChecklistItem[];
  metadata?: {
    completedBy?: string;
    completedAt?: string;
  };
}

export function ChecklistViewer({ items, metadata }: ChecklistViewerProps) {
  const completedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;
  const allCompleted = completedCount === totalCount;

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-slate-900">Checklist</h4>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          allCompleted
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-amber-100 text-amber-800 border border-amber-200"
        }`}>
          {completedCount}/{totalCount} Complete
        </span>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3">
            {item.checked ? (
              <CheckSquare className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <Square className="h-5 w-5 text-slate-400 flex-shrink-0" />
            )}
            <span
              className={`text-sm ${
                item.checked ? "text-slate-700 line-through" : "text-slate-900"
              }`}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Metadata Footer */}
      {metadata && (metadata.completedBy || metadata.completedAt) && (
        <div className="mt-3 pt-3 border-t border-green-200 text-xs text-slate-500">
          {metadata.completedBy && <span>Completed by {metadata.completedBy}</span>}
          {metadata.completedBy && metadata.completedAt && <span> • </span>}
          {metadata.completedAt && <span>{new Date(metadata.completedAt).toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}
