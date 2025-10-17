import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const confirmFlag = process.argv[3];

  if (!email) {
    console.error("Usage: npx tsx scripts/delete-user.ts <email> [--confirm]");
    console.error("Example: npx tsx scripts/delete-user.ts user@example.com --confirm");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clientProfile: true,
        accounts: true,
        sessions: true,
        contacts: true,
        tasks: true,
        matters: true,
        documents: true,
        events: true,
        notes: true,
        workflowTemplates: true,
        workflowInstances: true,
        assignedWorkflowSteps: true,
      },
    });

    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      return;
    }

    console.log("\n📋 User Details:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || "N/A"}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt.toISOString()}`);

    console.log("\n📊 Related Records:");
    console.log(`   • Accounts: ${user.accounts.length}`);
    console.log(`   • Sessions: ${user.sessions.length}`);
    console.log(`   • Contacts owned: ${user.contacts.length}`);
    console.log(`   • Tasks assigned: ${user.tasks.length}`);
    console.log(`   • Matters owned: ${user.matters.length}`);
    console.log(`   • Documents: ${user.documents.length}`);
    console.log(`   • Events: ${user.events.length}`);
    console.log(`   • Notes: ${user.notes.length}`);
    console.log(`   • Workflow Templates: ${user.workflowTemplates.length}`);
    console.log(`   • Workflow Instances: ${user.workflowInstances.length}`);
    console.log(`   • Assigned Workflow Steps: ${user.assignedWorkflowSteps.length}`);
    console.log(`   • Client Profile: ${user.clientProfile ? "Yes" : "No"}`);

    if (confirmFlag !== "--confirm") {
      console.log("\n⚠️  DRY RUN MODE - No changes made");
      console.log("   To actually delete this user, add --confirm flag:");
      console.log(`   npx tsx scripts/delete-user.ts ${email} --confirm`);
      return;
    }

    console.log("\n🗑️  Deleting user and related records...");

    await prisma.$transaction(async (tx) => {
      // Delete in order to respect foreign key constraints
      
      // Delete sessions and accounts
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.account.deleteMany({ where: { userId: user.id } });
      
      // Delete workflow-related records
      await tx.workflowInstanceStep.deleteMany({ where: { assignedToId: user.id } });
      await tx.workflowInstance.deleteMany({ where: { createdById: user.id } });
      await tx.workflowTemplate.deleteMany({ where: { createdById: user.id } });
      
      // Delete other owned records
      await tx.note.deleteMany({ where: { authorId: user.id } });
      await tx.event.deleteMany({ where: { organizerId: user.id } });
      await tx.document.deleteMany({ where: { uploaderId: user.id } });
      await tx.task.deleteMany({ where: { assigneeId: user.id } });
      await tx.matter.deleteMany({ where: { ownerId: user.id } });
      
      // Update contacts to remove user link instead of deleting them
      if (user.clientProfile) {
        await tx.contact.update({
          where: { id: user.clientProfile.id },
          data: { userId: null },
        });
      }
      await tx.contact.updateMany({
        where: { ownerId: user.id },
        data: { ownerId: null },
      });
      
      // Delete audit logs
      await tx.auditLog.deleteMany({ where: { actorId: user.id } });
      
      // Finally delete the user
      await tx.user.delete({ where: { id: user.id } });
    });

    console.log(`✅ Successfully deleted user "${email}" and all related records.`);
  } catch (error) {
    console.error("\n❌ An error occurred while deleting the user:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
