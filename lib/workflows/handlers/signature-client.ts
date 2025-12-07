import { randomUUID } from "crypto";
import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  documentId: z.string().min(1, "documentId is required").optional(),
  provider: z.enum(["mock", "stripe", "docusign"]).default("mock").optional(),
});

type SignatureConfig = z.infer<typeof configSchema>;
type SignatureData = {
  sessionId?: string;
  provider?: string;
  completedAt?: string;
};

export class SignatureActionHandler implements IActionHandler<SignatureConfig, SignatureData> {
  readonly type = ActionType.SIGNATURE;

  validateConfig(config: SignatureConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>): boolean {
    // Signature requests must be completed by clients
    if (!ctx.actor) {
      return false;
    }

    // Admins can test/complete any signature action
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // Only clients can complete signature requests
    // The roleScope should be CLIENT for this action type
    if (ctx.step.roleScope === RoleScope.CLIENT && ctx.actor.role === Role.CLIENT) {
      return true;
    }

    // Lawyers and paralegals cannot complete client signatures
    return false;
  }

  async start(ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>): Promise<ActionState> {
    const config = configSchema.parse(ctx.config ?? {});
    
    // For starting, documentId is optional - it can be selected later
    // Only validate documentId when completing the signature
    let documentId = config.documentId;
    if (!documentId && ctx.instance.matterId) {
      // Try to find a document, but don't fail if none exists
      const document = await ctx.tx.document.findFirst({
        where: {
          matterId: ctx.instance.matterId,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" }, // Get the most recent document
      });
      if (document) {
        documentId = document.id;
        // Update the config with the found documentId for future use
        ctx.config = { ...config, documentId };
      }
    }
    
    // Document is optional for starting - user can select/upload later
    ctx.data.sessionId = ctx.data.sessionId ?? `sig_${randomUUID()}`;
    ctx.data.provider = config.provider ?? "mock";
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    payload?: unknown,
  ): Promise<ActionState> {
    if (payload && typeof payload !== "object") {
      throw new ActionHandlerError("Signature completion payload must be an object", "INVALID_PAYLOAD");
    }
    
    // Validate that we have a documentId for completion
    const config = configSchema.parse(ctx.config ?? {});
    if (!config.documentId) {
      throw new ActionHandlerError("A document must be selected before completing the signature.", "MISSING_DOCUMENT");
    }
    
    ctx.data.completedAt = ctx.now.toISOString();

    // Update workflow context
    ctx.updateContext({
      signatureCompleted: true,
      signedBy: ctx.actor?.id,
      signedAt: ctx.now.toISOString(),
      documentId: config.documentId,
    });

    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    event: import("../types").ActionEvent,
  ): ActionState | null {
    if (event.type === "SIGNATURE_COMPLETED") {
      ctx.data.completedAt = ctx.now.toISOString();
      return ActionState.COMPLETED;
    }
    if (event.type === "SIGNATURE_FAILED") {
      return ActionState.FAILED;
    }
    return null;
  }
}
