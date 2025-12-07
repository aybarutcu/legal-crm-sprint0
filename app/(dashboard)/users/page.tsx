import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersManagementClient } from "@/components/admin/UsersManagementClient";

export default async function UsersManagementPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (![Role.ADMIN, Role.LAWYER].includes((session.user.role ?? Role.LAWYER) as "ADMIN" | "LAWYER")) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      clientProfile: {
        select: { id: true, firstName: true, lastName: true },
      },
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const internalUsers = users
    .filter((user) => user.role !== Role.CLIENT)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    }));

  const clientUsers = users
    .filter((user) => user.role === Role.CLIENT)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      contact: user.clientProfile
        ? {
            id: user.clientProfile.id,
            firstName: user.clientProfile.firstName,
            lastName: user.clientProfile.lastName,
          }
        : null,
    }));

  return (
    <UsersManagementClient
      currentRole={session.user.role ?? Role.LAWYER}
      internalUsers={internalUsers}
      clientUsers={clientUsers}
    />
  );
}
