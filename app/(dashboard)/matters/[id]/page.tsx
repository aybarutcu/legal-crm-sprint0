import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MatterDetailClient } from "@/components/matters/MatterDetailClient";
import type { ContactOption, MatterDetail } from "@/components/matters/types";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      owner: {
        select: { id: true, name: true, email: true },
      },
      parties: {
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!matter) {
    notFound();
  }

  const detail: MatterDetail = {
    id: matter.id,
    title: matter.title,
    type: matter.type,
    status: matter.status,
    jurisdiction: matter.jurisdiction,
    court: matter.court,
    openedAt: matter.openedAt.toISOString(),
    nextHearingAt: matter.nextHearingAt?.toISOString() ?? null,
    client: {
      id: matter.client.id,
      firstName: matter.client.firstName,
      lastName: matter.client.lastName,
      email: matter.client.email,
    },
    owner: matter.owner
      ? {
          id: matter.owner.id,
          name: matter.owner.name,
          email: matter.owner.email,
        }
      : null,
    parties: matter.parties.map((party) => ({
      id: party.id,
      role: party.role,
      contact: party.contact,
    })),
  };

  const contacts = await prisma.contact.findMany({
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const contactOptions: ContactOption[] = contacts.map((contact) => ({
    id: contact.id,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.email,
  }));

  return <MatterDetailClient matter={detail} contacts={contactOptions} />;
}

export const dynamic = "force-dynamic";
