import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import {
  getWorkflowContext,
  updateWorkflowContext,
  setWorkflowContext,
  clearWorkflowContext,
} from "@/lib/workflows/context";

/**
 * GET /api/workflows/instances/:id/context
 * Get the entire context for a workflow instance
 */
export const GET = withApiHandler(
  async (req: NextRequest, { session, params }: { session?: any; params?: { id: string } }) => {
    const user = session!.user!;
    const instanceId = params!.id;

    // Get the workflow instance to check access
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      select: { matterId: true, contactId: true }
    });

    if (!instance) {
      return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
    }

    // Check access
    if (instance.matterId) {
      await assertMatterAccess(user, instance.matterId);
    }
    if (instance.contactId) {
      await assertContactAccess(user, instance.contactId);
    }

    // Get the workflow context
    const context = await getWorkflowContext(instanceId);

    return NextResponse.json({ context });
  }
);

const updateContextSchema = z.object({
  updates: z.record(z.unknown()),
});

const setContextSchema = z.object({
  context: z.record(z.unknown()),
});

/**
 * PATCH /api/workflows/instances/:id/context
 * Update workflow context (merge with existing)
 * Body: { updates: { key: value, ... } }
 * 
 * Or replace entire context:
 * Body: { context: { ... } }
 * 
 * Or clear context:
 * Body: { clear: true }
 */
export const PATCH = withApiHandler(
  async (req: NextRequest, { session, params }: { session?: any; params?: { id: string } }) => {
    const user = session!.user!;
    const instanceId = params!.id;
    
    // Get the workflow instance to check access
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      select: { matterId: true, contactId: true }
    });

    if (!instance) {
      return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
    }

    // Check access (must be owner or admin)
    if (instance.matterId) {
      await assertMatterAccess(user, instance.matterId);
    }
    if (instance.contactId) {
      await assertContactAccess(user, instance.contactId);
    }

    const body = await req.json();

    // Check if clearing context
    if (body.clear === true) {
      await clearWorkflowContext(instanceId);
      return NextResponse.json({ context: {} });
    }

    // Check if setting entire context
    if ("context" in body) {
      const parsed = setContextSchema.parse(body);
      await setWorkflowContext(instanceId, parsed.context);
      return NextResponse.json({ context: parsed.context });
    }

    // Otherwise, merge updates
    const parsed = updateContextSchema.parse(body);
    const updated = await updateWorkflowContext(instanceId, parsed.updates);

    return NextResponse.json({ context: updated });
  }
);
