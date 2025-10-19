/**
 * Type definitions for conditional workflow UI components
 */

export type ConditionType = "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";

export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "in"
  | "notIn"
  | "exists"
  | "isEmpty"
  | "isNotEmpty";

export interface SimpleCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface CompoundCondition {
  operator: "AND" | "OR";
  conditions: (SimpleCondition | CompoundCondition)[];
}

export type ConditionConfig = SimpleCondition | CompoundCondition;

export function isCompoundCondition(config: ConditionConfig): config is CompoundCondition {
  return "conditions" in config && Array.isArray(config.conditions);
}

export function isSimpleCondition(config: ConditionConfig): config is SimpleCondition {
  return "field" in config && "operator" in config;
}

// Operator metadata for UI display
export const OPERATORS: Array<{
  value: ConditionOperator;
  label: string;
  requiresValue: boolean;
  description: string;
  category: "comparison" | "string" | "array" | "existence";
}> = [
  // Comparison operators
  { value: "==", label: "equals", requiresValue: true, description: "Field equals value", category: "comparison" },
  { value: "!=", label: "not equals", requiresValue: true, description: "Field does not equal value", category: "comparison" },
  { value: ">", label: "greater than", requiresValue: true, description: "Field is greater than value", category: "comparison" },
  { value: "<", label: "less than", requiresValue: true, description: "Field is less than value", category: "comparison" },
  { value: ">=", label: "greater or equal", requiresValue: true, description: "Field is greater than or equal to value", category: "comparison" },
  { value: "<=", label: "less or equal", requiresValue: true, description: "Field is less than or equal to value", category: "comparison" },
  
  // String operators
  { value: "contains", label: "contains", requiresValue: true, description: "Field contains substring", category: "string" },
  { value: "startsWith", label: "starts with", requiresValue: true, description: "Field starts with value", category: "string" },
  { value: "endsWith", label: "ends with", requiresValue: true, description: "Field ends with value", category: "string" },
  
  // Array operators
  { value: "in", label: "in list", requiresValue: true, description: "Field value is in the list", category: "array" },
  { value: "notIn", label: "not in list", requiresValue: true, description: "Field value is not in the list", category: "array" },
  
  // Existence operators
  { value: "exists", label: "exists", requiresValue: false, description: "Field exists (not null/undefined)", category: "existence" },
  { value: "isEmpty", label: "is empty", requiresValue: false, description: "Field is empty (null/undefined/'')", category: "existence" },
  { value: "isNotEmpty", label: "is not empty", requiresValue: false, description: "Field is not empty", category: "existence" },
];

// Common workflow context fields for autocomplete
export const WORKFLOW_CONTEXT_FIELDS: Array<{
  field: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
}> = [
  { field: "contactType", label: "Contact Type", description: "Type of contact (LEAD, CLIENT, etc.)", type: "string" },
  { field: "matterType", label: "Matter Type", description: "Type of matter/case", type: "string" },
  { field: "contactEmail", label: "Contact Email", description: "Email address of contact", type: "string" },
  { field: "contactPhone", label: "Contact Phone", description: "Phone number of contact", type: "string" },
  { field: "matterStatus", label: "Matter Status", description: "Current matter status", type: "string" },
  { field: "approvalDecision", label: "Approval Decision", description: "Result of approval step (APPROVED/REJECTED)", type: "string" },
  { field: "paymentStatus", label: "Payment Status", description: "Payment status (PENDING/COMPLETED/FAILED)", type: "string" },
  { field: "documentCount", label: "Document Count", description: "Number of documents collected", type: "number" },
  { field: "isUrgent", label: "Is Urgent", description: "Whether matter is marked urgent", type: "boolean" },
  { field: "tags", label: "Tags", description: "Tags associated with contact/matter", type: "array" },
];
