import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, contacts, matters, tasks, documents, events, workflows] = await Promise.all([
    prisma.user.count(),
    prisma.contact.count(),
    prisma.matter.count(),
    prisma.task.count(),
    prisma.document.count(),
    prisma.event.count(),
    prisma.workflowTemplate.count(),
  ]);

  console.log("\n📊 Database Record Counts:");
  console.log("========================");
  console.log(`Users:      ${users}`);
  console.log(`Contacts:   ${contacts}`);
  console.log(`Matters:    ${matters}`);
  console.log(`Tasks:      ${tasks}`);
  console.log(`Documents:  ${documents}`);
  console.log(`Events:     ${events}`);
  console.log(`Workflows:  ${workflows}`);
  console.log("========================\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
