import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import type { AutomationActionData, AutomationEmailConfig, AutomationWebhookConfig, AutomationRunLogEntry } from "../automation/types";

const sendStrategySchema = z.enum(["IMMEDIATE", "DELAYED"]);

const emailConfigSchema = z.object({
  recipients: z.array(z.string().min(1)).nonempty("At least one recipient is required"),
  cc: z.array(z.string().min(1)).optional(),
  subjectTemplate: z.string().min(1, "Subject is required"),
  bodyTemplate: z.string().min(1, "Body template is required"),
  sendStrategy: sendStrategySchema.default("IMMEDIATE"),
  delayMinutes: z.number().int().positive().max(10080).nullable().optional(),
});

const webhookConfigSchema = z.object({
  url: z.string().url("Webhook URL must be valid"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string().optional().default(""),
      }),
    )
    .optional(),
  payloadTemplate: z.string().optional(),
  sendStrategy: sendStrategySchema.default("IMMEDIATE"),
  delayMinutes: z.number().int().positive().max(10080).nullable().optional(),
});

const automationCompletionPayloadSchema = z
  .object({
    status: z.enum(["SUCCEEDED", "FAILED", "MANUAL_OVERRIDE"]).optional(),
    result: z.any().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .optional();

type AutomationCompletionPayload = z.infer<typeof automationCompletionPayloadSchema>;

function appendLog(data: AutomationActionData, entry: AutomationRunLogEntry): void {
  const logs = Array.isArray(data.logs) ? [...data.logs] : [];
  logs.push(entry);
  data.logs = logs.slice(-20);
}

abstract class BaseAutomationActionHandler<TConfig> implements IActionHandler<TConfig, AutomationActionData> {
  constructor(
    readonly type: ActionType,
    private readonly configSchema: z.ZodType<TConfig>,
  ) {}

  validateConfig(config: TConfig): void {
    this.configSchema.parse(config ?? {});
  }

  canStart(): boolean {
    // Automation steps can be started by the system even without a human actor
    return true;
  }

  async start(ctx: WorkflowRuntimeContext<TConfig, AutomationActionData>): Promise<ActionState> {
    ctx.data.status = "QUEUED";
    ctx.data.runs = (ctx.data.runs ?? 0) + 1;
    ctx.data.lastQueuedAt = ctx.now.toISOString();
    appendLog(ctx.data, {
      at: ctx.now.toISOString(),
      level: "INFO",
      message: "Automation job queued",
    });
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<TConfig, AutomationActionData>,
    payload?: unknown,
  ): Promise<ActionState> {
    const parsed = automationCompletionPayloadSchema.parse(payload);
    const status = parsed?.status ?? "SUCCEEDED";
    ctx.data.status = status === "FAILED" ? "FAILED" : status === "MANUAL_OVERRIDE" ? "MANUAL_OVERRIDE" : "SUCCEEDED";
    ctx.data.lastCompletedAt = ctx.now.toISOString();
    if (parsed?.error) {
      ctx.data.lastError = parsed.error;
    }
    if (parsed?.result !== undefined) {
      ctx.data.lastResult = parsed.result;
    }
    appendLog(ctx.data, {
      at: ctx.now.toISOString(),
      level: status === "FAILED" ? "ERROR" : "INFO",
      message: parsed?.message ?? (status === "FAILED" ? "Automation failed" : "Automation completed"),
      metadata: parsed?.result && typeof parsed.result === "object" ? { result: parsed.result } : undefined,
    });
    return status === "FAILED" ? ActionState.FAILED : ActionState.COMPLETED;
  }

  async fail(ctx: WorkflowRuntimeContext<TConfig, AutomationActionData>, reason: string): Promise<ActionState> {
    ctx.data.status = "FAILED";
    ctx.data.lastError = reason;
    appendLog(ctx.data, {
      at: ctx.now.toISOString(),
      level: "ERROR",
      message: reason,
    });
    return ActionState.FAILED;
  }

  getNextStateOnEvent(): ActionState | null {
    return null;
  }
}

export class AutomationEmailActionHandler extends BaseAutomationActionHandler<AutomationEmailConfig> {
  constructor() {
    super(ActionType.AUTOMATION_EMAIL, emailConfigSchema);
  }
}

export class AutomationWebhookActionHandler extends BaseAutomationActionHandler<AutomationWebhookConfig> {
  constructor() {
    super(ActionType.AUTOMATION_WEBHOOK, webhookConfigSchema);
  }
}
