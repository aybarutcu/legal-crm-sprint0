import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Please provide an email address as an argument.");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`User with email "${email}" not found.`);
      return;
    }

    await prisma.user.delete({
      where: { email },
    });

    console.log(`Successfully deleted user with email "${email}".`);
  } catch (error) {
    console.error("An error occurred while deleting the user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
