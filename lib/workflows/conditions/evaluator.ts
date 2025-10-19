/**
 * Workflow Conditional Logic - Evaluator Engine
 * 
 * Evaluates conditions against workflow runtime context.
 * Supports simple and compound conditions with various operators.
 */

import type { WorkflowInstance } from "@prisma/client";
import type { WorkflowRuntimeContext } from "../types";
import type {
  ConditionConfig,
  ConditionOperator,
  ConditionResult,
  SimpleConditionConfig,
  CompoundConditionConfig,
  ConditionContext,
} from "./types";
import { ConditionEvaluationError, ConditionValidationError } from "./types";

export class ConditionEvaluator {
  /**
   * Evaluate a condition against workflow context
   * 
   * @param condition - The condition configuration to evaluate
   * @param context - The workflow runtime context
   * @returns ConditionResult with success flag and boolean value
   */
  static evaluate(condition: ConditionConfig, context: WorkflowRuntimeContext): ConditionResult {
    try {
      this.validateCondition(condition);
      const conditionContext = this.buildConditionContext(context);
      const value = this.evaluateCondition(condition, conditionContext);
      
      return {
        success: true,
        value,
      };
    } catch (error) {
      if (error instanceof ConditionValidationError || error instanceof ConditionEvaluationError) {
        return {
          success: false,
          value: false,
          error: error.message,
        };
      }
      
      return {
        success: false,
        value: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Validate condition configuration
   */
  private static validateCondition(condition: ConditionConfig): void {
    if (!condition || typeof condition !== "object") {
      throw new ConditionValidationError("Condition must be an object");
    }

    if (condition.type === "simple") {
      this.validateSimpleCondition(condition);
    } else if (condition.type === "compound") {
      this.validateCompoundCondition(condition);
    } else {
      throw new ConditionValidationError(`Unknown condition type: ${(condition as { type: string }).type}`);
    }
  }

  /**
   * Validate simple condition
   */
  private static validateSimpleCondition(condition: SimpleConditionConfig): void {
    if (!condition.field || typeof condition.field !== "string") {
      throw new ConditionValidationError("Simple condition must have a 'field' string");
    }

    if (!condition.operator) {
      throw new ConditionValidationError("Simple condition must have an 'operator'");
    }

    // Value is optional for existence operators
    const noValueOperators: ConditionOperator[] = ["exists", "notExists", "isEmpty", "isNotEmpty"];
    if (!noValueOperators.includes(condition.operator) && condition.value === undefined) {
      throw new ConditionValidationError(
        `Operator '${condition.operator}' requires a 'value' to be specified`
      );
    }
  }

  /**
   * Validate compound condition
   */
  private static validateCompoundCondition(condition: CompoundConditionConfig): void {
    if (!condition.logic || !["AND", "OR"].includes(condition.logic)) {
      throw new ConditionValidationError("Compound condition must have logic 'AND' or 'OR'");
    }

    if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) {
      throw new ConditionValidationError(
        "Compound condition must have a non-empty 'conditions' array"
      );
    }

    // Recursively validate nested conditions
    for (const nestedCondition of condition.conditions) {
      this.validateCondition(nestedCondition);
    }
  }

  /**
   * Build condition context from workflow runtime context
   */
  private static buildConditionContext(context: WorkflowRuntimeContext): ConditionContext {
    // TypeScript note: contactId might not be in type yet but exists in DB
    const instance = context.instance as WorkflowInstance & { contactId?: string | null };
    
    return {
      workflow: {
        context: context.context || {},
        instance: {
          id: context.instance.id,
          status: context.instance.status,
          createdAt: context.instance.createdAt,
        },
      },
      step: {
        data: context.step.actionData,
        order: context.step.order,
        actionType: context.step.actionType,
      },
      matter: context.instance.matterId
        ? {
            id: context.instance.matterId,
            status: "ACTIVE", // Would need to fetch from DB
            type: undefined,
          }
        : undefined,
      contact: instance.contactId
        ? {
            id: instance.contactId,
            type: "LEAD", // Would need to fetch from DB
            status: "ACTIVE",
          }
        : undefined,
    };
  }

  /**
   * Evaluate condition (simple or compound)
   */
  private static evaluateCondition(
    condition: ConditionConfig,
    context: ConditionContext
  ): boolean {
    if (condition.type === "simple") {
      return this.evaluateSimple(condition, context);
    }

    if (condition.type === "compound") {
      return this.evaluateCompound(condition, context);
    }

    throw new ConditionEvaluationError(`Unknown condition type: ${(condition as { type: string }).type}`);
  }

  /**
   * Evaluate simple condition
   */
  private static evaluateSimple(
    condition: SimpleConditionConfig,
    context: ConditionContext
  ): boolean {
    const fieldValue = this.resolveField(condition.field, context);
    const compareValue = condition.value;

    try {
      return this.applyOperator(condition.operator, fieldValue, compareValue);
    } catch (error) {
      throw new ConditionEvaluationError(
        `Error evaluating operator '${condition.operator}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Apply operator to field value and comparison value
   */
  private static applyOperator(
    operator: ConditionOperator,
    fieldValue: unknown,
    compareValue: unknown
  ): boolean {
    switch (operator) {
      case "==":
        return fieldValue === compareValue;

      case "!=":
        return fieldValue !== compareValue;

      case ">":
        if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
          throw new Error("Operator '>' requires numeric values");
        }
        return fieldValue > compareValue;

      case "<":
        if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
          throw new Error("Operator '<' requires numeric values");
        }
        return fieldValue < compareValue;

      case ">=":
        if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
          throw new Error("Operator '>=' requires numeric values");
        }
        return fieldValue >= compareValue;

      case "<=":
        if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
          throw new Error("Operator '<=' requires numeric values");
        }
        return fieldValue <= compareValue;

      case "contains":
        return String(fieldValue).includes(String(compareValue));

      case "startsWith":
        return String(fieldValue).startsWith(String(compareValue));

      case "endsWith":
        return String(fieldValue).endsWith(String(compareValue));

      case "in":
        if (!Array.isArray(compareValue)) {
          throw new Error("Operator 'in' requires an array as comparison value");
        }
        return compareValue.includes(fieldValue);

      case "notIn":
        if (!Array.isArray(compareValue)) {
          throw new Error("Operator 'notIn' requires an array as comparison value");
        }
        return !compareValue.includes(fieldValue);

      case "exists":
        return fieldValue !== undefined && fieldValue !== null;

      case "notExists":
        return fieldValue === undefined || fieldValue === null;

      case "isEmpty":
        if (fieldValue === undefined || fieldValue === null) return true;
        if (typeof fieldValue === "string") return fieldValue.length === 0;
        if (Array.isArray(fieldValue)) return fieldValue.length === 0;
        if (typeof fieldValue === "object") return Object.keys(fieldValue).length === 0;
        return false;

      case "isNotEmpty":
        if (fieldValue === undefined || fieldValue === null) return false;
        if (typeof fieldValue === "string") return fieldValue.length > 0;
        if (Array.isArray(fieldValue)) return fieldValue.length > 0;
        if (typeof fieldValue === "object") return Object.keys(fieldValue).length > 0;
        return true;

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Resolve field path from context
   * Supports: "workflow.context.fieldName", "step.data.fieldName", etc.
   * 
   * @param fieldPath - Dot notation path to field
   * @param context - Condition context
   * @returns The field value or undefined if not found
   */
  private static resolveField(fieldPath: string, context: ConditionContext): unknown {
    const parts = fieldPath.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = context;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Evaluate compound condition (AND/OR logic)
   */
  private static evaluateCompound(
    condition: CompoundConditionConfig,
    context: ConditionContext
  ): boolean {
    if (!condition.conditions || condition.conditions.length === 0) {
      return true; // Empty compound condition is true
    }

    const results = condition.conditions.map((c) => this.evaluateCondition(c, context));

    if (condition.logic === "AND") {
      return results.every((r) => r === true);
    }

    if (condition.logic === "OR") {
      return results.some((r) => r === true);
    }

    throw new ConditionEvaluationError(`Unknown logic: ${condition.logic}`);
  }
}
