import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { assertMatterAccess } from "@/lib/authorization";
import { addMatterTeamMember, getMatterTeamMembers, removeMatterTeamMember } from "@/lib/matter-team";
import { z } from "zod";
import { Role } from "@prisma/client";

// GET /api/matters/[id]/team - Get all team members
export const GET = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const matterId = params!.id;

    // Ensure user has access to the matter
    await assertMatterAccess(user, matterId);

    const members = await getMatterTeamMembers(matterId);

    return NextResponse.json(members);
  },
);

const addMemberSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
});

// POST /api/matters/[id]/team - Add a team member
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const matterId = params!.id;

    // Ensure user has access to the matter
    await assertMatterAccess(user, matterId);

    // Only admins and lawyers can add team members
    if (user.role !== Role.ADMIN && user.role !== Role.LAWYER) {
      return NextResponse.json(
        { error: "Only admins and lawyers can add team members" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { userId } = addMemberSchema.parse(body);

    const member = await addMatterTeamMember({
      matterId,
      userId,
      addedBy: user.id,
    });

    return NextResponse.json(member, { status: 201 });
  },
);

const deleteMemberSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
});

// DELETE /api/matters/[id]/team - Remove a team member
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const matterId = params!.id;

    // Ensure user has access to the matter
    await assertMatterAccess(user, matterId);

    // Only admins and lawyers can remove team members
    if (user.role !== Role.ADMIN && user.role !== Role.LAWYER) {
      return NextResponse.json(
        { error: "Only admins and lawyers can remove team members" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { userId } = deleteMemberSchema.parse(body);

    await removeMatterTeamMember({ matterId, userId });

    return NextResponse.json({ success: true });
  },
);
