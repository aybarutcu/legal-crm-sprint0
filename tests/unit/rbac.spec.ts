import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { assertRole, isRoleAllowed } from "@/lib/rbac";

describe("RBAC utilities", () => {
  it("allows admin by default", () => {
    expect(isRoleAllowed({ userRole: Role.ADMIN })).toBe(true);
  });

  it("denies undefined role", () => {
    expect(isRoleAllowed({ userRole: undefined })).toBe(false);
  });

  it("supports custom allowed roles", () => {
    expect(
      isRoleAllowed({
        userRole: Role.PARALEGAL,
        allowedRoles: [Role.PARALEGAL],
      }),
    ).toBe(true);

    expect(
      isRoleAllowed({
        userRole: Role.PARALEGAL,
        allowedRoles: [Role.ADMIN, Role.LAWYER],
      }),
    ).toBe(false);
  });

  it("throws for forbidden role", () => {
    expect(() =>
      assertRole({
        userRole: Role.PARALEGAL,
        allowedRoles: [Role.ADMIN],
      }),
    ).toThrowError("forbidden");
  });
});
