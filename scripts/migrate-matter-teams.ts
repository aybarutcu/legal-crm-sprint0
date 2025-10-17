/**
 * Migration script to populate MatterTeamMember table
 * 
 * This script:
 * 1. Adds all matter owners as team members
 * 2. Adds all users with tasks on matters as team members
 * 
 * Run with: npx tsx scripts/migrate-matter-teams.ts
 */

import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";

async function migrateTeamMembers() {
  console.log("Starting matter team migration...\n");

  // Get all matters
  const matters = await prisma.matter.findMany({
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: {
        select: { id: true, role: true, name: true },
      },
      tasks: {
        select: {
          assigneeId: true,
          assignee: {
            select: { id: true, role: true, name: true },
          },
        },
      },
    },
  });

  console.log(`Found ${matters.length} matters to process\n`);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const matter of matters) {
    console.log(`Processing: ${matter.title} (${matter.id})`);

    const memberIds = new Set<string>();
    const membersToAdd: Array<{ userId: string; role: Role; name: string }> = [];

    // Add owner
    if (matter.owner && (matter.owner.role === Role.LAWYER || matter.owner.role === Role.PARALEGAL)) {
      memberIds.add(matter.owner.id);
      membersToAdd.push({
        userId: matter.owner.id,
        role: matter.owner.role,
        name: matter.owner.name || "Unknown",
      });
    }

    // Add task assignees
    for (const task of matter.tasks) {
      if (
        task.assignee &&
        (task.assignee.role === Role.LAWYER || task.assignee.role === Role.PARALEGAL) &&
        !memberIds.has(task.assignee.id)
      ) {
        memberIds.add(task.assignee.id);
        membersToAdd.push({
          userId: task.assignee.id,
          role: task.assignee.role,
          name: task.assignee.name || "Unknown",
        });
      }
    }

    // Add team members
    for (const member of membersToAdd) {
      try {
        await prisma.matterTeamMember.create({
          data: {
            matterId: matter.id,
            userId: member.userId,
            role: member.role,
            addedBy: matter.ownerId || member.userId, // Owner adds them, or self-add
          },
        });
        console.log(`  ✓ Added: ${member.name} (${member.role})`);
        totalAdded++;
      } catch (error) {
        // @ts-ignore
        if (error?.code === "P2002") {
          // Unique constraint violation - already exists
          console.log(`  ⊘ Skipped: ${member.name} (already a member)`);
          totalSkipped++;
        } else {
          console.error(`  ✗ Error adding ${member.name}:`, error);
        }
      }
    }

    console.log("");
  }

  console.log("Migration complete!");
  console.log(`  Added: ${totalAdded} team members`);
  console.log(`  Skipped: ${totalSkipped} (already existed)`);
}

migrateTeamMembers()
  .then(() => {
    console.log("\n✓ Migration successful");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  });
