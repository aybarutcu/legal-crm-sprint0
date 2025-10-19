import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactDetailClient } from "./_components/contact-detail-client";

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const session = await getAuthSession();
  if (!session || !session.user) {
    redirect("/login");
  }

  const { id } = await params;

  // Fetch contact with all needed relations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contact = (await prisma.contact.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          invitedAt: true,
          activatedAt: true,
          isActive: true,
        },
      },
      matters: {
        where: { matter: { deletedAt: null } },
        select: {
          role: true,
          matter: {
            select: {
              id: true,
              title: true,
              status: true,
              openedAt: true,
            },
          },
        },
      },
      clientMatters: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          openedAt: true,
        },
      },
      workflowInstances: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          template: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          steps: {
            select: {
              id: true,
              order: true,
              title: true,
              actionType: true,
              roleScope: true,
              required: true,
              actionState: true,
              actionData: true,
              assignedToId: true,
              startedAt: true,
              completedAt: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any; // Type assertion needed until Prisma client regenerates in IDE

  if (!contact) {
    notFound();
  }

  return (
    <ContactDetailClient
      contact={contact}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
