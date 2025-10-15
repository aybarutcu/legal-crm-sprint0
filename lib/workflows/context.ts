/**
 * Workflow Context Management
 * 
 * Provides functions to manage shared data across workflow steps.
 * Context data is stored in WorkflowInstance.contextData JSONB field.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WorkflowContext = Record<string, unknown>;

/**
 * Get the entire context for a workflow instance
 */
export async function getWorkflowContext(
  instanceId: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<WorkflowContext> {
  const client = tx ?? prisma;
  
  const instance = await client.workflowInstance.findUnique({
    where: { id: instanceId },
    select: { contextData: true }
  });
  
  if (!instance) {
    throw new Error(`Workflow instance ${instanceId} not found`);
  }
  
  return (instance.contextData as WorkflowContext) ?? {};
}

/**
 * Get a specific value from workflow context
 */
export async function getWorkflowContextValue<T = unknown>(
  instanceId: string,
  key: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<T | undefined> {
  const context = await getWorkflowContext(instanceId, tx);
  return context[key] as T | undefined;
}

/**
 * Set the entire context for a workflow instance (replaces existing)
 */
export async function setWorkflowContext(
  instanceId: string,
  context: WorkflowContext,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  
  await client.workflowInstance.update({
    where: { id: instanceId },
    data: { contextData: context as Prisma.InputJsonValue }
  });
}

/**
 * Update specific values in workflow context (merges with existing)
 */
export async function updateWorkflowContext(
  instanceId: string,
  updates: WorkflowContext,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<WorkflowContext> {
  const client = tx ?? prisma;
  
  const current = await getWorkflowContext(instanceId, tx);
  const updated = { ...current, ...updates };
  
  await client.workflowInstance.update({
    where: { id: instanceId },
    data: { contextData: updated as Prisma.InputJsonValue }
  });
  
  return updated;
}

/**
 * Set a single value in workflow context
 */
export async function setWorkflowContextValue(
  instanceId: string,
  key: string,
  value: unknown,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
  await updateWorkflowContext(instanceId, { [key]: value }, tx);
}

/**
 * Delete a specific key from workflow context
 */
export async function deleteWorkflowContextValue(
  instanceId: string,
  key: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
  const context = await getWorkflowContext(instanceId, tx);
  delete context[key];
  await setWorkflowContext(instanceId, context, tx);
}

/**
 * Clear all context data for a workflow instance
 */
export async function clearWorkflowContext(
  instanceId: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  
  await client.workflowInstance.update({
    where: { id: instanceId },
    data: { contextData: Prisma.JsonNull }
  });
}

/**
 * Check if a context key exists
 */
export async function hasWorkflowContextValue(
  instanceId: string,
  key: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<boolean> {
  const context = await getWorkflowContext(instanceId, tx);
  return key in context;
}

/**
 * Get multiple context values at once
 */
export async function getWorkflowContextValues<T extends Record<string, unknown>>(
  instanceId: string,
  keys: string[],
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<Partial<T>> {
  const context = await getWorkflowContext(instanceId, tx);
  
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in context) {
      result[key as keyof T] = context[key] as T[keyof T];
    }
  }
  
  return result;
}

/**
 * Increment a numeric value in context (useful for counters)
 */
export async function incrementWorkflowContextValue(
  instanceId: string,
  key: string,
  amount: number = 1,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<number> {
  const context = await getWorkflowContext(instanceId, tx);
  const currentValue = typeof context[key] === "number" ? context[key] as number : 0;
  const newValue = currentValue + amount;
  
  await updateWorkflowContext(instanceId, { [key]: newValue }, tx);
  return newValue;
}

/**
 * Append to an array in context
 */
export async function appendToWorkflowContextArray(
  instanceId: string,
  key: string,
  value: unknown,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<unknown[]> {
  const context = await getWorkflowContext(instanceId, tx);
  const currentArray = Array.isArray(context[key]) ? context[key] as unknown[] : [];
  const newArray = [...currentArray, value];
  
  await updateWorkflowContext(instanceId, { [key]: newArray }, tx);
  return newArray;
}

/**
 * Merge nested object in context
 */
export async function mergeWorkflowContextObject(
  instanceId: string,
  key: string,
  updates: Record<string, unknown>,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<Record<string, unknown>> {
  const context = await getWorkflowContext(instanceId, tx);
  const currentObject = typeof context[key] === "object" && context[key] !== null
    ? context[key] as Record<string, unknown>
    : {};
  
  const merged = { ...currentObject, ...updates };
  await updateWorkflowContext(instanceId, { [key]: merged }, tx);
  return merged;
}
