"use client";

export function createStepId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `step_${Math.random().toString(36).slice(2, 10)}`;
}
