"use client";

import { useState, useEffect } from "react";
import { FileEdit, AlertCircle } from "lucide-react";

interface WriteTextExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: (payload: { content: string; format: "plain" | "html" }) => void;
  isLoading: boolean;
}

export function WriteTextExecution({
  step,
  onComplete,
  isLoading,
}: WriteTextExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  
  const title = (config?.title as string) || "Write Text";
  const description = config?.description as string | undefined;
  const placeholder = (config?.placeholder as string) || "Enter your text here...";
  const minLength = (config?.minLength as number) || 0;
  const maxLength = config?.maxLength as number | undefined;
  const required = config?.required !== false;
  
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Validate content length
  useEffect(() => {
    setError(null);
    
    if (required && content.length === 0) {
      return; // Don't show error until user tries to submit
    }
    
    if (minLength > 0 && content.length > 0 && content.length < minLength) {
      setError(`Text must be at least ${minLength} characters (current: ${content.length})`);
    } else if (maxLength && content.length > maxLength) {
      setError(`Text must not exceed ${maxLength} characters (current: ${content.length})`);
    }
  }, [content, minLength, maxLength, required]);

  const handleComplete = () => {
    // Validate before submitting
    if (required && content.trim().length === 0) {
      setError("This field is required");
      return;
    }
    
    if (minLength > 0 && content.length < minLength) {
      setError(`Text must be at least ${minLength} characters`);
      return;
    }
    
    if (maxLength && content.length > maxLength) {
      setError(`Text must not exceed ${maxLength} characters`);
      return;
    }

    onComplete({
      content: content.trim(),
      format: "plain",
    });
  };

  const isValid = content.trim().length > 0 && !error;
  const charCount = content.length;

  return (
    <div className="mt-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-4">
      <div className="mb-3 flex items-start gap-2">
        <FileEdit className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h5 className="font-semibold text-indigo-900">
            {title}
            {required && <span className="text-red-500 ml-1">*</span>}
          </h5>
          {description && (
            <p className="mt-1 text-sm text-indigo-700">{description}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={8}
            disabled={isLoading}
            className="w-full rounded-lg border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          
          {/* Character count and validation */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className={`${
                error ? "text-red-600" : 
                charCount === 0 ? "text-slate-400" : 
                "text-slate-600"
              }`}>
                {charCount} {charCount === 1 ? "character" : "characters"}
              </span>
              
              {(minLength > 0 || maxLength) && (
                <span className="text-slate-500">
                  {minLength && maxLength
                    ? `(${minLength} - ${maxLength} required)`
                    : minLength
                    ? `(min ${minLength})`
                    : `(max ${maxLength})`}
                </span>
              )}
            </div>
            
            {error && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleComplete}
            disabled={!isValid || isLoading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Submitting..." : "Submit Text"}
          </button>
          
          {/* Future: AI Assist button */}
          {/* <button
            type="button"
            className="rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
          >
            <Sparkles className="h-4 w-4 inline mr-1.5" />
            AI Assist
          </button> */}
        </div>
      </div>
    </div>
  );
}
