import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { conditionConfigSchema } from "@/lib/validation/workflow";
import { ConditionEvaluator } from "@/lib/workflows/conditions";
import type { ConditionConfig } from "@/lib/workflows/conditions/types";
import { z } from "zod";

/**
 * POST /api/workflows/validate-condition
 * 
 * Validates a condition configuration and optionally tests it against sample context.
 * 
 * This endpoint helps UI developers validate conditions before saving them to templates.
 */

const requestSchema = z.object({
  condition: conditionConfigSchema,
  testContext: z.record(z.unknown()).optional(),
});

export const POST = withApiHandler(
  async (req: NextRequest) => {
    const body = requestSchema.parse(await req.json());

    // Build a minimal runtime context for validation/evaluation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testRuntimeContext: any = {
      tx: {},
      instance: { contextData: body.testContext || {} },
      step: {},
      actor: undefined,
      config: {},
      data: {},
      now: new Date(),
      context: body.testContext || {},
      updateContext: () => {},
    };

    // Validate by attempting to evaluate (ConditionEvaluator.evaluate does validation internally)
    const result = ConditionEvaluator.evaluate(
      body.condition as ConditionConfig,
      testRuntimeContext
    );

    if (!result.success) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error,
          message: "Condition configuration is invalid",
        },
        { status: 400 }
      );
    }

    // If test context provided, include evaluation result
    const response: {
      valid: boolean;
      message: string;
      evaluation?: {
        success: boolean;
        value: boolean;
        error?: string;
      };
    } = {
      valid: true,
      message: "Condition is valid",
    };

    if (body.testContext) {
      response.evaluation = {
        success: result.success,
        value: result.value,
        error: result.error,
      };
    }

    return NextResponse.json(response);
  },
  { requireAuth: true }
);
