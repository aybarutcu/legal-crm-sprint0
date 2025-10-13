import { Session } from "next-auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

class NotAuthorizedError extends Error {
  constructor(message = "Not Authorized") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export async function requireAdmin(session: Session | null | undefined): Promise<void> {
  if (session?.user?.role !== Role.ADMIN) {
    throw new NotAuthorizedError();
  }
}

export async function assertMatterAccess(user: { id: string; role?: Role }, matterId: string): Promise<void> {
  if (user.role === Role.ADMIN) {
    return;
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { ownerId: true },
  });

  if (matter?.ownerId !== user.id) {
    throw new NotAuthorizedError("Matter access denied");
  }
}
