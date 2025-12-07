export type NotificationChannel = "EMAIL" | "SMS" | "PUSH";
export type NotificationTrigger = "ON_READY" | "ON_COMPLETED" | "ON_FAILED";
export type NotificationSendStrategy = "IMMEDIATE" | "DELAYED";

export type NotificationPolicy = {
  id?: string;
  channel: NotificationChannel;
  triggers: NotificationTrigger[];
  recipients: string[];
  cc?: string[];
  subjectTemplate?: string;
  bodyTemplate?: string;
  templateId?: string | null;
  sendStrategy?: NotificationSendStrategy;
  delayMinutes?: number | null;
};
