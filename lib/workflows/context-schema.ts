/**
 * Context Schema Types
 * 
 * Defines the structure for workflow template context schemas.
 * Schemas define what context fields are expected, their types,
 * validation rules, and default values.
 */

export type ContextFieldType = "string" | "number" | "boolean" | "array" | "object";

export type ContextFieldDefinition = {
  type: ContextFieldType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  
  // String-specific
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern
  
  // Number-specific
  min?: number;
  max?: number;
  
  // Array-specific
  minItems?: number;
  maxItems?: number;
  itemType?: ContextFieldType;
  
  // Object-specific
  properties?: Record<string, ContextFieldDefinition>;
  
  // UI hints
  placeholder?: string;
  helpText?: string;
};

export type ContextSchema = {
  version?: number; // Schema version for migrations
  fields: Record<string, ContextFieldDefinition>;
};

/**
 * Validation result for context values
 */
export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

/**
 * Validate a context value against a field definition
 */
export function validateContextField(
  key: string,
  value: unknown,
  definition: ContextFieldDefinition
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required
  if (definition.required && (value === null || value === undefined || value === "")) {
    errors.push({
      field: key,
      message: `${definition.label} is required`,
      code: "REQUIRED",
    });
    return errors;
  }

  // Skip type validation if value is empty and not required
  if (value === null || value === undefined || value === "") {
    return errors;
  }

  // Type validation
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (actualType !== definition.type) {
    errors.push({
      field: key,
      message: `${definition.label} must be a ${definition.type}`,
      code: "INVALID_TYPE",
    });
    return errors; // Don't continue with other validations if type is wrong
  }

  // String validations
  if (definition.type === "string" && typeof value === "string") {
    if (definition.minLength && value.length < definition.minLength) {
      errors.push({
        field: key,
        message: `${definition.label} must be at least ${definition.minLength} characters`,
        code: "MIN_LENGTH",
      });
    }
    if (definition.maxLength && value.length > definition.maxLength) {
      errors.push({
        field: key,
        message: `${definition.label} must be at most ${definition.maxLength} characters`,
        code: "MAX_LENGTH",
      });
    }
    if (definition.pattern) {
      const regex = new RegExp(definition.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: key,
          message: `${definition.label} format is invalid`,
          code: "INVALID_PATTERN",
        });
      }
    }
  }

  // Number validations
  if (definition.type === "number" && typeof value === "number") {
    if (definition.min !== undefined && value < definition.min) {
      errors.push({
        field: key,
        message: `${definition.label} must be at least ${definition.min}`,
        code: "MIN_VALUE",
      });
    }
    if (definition.max !== undefined && value > definition.max) {
      errors.push({
        field: key,
        message: `${definition.label} must be at most ${definition.max}`,
        code: "MAX_VALUE",
      });
    }
  }

  // Array validations
  if (definition.type === "array" && Array.isArray(value)) {
    if (definition.minItems && value.length < definition.minItems) {
      errors.push({
        field: key,
        message: `${definition.label} must have at least ${definition.minItems} items`,
        code: "MIN_ITEMS",
      });
    }
    if (definition.maxItems && value.length > definition.maxItems) {
      errors.push({
        field: key,
        message: `${definition.label} must have at most ${definition.maxItems} items`,
        code: "MAX_ITEMS",
      });
    }
  }

  return errors;
}

/**
 * Validate an entire context object against a schema
 */
export function validateContext(
  context: Record<string, unknown>,
  schema: ContextSchema
): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Check all defined fields
  for (const [key, definition] of Object.entries(schema.fields)) {
    const value = context[key];
    const fieldErrors = validateContextField(key, value, definition);
    allErrors.push(...fieldErrors);
  }

  // Check for undefined fields (fields in context but not in schema)
  for (const key of Object.keys(context)) {
    if (!schema.fields[key]) {
      allErrors.push({
        field: key,
        message: `Field "${key}" is not defined in schema`,
        code: "UNDEFINED_FIELD",
      });
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Apply default values from schema to context
 */
export function applySchemaDefaults(
  context: Record<string, unknown>,
  schema: ContextSchema
): Record<string, unknown> {
  const result = { ...context };

  for (const [key, definition] of Object.entries(schema.fields)) {
    // Apply default if value is missing
    if (result[key] === undefined && definition.default !== undefined) {
      result[key] = definition.default;
    }
  }

  return result;
}

/**
 * Get all required fields from a schema
 */
export function getRequiredFields(schema: ContextSchema): string[] {
  return Object.entries(schema.fields)
    .filter(([_, def]) => def.required)
    .map(([key, _]) => key);
}

/**
 * Get field definition by key
 */
export function getFieldDefinition(
  schema: ContextSchema,
  key: string
): ContextFieldDefinition | undefined {
  return schema.fields[key];
}

/**
 * Check if a field is required
 */
export function isFieldRequired(schema: ContextSchema, key: string): boolean {
  return schema.fields[key]?.required ?? false;
}

/**
 * Sample schema for documentation/testing
 */
export const SAMPLE_CONTEXT_SCHEMA: ContextSchema = {
  version: 1,
  fields: {
    clientApproved: {
      type: "boolean",
      label: "Client Approved",
      description: "Whether the client has approved the workflow",
      required: true,
      default: false,
      helpText: "Set to true once client approval is received",
    },
    documentCount: {
      type: "number",
      label: "Document Count",
      description: "Number of documents collected",
      required: false,
      default: 0,
      min: 0,
      max: 100,
      helpText: "Total number of documents submitted by client",
    },
    approverName: {
      type: "string",
      label: "Approver Name",
      description: "Name of the person who approved",
      required: false,
      minLength: 2,
      maxLength: 100,
      placeholder: "e.g., John Doe",
    },
    documents: {
      type: "array",
      label: "Document List",
      description: "List of document filenames",
      required: false,
      default: [],
      minItems: 0,
      maxItems: 50,
      itemType: "string",
      helpText: "Array of document filenames (e.g., ['contract.pdf', 'id.pdf'])",
    },
    paymentDetails: {
      type: "object",
      label: "Payment Details",
      description: "Payment information",
      required: false,
      properties: {
        amount: {
          type: "number",
          label: "Amount",
          required: true,
          min: 0,
        },
        currency: {
          type: "string",
          label: "Currency",
          required: true,
          default: "USD",
        },
        status: {
          type: "string",
          label: "Status",
          required: true,
          default: "pending",
        },
      },
      helpText: "Object with amount, currency, and status fields",
    },
  },
};
