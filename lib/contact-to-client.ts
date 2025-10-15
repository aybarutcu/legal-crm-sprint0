/**
 * Contact to Client Conversion Logic
 * 
 * Integrates with the existing client invitation system:
 * - /api/clients/invite - Sends portal invitations
 * - /lib/mail/client-invite - Email templates  
 * - /components/contact/InviteClientButton - UI component
 * 
 * Workflow:
 * 1. LEAD contact exists
 * 2. Matter is opened → Convert contact type to CLIENT
 * 3. Use /api/clients/invite to send portal invitation
 * 4. Client activates account via /portal/activate
 */

import { prisma } from "@/lib/prisma";
import type { Contact } from "@prisma/client";

export interface ConvertToClientResult {
  contact: Contact;
  needsInvitation: boolean;
  hasUser: boolean;
}

/**
 * Convert a LEAD contact to CLIENT type
 * Does NOT send invitation - use /api/clients/invite for that
 */
export async function convertContactToClient(contactId: string): Promise<ConvertToClientResult> {
  // 1. Get the contact
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { user: true }
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  // 2. Check if already a client
  if (contact.type === "CLIENT") {
    return {
      contact,
      needsInvitation: !contact.userId || !contact.user?.activatedAt,
      hasUser: !!contact.userId
    };
  }

  // 3. Convert to CLIENT
  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      type: "CLIENT",
      status: contact.status === "DISQUALIFIED" ? "ACTIVE" : contact.status
    },
    include: { user: true }
  });

  return {
    contact: updatedContact,
    needsInvitation: !updatedContact.userId || !updatedContact.user?.activatedAt,
    hasUser: !!updatedContact.userId
  };
}

/**
 * Check if a contact has portal access
 */
export async function hasPortalAccess(contactId: string): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { user: true }
  });

  return !!(
    contact &&
    contact.type === "CLIENT" &&
    contact.userId &&
    contact.user?.isActive &&
    contact.user?.activatedAt
  );
}

/**
 * Get all matters accessible by a client user
 */
export async function getClientMatters(userId: string) {
  const contact = await prisma.contact.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (!contact) {
    return [];
  }

  return prisma.matter.findMany({
    where: {
      clientId: contact.id
    },
    include: {
      client: true,
      owner: true,
      documents: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      tasks: {
        orderBy: { dueAt: "asc" },
        take: 5
      },
      _count: {
        select: {
          documents: true,
          tasks: true,
          events: true
        }
      }
    },
    orderBy: { openedAt: "desc" }
  });
}

/**
 * Validate that a client user can access a specific matter
 */
export async function canAccessMatter(userId: string, matterId: string): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { userId }
  });

  if (!contact) return false;

  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      clientId: contact.id
    }
  });

  return !!matter;
}

/**
 * Get contact info for sending invitation
 * To actually send the invitation, call POST /api/clients/invite
 */
export async function getContactForInvitation(contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { user: true }
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  if (!contact.email) {
    throw new Error("Contact must have an email to receive an invitation");
  }

  if (contact.type !== "CLIENT") {
    throw new Error("Contact must be a CLIENT to receive portal invitation");
  }

  return {
    email: contact.email,
    name: `${contact.firstName} ${contact.lastName}`,
    hasUser: !!contact.userId,
    isActivated: !!contact.user?.activatedAt,
    needsInvitation: !contact.user?.activatedAt
  };
}
