"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { ContextSchema } from "@/lib/workflows/context-schema";
import { validateContextField } from "@/lib/workflows/context-schema";

export type ContextValueType = "string" | "number" | "boolean" | "array" | "object";

type ContextEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, value: unknown) => Promise<void>;
  existingKey?: string;
  existingValue?: unknown;
  schema?: ContextSchema | null;
};

function inferType(value: unknown): ContextValueType {
  if (Array.isArray(value)) return "array";
  if (value === null) return "string";
  return typeof value as ContextValueType;
}

function formatValueForEditing(value: unknown, type: ContextValueType): string {
  if (type === "array" || type === "object") {
    return JSON.stringify(value, null, 2);
  }
  if (type === "boolean") {
    return String(value);
  }
  return String(value ?? "");
}

function parseValue(rawValue: string, type: ContextValueType): unknown {
  switch (type) {
    case "string":
      return rawValue;
    case "number": {
      const num = Number(rawValue);
      if (Number.isNaN(num)) throw new Error("Invalid number format");
      return num;
    }
    case "boolean":
      return rawValue === "true" || rawValue === "1";
    case "array":
    case "object": {
      try {
        return JSON.parse(rawValue);
      } catch {
        throw new Error("Invalid JSON format");
      }
    }
    default:
      return rawValue;
  }
}

export function ContextEditModal({
  isOpen,
  onClose,
  onSave,
  existingKey,
  existingValue,
  schema,
}: ContextEditModalProps) {
  const isEditing = !!existingKey;
  const inferredType = existingValue !== undefined ? inferType(existingValue) : "string";
  
  const [key, setKey] = useState(existingKey ?? "");
  const [valueType, setValueType] = useState<ContextValueType>(inferredType);
  const [rawValue, setRawValue] = useState(
    formatValueForEditing(existingValue, inferredType)
  );
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Get field definition from schema if available
  const fieldDef = schema?.fields?.[key];
  const isRequired = fieldDef?.required ?? false;
  const fieldLabel = fieldDef?.label || key;
  const fieldHelp = fieldDef?.description;
  
  // Reset validation errors when key or value changes
  useEffect(() => {
    setValidationErrors([]);
  }, [key, rawValue]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    if (!key.trim()) {
      setError("Key is required");
      return;
    }

    try {
      const parsedValue = parseValue(rawValue, valueType);
      
      // Validate against schema if available
      if (schema && fieldDef) {
        const errors = validateContextField(key, parsedValue, fieldDef);
        if (errors.length > 0) {
          setValidationErrors(errors.map(e => e.message));
          setError("Validation failed. Please check the errors below.");
          return;
        }
      }
      
      setSaving(true);
      await onSave(key.trim(), parsedValue);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value format");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    onClose();
    setKey("");
    setValueType("string");
    setRawValue("");
    setError(null);
  }

  function handleTypeChange(newType: ContextValueType) {
    setValueType(newType);
    
    // Set default values for each type
    switch (newType) {
      case "boolean":
        setRawValue("false");
        break;
      case "number":
        setRawValue("0");
        break;
      case "array":
        setRawValue("[]");
        break;
      case "object":
        setRawValue("{}");
        break;
      default:
        setRawValue("");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEditing ? "Edit Context Value" : "Add Context Value"}
            </h3>
            <p className="text-sm text-slate-500">
              {isEditing ? "Modify the context value" : "Add a new key-value pair to workflow context"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>
              Key
              {isRequired && <span className="ml-1 text-red-500">*</span>}
            </span>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isEditing}
              placeholder={schema ? "Select or enter a field name" : "e.g., clientApproved, documentCount"}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              required
            />
            {fieldHelp && (
              <span className="text-xs text-slate-500">{fieldHelp}</span>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Type
            <select
              value={valueType}
              onChange={(e) => handleTypeChange(e.target.value as ContextValueType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array (JSON)</option>
              <option value="object">Object (JSON)</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>
              {fieldLabel || "Value"}
              {isRequired && <span className="ml-1 text-red-500">*</span>}
            </span>
            {valueType === "boolean" ? (
              <select
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : valueType === "array" || valueType === "object" ? (
              <textarea
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                rows={6}
                placeholder={valueType === "array" ? '["item1", "item2"]' : '{"key": "value"}'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
                required
              />
            ) : (
              <input
                type={valueType === "number" ? "number" : "text"}
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                placeholder={valueType === "number" ? "0" : "Enter value"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                required
              />
            )}
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div className="font-semibold">{error}</div>
              {validationErrors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : isEditing ? "Update" : "Add"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-70"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
