import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { convertContactToClient, getContactForInvitation } from "@/lib/contact-to-client";

/**
 * Convert a LEAD contact to CLIENT
 * This only changes the contact type - use /api/clients/invite to send portal invitation
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LAWYER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { contactId } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Convert the contact type to CLIENT
    const result = await convertContactToClient(contactId);

    return NextResponse.json({
      success: true,
      contact: result.contact,
      needsInvitation: result.needsInvitation,
      hasUser: result.hasUser,
      message: result.needsInvitation 
        ? "Contact converted to CLIENT. Use /api/clients/invite to send portal invitation."
        : "Contact converted to CLIENT and already has portal access."
    });
  } catch (error) {
    console.error("Failed to convert contact to client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to convert contact" },
      { status: 500 }
    );
  }
}

/**
 * Get contact info for invitation
 * Returns the data needed to call /api/clients/invite
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LAWYER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    const info = await getContactForInvitation(contactId);

    return NextResponse.json({
      success: true,
      ...info
    });
  } catch (error) {
    console.error("Failed to get contact info:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get contact info" },
      { status: 500 }
    );
  }
}
