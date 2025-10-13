"use client";

import useSWR from "swr";

export type TaskAssigneeOption = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

export type TaskMatterOption = {
  id: string;
  title: string;
};

type TaskOptionsResponse = {
  assignees: TaskAssigneeOption[];
  matters: TaskMatterOption[];
};

async function fetcher(url: string): Promise<TaskOptionsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load task options");
  }
  return (await response.json()) as TaskOptionsResponse;
}

export function useTaskOptions() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    TaskOptionsResponse
  >("/api/tasks/options", fetcher, {
    revalidateOnFocus: false,
  });

  return {
    assignees: data?.assignees ?? [],
    matters: data?.matters ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
