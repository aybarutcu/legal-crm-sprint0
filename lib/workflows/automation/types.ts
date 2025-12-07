export type AutomationSendStrategy = "IMMEDIATE" | "DELAYED";

export type AutomationEmailConfig = {
  recipients?: string[];
  cc?: string[];
  subjectTemplate?: string;
  bodyTemplate?: string;
  sendStrategy?: AutomationSendStrategy;
  delayMinutes?: number | null;
};

export type AutomationWebhookHeader = { key: string; value?: string };

export type AutomationWebhookConfig = {
  url?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: AutomationWebhookHeader[];
  payloadTemplate?: string;
  sendStrategy?: AutomationSendStrategy;
  delayMinutes?: number | null;
};

export type AutomationRunLogEntry = {
  at: string;
  level?: "INFO" | "WARN" | "ERROR";
  message: string;
  metadata?: Record<string, unknown>;
};

export type AutomationActionData = {
  status?: "PENDING" | "QUEUED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "MANUAL_OVERRIDE";
  runs?: number;
  lastQueuedAt?: string;
  lastExecutionAt?: string;
  lastCompletedAt?: string;
  lastError?: string;
  lastResult?: unknown;
  logs?: AutomationRunLogEntry[];
};
