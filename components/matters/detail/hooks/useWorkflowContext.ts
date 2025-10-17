"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContextSchema } from "@/lib/workflows/context-schema";

export type WorkflowContext = Record<string, unknown>;

type UseWorkflowContextResult = {
  context: WorkflowContext | null;
  schema: ContextSchema | null;
  loading: boolean;
  error: Error | null;
  updateContext: (updates: Record<string, unknown>, mode?: "merge" | "replace") => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
  clearContext: () => Promise<void>;
  reload: () => Promise<void>;
};

/**
 * Custom hook to manage workflow instance context
 * Handles GET and PATCH operations on /api/workflows/instances/:id/context
 */
export function useWorkflowContext(instanceId: string): UseWorkflowContextResult {
  const [context, setContext] = useState<WorkflowContext | null>(null);
  const [schema, setSchema] = useState<ContextSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!instanceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch context and instance details (including template schema) in parallel
      const [contextResponse, instanceResponse] = await Promise.all([
        fetch(`/api/workflows/instances/${instanceId}/context`),
        fetch(`/api/workflows/instances/${instanceId}`),
      ]);
      
      if (!contextResponse.ok) {
        throw new Error(`Failed to load context: ${contextResponse.status}`);
      }
      
      const contextData = await contextResponse.json();
      setContext(contextData);
      
      // Extract schema from instance template if available
      if (instanceResponse.ok) {
        const instanceData = await instanceResponse.json();
        const templateSchema = instanceData.template?.contextSchema;
        if (templateSchema) {
          setSchema(templateSchema as ContextSchema);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error loading context");
      setError(error);
      console.error("Error loading workflow context:", error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateContext = useCallback(
    async (updates: Record<string, unknown>, mode: "merge" | "replace" = "merge") => {
      setError(null);
      
      try {
        const response = await fetch(`/api/workflows/instances/${instanceId}/context`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates, mode }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? `Failed to update context: ${response.status}`);
        }

        const updated = await response.json();
        setContext(updated);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error updating context");
        setError(error);
        console.error("Error updating workflow context:", error);
        throw error;
      }
    },
    [instanceId]
  );

  const deleteKey = useCallback(
    async (key: string) => {
      setError(null);
      
      try {
        // Set the key to null to delete it
        const updates = { [key]: null };
        
        const response = await fetch(`/api/workflows/instances/${instanceId}/context`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates, mode: "merge" }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? `Failed to delete key: ${response.status}`);
        }

        const updated = await response.json();
        setContext(updated);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error deleting key");
        setError(error);
        console.error("Error deleting context key:", error);
        throw error;
      }
    },
    [instanceId]
  );

  const clearContext = useCallback(async () => {
    setError(null);
    
    try {
      const response = await fetch(`/api/workflows/instances/${instanceId}/context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "clear" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Failed to clear context: ${response.status}`);
      }

      setContext({});
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error clearing context");
      setError(error);
      console.error("Error clearing workflow context:", error);
      throw error;
    }
  }, [instanceId]);

  return {
    context,
    schema,
    loading,
    error,
    updateContext,
    deleteKey,
    clearContext,
    reload: load,
  };
}
