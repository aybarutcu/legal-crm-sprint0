import { ActionState, ActionType, Role } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  placeholder: z.string().optional().default("Enter your text here..."),
  minLength: z.number().int().min(0).optional().default(0),
  maxLength: z.number().int().min(1).optional(),
  required: z.boolean().optional().default(true),
});

const completePayloadSchema = z.object({
  content: z.string().min(1, "Text content is required"),
  format: z.enum(["plain", "html"]).optional().default("plain"),
});

export type WriteTextConfig = z.infer<typeof configSchema>;
export type WriteTextData = {
  content?: string;
  format?: "plain" | "html";
  submittedAt?: string;
  submittedBy?: string;
  aiAssisted?: boolean;
  aiPrompt?: string;
};

/**
 * WriteTextActionHandler
 * 
 * Allows assigned users to write text content as part of a workflow step.
 * Supports both plain text and rich text (HTML) formats.
 * 
 * Configuration:
 * - title: The title/prompt for the text to write (e.g., "Draft Initial Response")
 * - description: Additional guidance for what to write
 * - placeholder: Placeholder text for the input field
 * - minLength: Minimum character length (optional)
 * - maxLength: Maximum character length (optional)
 * - required: Whether text is required (default: true)
 * 
 * Complete Payload:
 * - content: The text content written by the user
 * - format: "plain" or "html" (default: "plain")
 * 
 * Data stored:
 * - content: The submitted text
 * - format: The format used
 * - submittedAt: ISO timestamp
 * - submittedBy: User ID who submitted
 * - aiAssisted: Whether AI was used (for future feature)
 * - aiPrompt: The AI prompt used (for future feature)
 */
export class WriteTextActionHandler implements IActionHandler<WriteTextConfig, WriteTextData> {
  readonly type = ActionType.WRITE_TEXT;

  validateConfig(config: WriteTextConfig): void {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new ActionHandlerError(
        `Invalid WRITE_TEXT config: ${parsed.error.message}`,
        "INVALID_CONFIG"
      );
    }

    // Validate that maxLength is greater than minLength if both are set
    if (config.maxLength && config.minLength && config.maxLength < config.minLength) {
      throw new ActionHandlerError(
        "maxLength must be greater than or equal to minLength",
        "INVALID_CONFIG"
      );
    }
  }

  canStart(ctx: WorkflowRuntimeContext<WriteTextConfig, WriteTextData>): boolean {
    // Text writing can be performed by anyone assigned based on roleScope
    if (!ctx.actor) {
      return false;
    }

    // Admins can always perform text writing
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // For other roles, rely on the roleScope validation done in ensureActorCanPerform
    return true;
  }

  async start(_ctx: WorkflowRuntimeContext<WriteTextConfig, WriteTextData>): Promise<ActionState> {
    // When the step starts, it goes into IN_PROGRESS state
    // User can now write their text
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<WriteTextConfig, WriteTextData>,
    payload?: unknown,
  ): Promise<ActionState> {
    // Validate the payload
    const parsed = completePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ActionHandlerError(
        `Invalid completion payload: ${parsed.error.message}`,
        "INVALID_PAYLOAD"
      );
    }

    const { content, format } = parsed.data;

    // Validate length constraints
    const contentLength = content.length;
    if (ctx.config.minLength && contentLength < ctx.config.minLength) {
      throw new ActionHandlerError(
        `Text must be at least ${ctx.config.minLength} characters (current: ${contentLength})`,
        "VALIDATION_ERROR"
      );
    }

    if (ctx.config.maxLength && contentLength > ctx.config.maxLength) {
      throw new ActionHandlerError(
        `Text must not exceed ${ctx.config.maxLength} characters (current: ${contentLength})`,
        "VALIDATION_ERROR"
      );
    }

    // Store the data
    ctx.data.content = content;
    ctx.data.format = format;
    ctx.data.submittedAt = ctx.now.toISOString();
    ctx.data.submittedBy = ctx.actor?.id;

    // Update workflow context with the written text
    // This makes it available to subsequent workflow steps
    const contextKey = `text_${ctx.step.id}`;
    ctx.updateContext({
      [contextKey]: {
        title: ctx.config.title,
        content,
        format,
        length: contentLength,
        submittedAt: ctx.data.submittedAt,
        submittedBy: ctx.data.submittedBy,
      },
      // Also add a simpler reference
      [`${contextKey}_content`]: content,
    });

    return ActionState.COMPLETED;
  }

  async fail(
    ctx: WorkflowRuntimeContext<WriteTextConfig, WriteTextData>,
    reason: string,
  ): Promise<ActionState> {
    // Store the failure reason
    ctx.data.content = `[Failed: ${reason}]`;
    ctx.data.submittedAt = ctx.now.toISOString();
    ctx.data.submittedBy = ctx.actor?.id;

    return ActionState.FAILED;
  }

  async skip(
    ctx: WorkflowRuntimeContext<WriteTextConfig, WriteTextData>,
  ): Promise<ActionState> {
    // Mark as skipped
    ctx.data.content = "[Skipped]";
    ctx.data.submittedAt = ctx.now.toISOString();

    return ActionState.SKIPPED;
  }

  getNextStateOnEvent(): ActionState | null {
    // Text writing doesn't use event-based state transitions
    // State changes happen via explicit start/complete/fail calls
    return null;
  }
}
