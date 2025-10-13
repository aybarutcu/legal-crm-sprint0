import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { documentUploadSchema, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

describe("document upload validation", () => {
  const originalEnv = process.env.MAX_UPLOAD_BYTES;

  beforeEach(() => {
    delete process.env.MAX_UPLOAD_BYTES;
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.MAX_UPLOAD_BYTES = originalEnv;
    } else {
      delete process.env.MAX_UPLOAD_BYTES;
    }
  });

  it("accepts supported MIME types", () => {
    const payload = {
      filename: "example.pdf",
      mime: "application/pdf",
      size: 1024,
    };

    expect(() => documentUploadSchema.parse(payload)).not.toThrow();
  });

  it("rejects unsupported MIME types", () => {
    const payload = {
      filename: "malware.exe",
      mime: "application/x-msdownload",
      size: 1024,
    };

    expect(() => documentUploadSchema.parse(payload)).toThrowError("Unsupported MIME type");
  });

  it("treats image mimes as valid even if not explicitly listed", () => {
    const payload = {
      filename: "photo.png",
      mime: "image/png",
      size: 2048,
    };

    expect(() => documentUploadSchema.parse(payload)).not.toThrow();
  });

  it("uses the default 100MB limit when env is not set", () => {
    expect(MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024);
    process.env.MAX_UPLOAD_BYTES = "2097152";
    vi.resetModules();
    return import("@/lib/validation/document").then((module) => {
      expect(module.MAX_UPLOAD_BYTES).toBe(2 * 1024 * 1024);
    });
  });
});
