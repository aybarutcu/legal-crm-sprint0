import { describe, expect, it } from "vitest";
import { getNextDocumentVersion } from "@/lib/documents/version";

describe("getNextDocumentVersion", () => {
  it("returns 1 when no previous version exists", () => {
    expect(getNextDocumentVersion(undefined)).toBe(1);
    expect(getNextDocumentVersion(null)).toBe(1);
  });

  it("increments the provided version", () => {
    expect(getNextDocumentVersion(0)).toBe(1);
    expect(getNextDocumentVersion(1)).toBe(2);
    expect(getNextDocumentVersion(42)).toBe(43);
  });
});
