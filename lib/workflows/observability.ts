/**
 * Workflow Observability Module
 * 
 * Provides metrics tracking and tracing spans for workflow operations.
 * Tracks step transitions, handler execution, cycle times, and failure rates.
 */

import { ActionState, ActionType } from "@prisma/client";
import { incrementMetric } from "@/lib/metrics";

/**
 * Simple tracing span for workflow operations
 */
export class WorkflowSpan {
  private startTime: number;
  private attributes: Record<string, string | number | boolean> = {};

  constructor(
    private name: string,
    attributes?: Record<string, string | number | boolean>
  ) {
    this.startTime = Date.now();
    if (attributes) {
      this.attributes = { ...attributes };
    }
    console.log(`[Workflow Trace] START ${name}`, this.attributes);
  }

  /**
   * Set an attribute on the span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  /**
   * End the span and log duration
   */
  end(success = true): number {
    const duration = Date.now() - this.startTime;
    console.log(`[Workflow Trace] END ${this.name}`, {
      ...this.attributes,
      duration_ms: duration,
      success,
    });
    return duration;
  }

  /**
   * End the span with an error
   */
  endWithError(error: Error): number {
    this.setAttribute("error", error.message);
    this.setAttribute("error.type", error.name);
    return this.end(false);
  }
}

/**
 * Metrics tracking for workflow operations
 */
export class WorkflowMetrics {
  /**
   * Track step state transition
   */
  static recordTransition(
    actionType: ActionType,
    fromState: ActionState,
    toState: ActionState
  ): void {
    // Counter: total transitions by type
    incrementMetric(`workflow.transition.${actionType}.total`);
    
    // Counter: specific state transitions
    incrementMetric(`workflow.transition.${actionType}.${fromState}_to_${toState}`);
    
    // Counter: terminal states (completed/failed/skipped)
    if (toState === ActionState.COMPLETED) {
      incrementMetric(`workflow.step.completed.${actionType}`);
      incrementMetric("workflow.step.completed.total");
    } else if (toState === ActionState.FAILED) {
      incrementMetric(`workflow.step.failed.${actionType}`);
      incrementMetric("workflow.step.failed.total");
    } else if (toState === ActionState.SKIPPED) {
      incrementMetric(`workflow.step.skipped.${actionType}`);
      incrementMetric("workflow.step.skipped.total");
    }
  }

  /**
   * Track step start event
   */
  static recordStepStart(actionType: ActionType): void {
    incrementMetric(`workflow.step.started.${actionType}`);
    incrementMetric("workflow.step.started.total");
  }

  /**
   * Track step claim event
   */
  static recordStepClaim(actionType: ActionType): void {
    incrementMetric(`workflow.step.claimed.${actionType}`);
    incrementMetric("workflow.step.claimed.total");
  }

  /**
   * Track step cycle time (from READY to terminal state)
   * @param actionType The type of action
   * @param durationMs Duration in milliseconds
   */
  static recordCycleTime(actionType: ActionType, durationMs: number): void {
    // Store individual cycle times in a histogram-like structure
    const bucket = getCycleTimeBucket(durationMs);
    incrementMetric(`workflow.cycle_time.${actionType}.${bucket}`);
    incrementMetric(`workflow.cycle_time.${actionType}.count`);
    incrementMetric(`workflow.cycle_time.${actionType}.sum`, durationMs);
  }

  /**
   * Track handler execution time
   */
  static recordHandlerDuration(
    actionType: ActionType,
    operation: "start" | "complete" | "fail" | "skip",
    durationMs: number
  ): void {
    incrementMetric(`workflow.handler.${operation}.${actionType}.count`);
    incrementMetric(`workflow.handler.${operation}.${actionType}.duration_sum`, durationMs);
  }

  /**
   * Track handler errors
   */
  static recordHandlerError(
    actionType: ActionType,
    operation: "start" | "complete" | "fail" | "skip",
    errorType: string
  ): void {
    incrementMetric(`workflow.handler.error.${actionType}.${operation}`);
    incrementMetric(`workflow.handler.error.${errorType}`);
    incrementMetric("workflow.handler.error.total");
  }

  /**
   * Track workflow instance creation
   */
  static recordInstanceCreated(templateId: string): void {
    incrementMetric(`workflow.instance.created.template_${templateId}`);
    incrementMetric("workflow.instance.created.total");
  }

  /**
   * Track workflow instance completion
   */
  static recordInstanceCompleted(templateId: string, durationMs: number): void {
    incrementMetric(`workflow.instance.completed.template_${templateId}`);
    incrementMetric("workflow.instance.completed.total");
    incrementMetric(`workflow.instance.duration.template_${templateId}`, durationMs);
  }

  /**
   * Track step advancement (PENDING -> READY)
   */
  static recordStepAdvanced(actionType: ActionType): void {
    incrementMetric(`workflow.step.advanced.${actionType}`);
    incrementMetric("workflow.step.advanced.total");
  }

  /**
   * Track notification events
   */
  static recordNotificationSent(actionType: ActionType, success: boolean): void {
    if (success) {
      incrementMetric(`workflow.notification.sent.${actionType}`);
      incrementMetric("workflow.notification.sent.total");
    } else {
      incrementMetric(`workflow.notification.failed.${actionType}`);
      incrementMetric("workflow.notification.failed.total");
    }
  }
}

/**
 * Helper to bucket cycle times for histogram-like tracking
 */
function getCycleTimeBucket(durationMs: number): string {
  if (durationMs < 1000) return "lt_1s";
  if (durationMs < 5000) return "lt_5s";
  if (durationMs < 10000) return "lt_10s";
  if (durationMs < 30000) return "lt_30s";
  if (durationMs < 60000) return "lt_1m";
  if (durationMs < 300000) return "lt_5m";
  if (durationMs < 600000) return "lt_10m";
  if (durationMs < 1800000) return "lt_30m";
  if (durationMs < 3600000) return "lt_1h";
  return "gte_1h";
}

/**
 * Create a tracing span for workflow operations
 */
export function createWorkflowSpan(
  operation: string,
  attributes?: Record<string, string | number | boolean>
): WorkflowSpan {
  return new WorkflowSpan(operation, attributes);
}

/**
 * Wrap an async function with tracing span
 */
export async function traceWorkflowOperation<T>(
  operation: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  const span = createWorkflowSpan(operation, attributes);
  try {
    const result = await fn();
    span.end(true);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

/**
 * Calculate cycle time from step start to completion
 */
export function calculateStepCycleTime(
  startedAt: Date | null,
  completedAt: Date | null
): number | null {
  if (!startedAt || !completedAt) return null;
  return completedAt.getTime() - startedAt.getTime();
}

/**
 * Calculate instance total duration
 */
export function calculateInstanceDuration(
  createdAt: Date,
  completedAt: Date | null
): number | null {
  if (!completedAt) return null;
  return completedAt.getTime() - createdAt.getTime();
}

/**
 * Get metric name for a specific action type and metric type
 */
export function getMetricName(
  category: "step" | "handler" | "instance" | "notification",
  actionType: ActionType | "total",
  metric: string
): string {
  return `workflow.${category}.${metric}.${actionType}`;
}

/**
 * Log structured workflow event
 */
export function logWorkflowEvent(
  event: string,
  details: Record<string, unknown>
): void {
  console.log(`[Workflow Event] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}
