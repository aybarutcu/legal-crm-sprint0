import { describe, expect, it } from "vitest";
import {
  matterCreateSchema,
  matterUpdateSchema,
  MATTER_STATUS,
  MATTER_TYPES,
} from "@/lib/validation/matter";

describe("matterCreateSchema", () => {
  it("accepts valid payload", () => {
    const result = matterCreateSchema.safeParse({
      title: "Yeni Dava",
      type: MATTER_TYPES[0],
      clientId: "client-1",
      jurisdiction: "Ankara",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = matterCreateSchema.safeParse({
      type: MATTER_TYPES[0],
      clientId: "client-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("matterUpdateSchema", () => {
  it("requires at least one field", () => {
    const result = matterUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("allows partial updates", () => {
    const result = matterUpdateSchema.safeParse({ status: MATTER_STATUS[1] });
    expect(result.success).toBe(true);
  });
});
