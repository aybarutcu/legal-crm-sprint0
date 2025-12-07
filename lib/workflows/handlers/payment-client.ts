import { randomUUID } from "crypto";
import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";

const configSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("USD").optional(),
  provider: z.enum(["mock", "stripe"]).default("mock").optional(),
});

type PaymentConfig = z.infer<typeof configSchema>;
type PaymentData = {
  sessionId?: string;
  provider?: string;
  paidAt?: string;
  intentId?: string;
};

export class PaymentActionHandler implements IActionHandler<PaymentConfig, PaymentData> {
  readonly type = ActionType.PAYMENT;

  validateConfig(config: PaymentConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(ctx: WorkflowRuntimeContext<PaymentConfig, PaymentData>): boolean {
    // Payment actions must be completed by clients
    if (!ctx.actor) {
      return false;
    }

    // Admins can test/complete payment actions
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // Only clients can complete payment requests
    if (ctx.step.roleScope === RoleScope.CLIENT && ctx.actor.role === Role.CLIENT) {
      return true;
    }

    // Lawyers and paralegals cannot complete client payments
    return false;
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

    // Update workflow context
    ctx.updateContext({
      paymentReceived: true,
      paymentAmount: ctx.config.amount,
      paymentCurrency: ctx.config.currency,
      paymentTransactionId: ctx.data.intentId,
      paidBy: ctx.actor?.id,
      paidAt: ctx.data.paidAt,
    });

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
    event: import("../types").ActionEvent,
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
