import { withApiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWorkflowDependencies } from "@/lib/workflows/dependency-resolver";
import { ActionType, DependencyLogic, Role, WorkflowInstanceStep, WorkflowInstanceDependency, DependencyType } from "@prisma/client";

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
      // Add minimal required fields for validation
      actionState: "PENDING" as const,
      actionType: step.actionType,
      roleScope: step.roleScope,
      actionConfig: {},
      actionData: {},
      instanceId: "dummy",
      order: step.order,
      createdAt: new Date(),
      updatedAt: new Date(),
      templateStepId: null,
      required: true,
      notificationPolicies: [],
      automationLog: [],
      dependsOn: [],
      dependencyLogic: "ALL" as const,
      nextStepOnTrue: null,
      nextStepOnFalse: null,
      positionX: 0,
      positionY: 0,
      notes: null,
      notificationLog: [],
      assignedToId: null,
      dueDate: null,
      completedAt: null,
    })) as unknown as WorkflowInstanceStep[];

    // Create dependencies from dependsOn arrays
    const dependenciesForValidation = [] as WorkflowInstanceDependency[];
    validated.steps.forEach((step) => {
      const targetStepId = `step-${step.order}`;
      (step.dependsOn || []).forEach((sourceOrder) => {
        const sourceStepId = `step-${sourceOrder}`;
        dependenciesForValidation.push({
          id: `dep-${sourceOrder}-${step.order}`,
          instanceId: "dummy",
          sourceStepId,
          targetStepId,
          dependencyType: "DEPENDS_ON" as const,
          dependencyLogic: "ALL" as const,
          conditionType: null,
          conditionConfig: null,
        } as WorkflowInstanceDependency);
      });
    });

    // Validate dependencies
    const validationResult = validateWorkflowDependencies(stepsForValidation, dependenciesForValidation);

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
