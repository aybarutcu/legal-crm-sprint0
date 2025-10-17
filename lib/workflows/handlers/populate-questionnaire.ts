import { ActionState, ActionType, Role } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  questionnaireId: z.string().min(1, "Questionnaire ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  dueInDays: z.number().int().min(0).optional(),
});

const completePayloadSchema = z.object({
  responseId: z.string().min(1, "Response ID is required"),
});

export type PopulateQuestionnaireConfig = z.infer<typeof configSchema>;
export type PopulateQuestionnaireData = {
  responseId?: string;
  questionnaireId?: string;
  questionnaireTitle?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  answerCount?: number;
};

/**
 * PopulateQuestionnaireActionHandler
 * 
 * Allows assigned users to complete a questionnaire as part of a workflow step.
 * The questionnaire must be created first via the questionnaire management APIs.
 * 
 * Configuration:
 * - questionnaireId: The ID of the questionnaire to complete
 * - title: The title/prompt for this workflow step (e.g., "Complete Client Intake Form")
 * - description: Additional guidance for completing the questionnaire
 * - dueInDays: Number of days from step start until due (optional)
 * 
 * Complete Payload:
 * - responseId: The ID of the completed questionnaire response
 * 
 * Data stored:
 * - responseId: The questionnaire response ID
 * - questionnaireId: The questionnaire template ID
 * - questionnaireTitle: The questionnaire title
 * - startedAt: ISO timestamp when response started
 * - completedAt: ISO timestamp when response completed
 * - completedBy: User ID who completed the questionnaire
 * - answerCount: Number of answers provided
 * 
 * Workflow Context Updates:
 * - questionnaire_<stepId>: Full questionnaire completion data
 * - questionnaire_<stepId>_responseId: Response ID for easy access
 * - questionnaire_<stepId>_answers: Array of answers for template use
 */
export class PopulateQuestionnaireActionHandler implements IActionHandler<PopulateQuestionnaireConfig, PopulateQuestionnaireData> {
  readonly type = ActionType.POPULATE_QUESTIONNAIRE;

  validateConfig(config: PopulateQuestionnaireConfig): void {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new ActionHandlerError(
        `Invalid POPULATE_QUESTIONNAIRE config: ${parsed.error.message}`,
        "INVALID_CONFIG"
      );
    }
  }

  canStart(ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>): boolean {
    // Questionnaire completion can be performed by anyone assigned based on roleScope
    if (!ctx.actor) {
      return false;
    }

    // Admins can always complete questionnaires
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // For other roles, rely on the roleScope validation done in ensureActorCanPerform
    return true;
  }

  async start(ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>): Promise<ActionState> {
    // Validate that the questionnaire exists and is active
    const questionnaire = await ctx.tx.questionnaire.findFirst({
      where: {
        id: ctx.config.questionnaireId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!questionnaire) {
      throw new ActionHandlerError(
        `Questionnaire ${ctx.config.questionnaireId} not found or inactive`,
        "QUESTIONNAIRE_NOT_FOUND"
      );
    }

    // Store questionnaire info
    ctx.data.questionnaireId = questionnaire.id;
    ctx.data.questionnaireTitle = questionnaire.title;

    // When the step starts, it goes into IN_PROGRESS state
    // User can now navigate to complete the questionnaire
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
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

    const { responseId } = parsed.data;

    // Fetch the response with full details
    const response = await ctx.tx.questionnaireResponse.findUnique({
      where: { id: responseId },
      include: {
        questionnaire: {
          select: {
            id: true,
            title: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                questionType: true,
              },
            },
          },
          orderBy: {
            question: {
              order: 'asc',
            },
          },
        },
      },
    });

    if (!response) {
      throw new ActionHandlerError(
        `Questionnaire response ${responseId} not found`,
        "RESPONSE_NOT_FOUND"
      );
    }

    // Verify the response is for the correct questionnaire
    if (response.questionnaireId !== ctx.config.questionnaireId) {
      throw new ActionHandlerError(
        `Response is for questionnaire ${response.questionnaireId}, expected ${ctx.config.questionnaireId}`,
        "QUESTIONNAIRE_MISMATCH"
      );
    }

    // Verify the response is completed
    if (response.status !== "COMPLETED") {
      throw new ActionHandlerError(
        `Response ${responseId} is not completed (status: ${response.status})`,
        "RESPONSE_NOT_COMPLETED"
      );
    }

    // Verify the actor is the respondent (or admin)
    if (ctx.actor?.role !== Role.ADMIN && response.respondentId !== ctx.actor?.id) {
      throw new ActionHandlerError(
        "Only the respondent can complete this step with their response",
        "UNAUTHORIZED"
      );
    }

    // Store the data
    ctx.data.responseId = response.id;
    ctx.data.questionnaireId = response.questionnaire.id;
    ctx.data.questionnaireTitle = response.questionnaire.title;
    ctx.data.startedAt = response.startedAt.toISOString();
    ctx.data.completedAt = response.completedAt?.toISOString();
    ctx.data.completedBy = response.respondentId;
    ctx.data.answerCount = response.answers.length;

    // Update workflow context with questionnaire data
    // This makes the answers available to subsequent workflow steps
    const contextKey = `questionnaire_${ctx.step.id}`;
    
    // Format answers for easy consumption in templates
    const formattedAnswers = response.answers.map((answer) => ({
      questionId: answer.question.id,
      questionText: answer.question.questionText,
      questionType: answer.question.questionType,
      answerText: answer.answerText,
      answerJson: answer.answerJson as unknown,
    }));

    ctx.updateContext({
      [contextKey]: {
        title: ctx.config.title,
        questionnaireId: response.questionnaire.id,
        questionnaireTitle: response.questionnaire.title,
        responseId: response.id,
        startedAt: ctx.data.startedAt,
        completedAt: ctx.data.completedAt,
        completedBy: ctx.data.completedBy,
        answerCount: ctx.data.answerCount,
        answers: formattedAnswers,
      },
      // Also add direct references for easy access
      [`${contextKey}_responseId`]: response.id,
      [`${contextKey}_answers`]: formattedAnswers,
    });

    return ActionState.COMPLETED;
  }

  async fail(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
    _reason: string,
  ): Promise<ActionState> {
    // Store the failure reason
    ctx.data.completedAt = ctx.now.toISOString();
    ctx.data.completedBy = ctx.actor?.id;

    return ActionState.FAILED;
  }

  async skip(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
  ): Promise<ActionState> {
    // Mark as skipped
    ctx.data.completedAt = ctx.now.toISOString();

    return ActionState.SKIPPED;
  }

  getNextStateOnEvent(): ActionState | null {
    // Questionnaire completion doesn't use event-based state transitions
    // State changes happen via explicit start/complete/fail calls
    return null;
  }
}
