"use client";

import { useEffect, useMemo, useState } from "react";
import type { AutomationWebhookConfig, AutomationSendStrategy, AutomationWebhookHeader } from "@/lib/workflows/automation/types";

const DEFAULT_WEBHOOK: Required<Omit<AutomationWebhookConfig, "delayMinutes">> & { delayMinutes: number | null } = {
  url: "https://example.com/webhooks/workflow",
  method: "POST",
  headers: [{ key: "Content-Type", value: "application/json" }],
  payloadTemplate: JSON.stringify(
    {
      matterId: "{{matter.id}}",
      stepId: "{{step.id}}",
      status: "{{step.actionState}}",
    },
    null,
    2,
  ),
  sendStrategy: "IMMEDIATE",
  delayMinutes: null,
};

type AutomationWebhookConfigFormProps = {
  initialConfig: AutomationWebhookConfig;
  onChange: (config: AutomationWebhookConfig) => void;
};

const HTTP_METHODS: Array<AutomationWebhookConfig["method"]> = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function sanitizeHeaders(headers: AutomationWebhookHeader[]): AutomationWebhookHeader[] {
  return headers.filter((header) => header.key.trim() !== "");
}

export function AutomationWebhookConfigForm({ initialConfig, onChange }: AutomationWebhookConfigFormProps) {
  const [url, setUrl] = useState(initialConfig.url ?? DEFAULT_WEBHOOK.url);
  const [method, setMethod] = useState<AutomationWebhookConfig["method"]>(initialConfig.method ?? DEFAULT_WEBHOOK.method);
  const [headers, setHeaders] = useState<AutomationWebhookHeader[]>(
    initialConfig.headers?.length ? initialConfig.headers : DEFAULT_WEBHOOK.headers,
  );
  const [payload, setPayload] = useState(initialConfig.payloadTemplate ?? DEFAULT_WEBHOOK.payloadTemplate);
  const [sendStrategy, setSendStrategy] = useState<AutomationSendStrategy>(initialConfig.sendStrategy ?? DEFAULT_WEBHOOK.sendStrategy);
  const [delayMinutes, setDelayMinutes] = useState(
    initialConfig.delayMinutes?.toString() ?? (initialConfig.sendStrategy === "DELAYED" ? "5" : ""),
  );

  useEffect(() => {
    onChange({
      url: url.trim(),
      method: method ?? DEFAULT_WEBHOOK.method,
      headers: sanitizeHeaders(headers.map((header) => ({ key: header.key.trim(), value: header.value }))),
      payloadTemplate: payload,
      sendStrategy,
      delayMinutes: sendStrategy === "DELAYED" ? Number(delayMinutes || 0) || null : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, headers, payload, sendStrategy, delayMinutes]);

  const headerRows = useMemo(() => headers, [headers]);

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    setHeaders((prev) => prev.map((header, idx) => (idx === index ? { ...header, [field]: value } : header)));
  };

  const addHeaderRow = () => {
    setHeaders((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeHeaderRow = (index: number) => {
    setHeaders((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Request URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder="https://example.com/webhooks/workflow"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            HTTP Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as AutomationWebhookConfig["method"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          >
            {HTTP_METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase">Headers</label>
          <button
            type="button"
            onClick={addHeaderRow}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            + Add header
          </button>
        </div>
        <div className="space-y-2">
          {headerRows.map((header, index) => (
            <div key={`${header.key}-${index}`} className="grid grid-cols-12 gap-2">
              <input
                value={header.key}
                onChange={(e) => updateHeader(index, "key", e.target.value)}
                className="col-span-5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                placeholder="Header name"
              />
              <input
                value={header.value}
                onChange={(e) => updateHeader(index, "value", e.target.value)}
                className="col-span-6 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                placeholder="Header value"
              />
              <button
                type="button"
                onClick={() => removeHeaderRow(index)}
                className="col-span-1 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 text-xs"
                aria-label="Remove header"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          Payload Template
        </label>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          placeholder='{"matterId": "{{matter.id}}"}'
        />
        <p className="mt-1 text-[11px] text-slate-500">Will be rendered before sending the webhook. Use JSON for POST/PUT/PATCH.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Send Strategy
          </label>
          <select
            value={sendStrategy}
            onChange={(e) => setSendStrategy(e.target.value as AutomationSendStrategy)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          >
            <option value="IMMEDIATE">Immediately</option>
            <option value="DELAYED">Delay after step readiness</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Delay (minutes)
          </label>
          <input
            type="number"
            min={1}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
            disabled={sendStrategy === "IMMEDIATE"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            placeholder="e.g., 5"
          />
          <p className="mt-1 text-[11px] text-slate-500">Only applied for delayed webhooks.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Preview</p>
        <div className="text-xs text-slate-700 space-y-2">
          <p>
            <span className="font-semibold">Method:</span> {method}
          </p>
          <p>
            <span className="font-semibold">URL:</span> {url || "—"}
          </p>
          <div>
            <span className="font-semibold">Headers</span>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {sanitizeHeaders(headerRows).map((header, idx) => (
                <li key={`${header.key}-${idx}`}>
                  {header.key}: <span className="text-slate-500">{header.value || "—"}</span>
                </li>
              ))}
              {sanitizeHeaders(headerRows).length === 0 && <li className="text-slate-400 italic">No headers</li>}
            </ul>
          </div>
          <div>
            <span className="font-semibold">Payload:</span>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] text-slate-700 border border-slate-200">
              {payload}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
