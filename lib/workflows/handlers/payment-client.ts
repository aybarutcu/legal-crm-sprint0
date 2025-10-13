import { randomUUID } from "crypto";
import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";

const configSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().min(3).max(10),
  provider: z.enum(["mock", "stripe"]).default("mock").optional(),
});

type PaymentConfig = z.infer<typeof configSchema>;
type PaymentData = {
  intentId?: string;
  provider?: string;
  paidAt?: string;
};

export class PaymentActionHandler implements IActionHandler<PaymentConfig, PaymentData> {
  readonly type = ActionType.PAYMENT_CLIENT;

  validateConfig(config: PaymentConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(_ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>): boolean {
    return true;
  }

  async start(ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>): Promise<ActionState> {
    const config = configSchema.parse(ctx.config ?? {});
    ctx.data.intentId = ctx.data.intentId ?? `pay_${randomUUID()}`;
    ctx.data.provider = config.provider ?? "mock";
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>,
    payload?: unknown,
  ): Promise<ActionState> {
    if (payload && typeof payload === "object") {
      const paidAt = (payload as Record<string, unknown>).paidAt;
      if (typeof paidAt === "string") {
        ctx.data.paidAt = paidAt;
      }
    }
    ctx.data.paidAt = ctx.data.paidAt ?? ctx.now.toISOString();
    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>,
    event,
  ): ActionState | null {
    if (event.type === "PAYMENT_SUCCEEDED") {
      ctx.data.paidAt = ctx.now.toISOString();
      return ActionState.COMPLETED;
    }
    if (event.type === "PAYMENT_FAILED") {
      return ActionState.FAILED;
    }
    return null;
  }
}
