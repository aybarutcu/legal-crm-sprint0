import { prisma } from '../lib/prisma';

async function recreateMasterFolders() {
  console.log('📁 Recreating master folders...\n');
  
  // Get the first admin user to use as creator
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });
  
  if (!admin) {
    console.log('❌ No admin user found. Cannot create folders.');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`Using admin: ${admin.name} (${admin.email})\n`);
  
  // Create root "Matters" folder
  const mattersRoot = await prisma.documentFolder.create({
    data: {
      name: 'Matters',
      createdById: admin.id,
      accessScope: 'PUBLIC',
      color: 'blue',
    }
  });
  console.log(`✅ Created root folder: "Matters" (${mattersRoot.id})`);
  
  // Create root "Contacts" folder
  const contactsRoot = await prisma.documentFolder.create({
    data: {
      name: 'Contacts',
      createdById: admin.id,
      accessScope: 'PUBLIC',
      color: 'green',
    }
  });
  console.log(`✅ Created root folder: "Contacts" (${contactsRoot.id})\n`);
  
  // Get all matters
  const matters = await prisma.matter.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true }
  });
  
  console.log(`Found ${matters.length} matters`);
  
  // Create folder for each matter
  for (const matter of matters) {
    const folder = await prisma.documentFolder.create({
      data: {
        name: matter.title,
        matterId: matter.id,
        parentFolderId: mattersRoot.id,
        createdById: admin.id,
        accessScope: 'PUBLIC',
        color: 'blue',
      }
    });
    console.log(`  ✅ ${matter.title} → ${folder.id}`);
  }
  
  // Get all contacts
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true }
  });
  
  console.log(`\nFound ${contacts.length} contacts`);
  
  // Create folder for each contact
  for (const contact of contacts) {
    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const folder = await prisma.documentFolder.create({
      data: {
        name: contactName,
        contactId: contact.id,
        parentFolderId: contactsRoot.id,
        createdById: admin.id,
        accessScope: 'PUBLIC',
        color: 'green',
      }
    });
    console.log(`  ✅ ${contactName} → ${folder.id}`);
  }
  
  console.log('\n✨ Master folders recreated successfully!\n');
  
  await prisma.$disconnect();
}

recreateMasterFolders().catch(console.error);
