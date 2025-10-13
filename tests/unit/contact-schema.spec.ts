import { describe, expect, it } from "vitest";
import {
  CONTACT_PAGE_SIZE,
  contactCreateSchema,
  contactQuerySchema,
  contactUpdateSchema,
} from "@/lib/validation/contact";

describe("contactCreateSchema", () => {
  it("accepts valid payload", () => {
    const result = contactCreateSchema.safeParse({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      tags: ["vip"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("LEAD");
      expect(result.data.status).toBe("NEW");
    }
  });

  it("rejects missing first name", () => {
    const result = contactCreateSchema.safeParse({
      lastName: "Doe",
    });

    expect(result.success).toBe(false);
  });
});

describe("contactUpdateSchema", () => {
  it("requires at least one field", () => {
    const result = contactUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("allows partial updates", () => {
    const result = contactUpdateSchema.safeParse({
      status: "ACTIVE",
    });

    expect(result.success).toBe(true);
  });
});

describe("contactQuerySchema", () => {
  it("defaults pagination and trims values", () => {
    const result = contactQuerySchema.parse({
      q: "  jane ",
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(CONTACT_PAGE_SIZE);
    expect(result.q).toBe("jane");
  });

  it("rejects page size above limit", () => {
    expect(() => contactQuerySchema.parse({ pageSize: 1000 })).toThrow();
  });
});
