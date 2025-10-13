import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Role, RoleScope } from "@prisma/client";
import { loadWorkflowActorSnapshot, resolveEligibleActorIds } from "@/lib/workflows/roles";

describe("workflow actor snapshot", () => {
  it("deduplicates actors per role scope", async () => {
    const prisma = {
      user: {
        findMany: vi.fn(async () => [{ id: "admin-1" }, { id: "admin-2" }]),
      },
      matter: {
        findUnique: vi.fn(async () => ({
          ownerId: "lawyer-1",
          owner: { id: "lawyer-1", role: Role.LAWYER },
          tasks: [
            { assigneeId: "lawyer-2", assignee: { id: "lawyer-2", role: Role.LAWYER } },
            { assigneeId: "para-1", assignee: { id: "para-1", role: Role.PARALEGAL } },
          ],
          client: { userId: "client-1" },
        })),
      },
    } as unknown as PrismaClient;

    const snapshot = await loadWorkflowActorSnapshot(prisma, "matter-1");
    expect(snapshot.admins).toEqual(["admin-1", "admin-2"]);
    expect(snapshot.lawyers).toEqual(expect.arrayContaining(["lawyer-1", "lawyer-2"]));
    expect(snapshot.paralegals).toEqual(["para-1"]);
    expect(snapshot.clients).toEqual(["client-1"]);

    expect(resolveEligibleActorIds(RoleScope.LAWYER, snapshot)).toContain("lawyer-1");
  });
});
