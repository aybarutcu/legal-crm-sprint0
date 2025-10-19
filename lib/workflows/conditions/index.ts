/**
 * Workflow Conditional Logic - Public API
 * 
 * Export all public types and the evaluator engine.
 */

export { ConditionEvaluator } from "./evaluator";
export type {
  ConditionOperator,
  ConditionConfig,
  SimpleConditionConfig,
  CompoundConditionConfig,
  ConditionResult,
  ConditionContext,
} from "./types";
export { ConditionValidationError, ConditionEvaluationError } from "./types";
