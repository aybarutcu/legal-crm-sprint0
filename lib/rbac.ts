import { Role } from "@prisma/client";

export const DEFAULT_ROLES: Role[] = [Role.ADMIN, Role.LAWYER, Role.PARALEGAL];

export function isRoleAllowed({
  userRole,
  allowedRoles = DEFAULT_ROLES,
}: {
  userRole?: Role | null;
  allowedRoles?: Role[];
}): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

export function assertRole({
  userRole,
  allowedRoles = DEFAULT_ROLES,
}: {
  userRole?: Role | null;
  allowedRoles?: Role[];
}) {
  if (!isRoleAllowed({ userRole, allowedRoles })) {
    throw new Error("forbidden");
  }
}
