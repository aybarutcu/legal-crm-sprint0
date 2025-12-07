"use client";

import { useEffect, useMemo, useState } from "react";
import type { AutomationEmailConfig, AutomationSendStrategy } from "@/lib/workflows/automation/types";

const DEFAULTS: Required<Omit<AutomationEmailConfig, "delayMinutes">> & { delayMinutes: number | null } = {
  recipients: ["{{contact.email}}"],
  cc: [],
  subjectTemplate: "Workflow update for {{matter.title}}",
  bodyTemplate:
    "Hello {{contact.firstName}},\n\nThis is an automated update for {{matter.title}}.\n\nBest regards,\n{{firm.name}}",
  sendStrategy: "IMMEDIATE",
  delayMinutes: null,
};

type AutomationEmailConfigFormProps = {
  initialConfig: AutomationEmailConfig;
  onChange: (config: AutomationEmailConfig) => void;
};

const SEND_STRATEGIES: Array<{ value: AutomationSendStrategy; label: string }> = [
  { value: "IMMEDIATE", label: "Immediately when step becomes ready" },
  { value: "DELAYED", label: "Delay after dependencies complete" },
] as const;

function normalizeList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function AutomationEmailConfigForm({ initialConfig, onChange }: AutomationEmailConfigFormProps) {
  const [recipients, setRecipients] = useState(normalizeList((initialConfig.recipients || DEFAULTS.recipients).join(", ")).join(", "));
  const [cc, setCc] = useState((initialConfig.cc || []).join(", "));
  const [subject, setSubject] = useState(initialConfig.subjectTemplate ?? DEFAULTS.subjectTemplate);
  const [body, setBody] = useState(initialConfig.bodyTemplate ?? DEFAULTS.bodyTemplate);
  const [sendStrategy, setSendStrategy] = useState<AutomationSendStrategy>(initialConfig.sendStrategy ?? DEFAULTS.sendStrategy);
  const [delayMinutes, setDelayMinutes] = useState(
    initialConfig.delayMinutes?.toString() ?? (initialConfig.sendStrategy === "DELAYED" ? "15" : ""),
  );

  useEffect(() => {
    onChange({
      recipients: normalizeList(recipients) || DEFAULTS.recipients,
      cc: normalizeList(cc),
      subjectTemplate: subject.trim() || DEFAULTS.subjectTemplate,
      bodyTemplate: body,
      sendStrategy,
      delayMinutes: sendStrategy === "DELAYED" ? Number(delayMinutes || 0) || null : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients, cc, subject, body, sendStrategy, delayMinutes]);

  const previewRecipients = useMemo(() => normalizeList(recipients), [recipients]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          Recipients
        </label>
        <textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          placeholder="client@domain.com, {{contact.email}}"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Accepts comma or newline-separated addresses or template tokens (e.g., {'{{contact.email}}'}).
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          CC (optional)
        </label>
        <textarea
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          placeholder="{{matter.owner.email}}"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          Subject Template
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          placeholder="Subject with {{tokens}}"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          Body Template
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          placeholder="Use Handlebars-like tokens such as {{contact.firstName}}"
        />
        <p className="mt-1 text-[11px] text-slate-500">Supports simple moustache tokens resolved at runtime.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Send Strategy
          </label>
          <select
            value={sendStrategy}
            onChange={(e) => setSendStrategy(e.target.value as AutomationSendStrategy)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {SEND_STRATEGIES.map((strategy) => (
              <option key={strategy.value} value={strategy.value}>
                {strategy.label}
              </option>
            ))}
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
            placeholder="e.g., 15"
          />
          <p className="mt-1 text-[11px] text-slate-500">Only used when the strategy is set to delayed delivery.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Preview</p>
        <div className="space-y-1 text-sm">
          <p className="text-slate-700">
            <span className="font-semibold">To:</span> {previewRecipients.length > 0 ? previewRecipients.join(", ") : "—"}
          </p>
          {cc && (
            <p className="text-slate-600">
              <span className="font-semibold">CC:</span> {cc}
            </p>
          )}
          <p className="text-slate-700">
            <span className="font-semibold">Subject:</span> {subject || "—"}
          </p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">
            {body || "Email body preview"}
          </pre>
        </div>
      </div>
    </div>
  );
}
