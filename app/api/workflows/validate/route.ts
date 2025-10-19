import { withApiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWorkflowDependencies } from "@/lib/workflows/dependency-resolver";
import { ActionType, DependencyLogic, Role } from "@prisma/client";

// Validation request schema
const validateRequestSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string().optional(),
      order: z.number().int().min(0),
      title: z.string(),
      actionType: z.nativeEnum(ActionType),
      roleScope: z.nativeEnum(Role),
      dependsOn: z.array(z.number().int().min(0)).optional(),
      dependencyLogic: z.nativeEnum(DependencyLogic).optional(),
    })
  ),
});

type ValidateRequest = z.infer<typeof validateRequestSchema>;

/**
 * POST /api/workflows/validate
 * Validates workflow dependencies for cycles and invalid references
 */
export const POST = withApiHandler<Record<string, never>>(
  async (req) => {
    const body = (await req.json()) as ValidateRequest;
    const validated = validateRequestSchema.parse(body);

    // Convert to format expected by validateWorkflowDependencies
    // Need to use step orders as IDs for template validation (before instance creation)
    const stepsForValidation = validated.steps.map((step) => ({
      id: `step-${step.order}`,
      title: step.title,
      dependsOn: (step.dependsOn || []).map((order) => `step-${order}`),
    }));

    // Validate dependencies
    const validationResult = validateWorkflowDependencies(stepsForValidation);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: validationResult.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Workflow dependencies are valid",
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 100, windowMs: 60000 },
  }
);
