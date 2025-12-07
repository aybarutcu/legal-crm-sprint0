"use client";

import { TaskConfigForm } from "./TaskConfigForm";
import { ChecklistConfigForm } from "./ChecklistConfigForm";
import { ApprovalConfigForm } from "./ApprovalConfigForm";
import { SignatureConfigForm } from "./SignatureConfigForm";
import { DocumentRequestConfigForm } from "./DocumentRequestConfigForm";
import { PaymentConfigForm } from "./PaymentConfigForm";
import { WriteTextConfigForm } from "./WriteTextConfigForm";
import { PopulateQuestionnaireConfigForm } from "./PopulateQuestionnaireConfigForm";
import { AutomationEmailConfigForm } from "./AutomationEmailConfigForm";
import { AutomationWebhookConfigForm } from "./AutomationWebhookConfigForm";
import type { AutomationEmailConfig, AutomationWebhookConfig } from "@/lib/workflows/automation/types";

export type ActionType =
  | "TASK"
  | "CHECKLIST"
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "AUTOMATION_EMAIL"
  | "AUTOMATION_WEBHOOK";

interface ActionConfigFormProps {
  actionType: ActionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function ActionConfigForm({ actionType, config, onChange }: ActionConfigFormProps) {
  switch (actionType) {
    case "TASK":
      return (
        <TaskConfigForm
          initialConfig={config as { description?: string; requiresEvidence?: boolean; estimatedMinutes?: number }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "CHECKLIST":
      return (
        <ChecklistConfigForm
          initialConfig={config as { items?: string[] }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "APPROVAL":
      return (
        <ApprovalConfigForm
          initialConfig={config as { message?: string; approverRole?: string }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "SIGNATURE":
      return (
        <SignatureConfigForm
          initialConfig={config as { documentId?: string | null; provider?: string }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "REQUEST_DOC":
      return (
        <DocumentRequestConfigForm
          initialConfig={config as { requestText?: string; acceptedFileTypes?: string[] }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "PAYMENT":
      return (
        <PaymentConfigForm
          initialConfig={config as { amount?: number; currency?: string; provider?: string }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "WRITE_TEXT":
      return (
        <WriteTextConfigForm
          initialConfig={config as {
            title?: string;
            description?: string;
            placeholder?: string;
            minLength?: number;
            maxLength?: number;
            required?: boolean;
          }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    case "POPULATE_QUESTIONNAIRE":
      return (
        <PopulateQuestionnaireConfigForm
          initialConfig={config as { questionnaireId?: string | null; title?: string; description?: string; dueInDays?: number }}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );
    case "AUTOMATION_EMAIL":
      return (
        <AutomationEmailConfigForm
          initialConfig={config as AutomationEmailConfig}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );
    case "AUTOMATION_WEBHOOK":
      return (
        <AutomationWebhookConfigForm
          initialConfig={config as AutomationWebhookConfig}
          onChange={(newConfig) => onChange(newConfig)}
        />
      );

    default:
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Bu aksiyon tipi için henüz form desteği eklenmedi.
          </p>
        </div>
      );
  }
}
