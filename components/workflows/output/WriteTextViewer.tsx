"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

interface WriteTextViewerProps {
  content: string;
  metadata?: {
    writtenBy?: string;
    writtenAt?: string;
  };
}

export function WriteTextViewer({ content, metadata }: WriteTextViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 300;
  const displayContent = expanded || !isLong ? content : content.substring(0, 300);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-slate-900">Written Content</h4>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          Submitted
        </span>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">
            {displayContent}
            {!expanded && isLong && "..."}
          </p>
        </div>

        {/* Show more/less button */}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Metadata Footer */}
      {metadata && (metadata.writtenBy || metadata.writtenAt) && (
        <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-slate-500">
          {metadata.writtenBy && <span>Written by {metadata.writtenBy}</span>}
          {metadata.writtenBy && metadata.writtenAt && <span> • </span>}
          {metadata.writtenAt && <span>{new Date(metadata.writtenAt).toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}
