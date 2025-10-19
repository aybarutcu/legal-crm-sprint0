/**
 * Workflow Conditional Logic - Type Definitions
 * 
 * Defines the structure for conditional execution in workflows.
 * Supports simple conditions (field operator value) and compound conditions (AND/OR).
 */

export type ConditionOperator =
  // Equality
  | "=="
  | "!="
  // Comparison (for numbers)
  | ">"
  | "<"
  | ">="
  | "<="
  // String operations
  | "contains"
  | "startsWith"
  | "endsWith"
  // Array operations
  | "in"
  | "notIn"
  // Existence checks
  | "exists"
  | "notExists"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Simple condition configuration
 * Example: { type: "simple", field: "workflow.context.approved", operator: "==", value: true }
 */
export interface SimpleConditionConfig {
  type: "simple";
  field: string; // Dot notation path: "workflow.context.fieldName" or "step.data.fieldName"
  operator: ConditionOperator;
  value?: unknown; // Comparison value (not needed for exists/isEmpty operators)
}

/**
 * Compound condition configuration (AND/OR multiple conditions)
 * Example: { type: "compound", logic: "AND", conditions: [...] }
 */
export interface CompoundConditionConfig {
  type: "compound";
  logic: "AND" | "OR";
  conditions: ConditionConfig[];
}

/**
 * Union type for all condition configurations
 */
export type ConditionConfig = SimpleConditionConfig | CompoundConditionConfig;

/**
 * Condition evaluation result
 */
export interface ConditionResult {
  success: boolean;
  value: boolean; // The actual condition result (true/false)
  error?: string; // Error message if evaluation failed
}

/**
 * Field reference context - what data is available for conditions
 */
export interface ConditionContext {
  workflow: {
    context: Record<string, unknown>; // Workflow shared context
    instance: {
      id: string;
      status: string;
      createdAt: Date;
    };
  };
  step: {
    data: unknown; // Current step's actionData
    order: number;
    actionType: string;
  };
  matter?: {
    id: string;
    status: string;
    type?: string;
  };
  contact?: {
    id: string;
    type: string;
    status: string;
  };
}

/**
 * Validation error for condition configuration
 */
export class ConditionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConditionValidationError";
  }
}

/**
 * Error during condition evaluation
 */
export class ConditionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConditionEvaluationError";
  }
}
