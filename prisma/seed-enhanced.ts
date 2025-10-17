import {
  ActionState,
  ActionType,
  CalendarProvider,
  Prisma,
  PrismaClient,
  Role,
  RoleScope,
  TaskPriority,
  WorkflowInstanceStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultReminderMinutes = parseInt(
    process.env.CALENDAR_DEFAULT_REMINDER_MINUTES ?? "30",
    10,
  );

  const now = new Date();

  // ========== USERS ==========
  console.log("Creating users...");
  
  const admin = await prisma.user.upsert({
    where: { email: "admin@legalcrm.local" },
    update: {},
    create: {
      email: "admin@legalcrm.local",
      name: "Admin Yönetici",
      role: Role.ADMIN,
    },
  });

  const lawyer1 = await prisma.user.upsert({
    where: { email: "lawyer@legalcrm.local" },
    update: {},
    create: {
      email: "lawyer@legalcrm.local",
      name: "Avukat Mehmet Yılmaz",
      role: Role.LAWYER,
    },
  });

  const lawyer2 = await prisma.user.upsert({
    where: { email: "lawyer2@legalcrm.local" },
    update: {},
    create: {
      email: "lawyer2@legalcrm.local",
      name: "Avukat Ayşe Kaya",
      role: Role.LAWYER,
    },
  });

  const paralegal = await prisma.user.upsert({
    where: { email: "paralegal@legalcrm.local" },
    update: {},
    create: {
      email: "paralegal@legalcrm.local",
      name: "Hukuk Asistanı Zeynep Demir",
      role: Role.PARALEGAL,
    },
  });

  console.log(`✓ Created ${4} users`);

  // ========== CONTACTS ==========
  console.log("Creating contacts...");
  
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        phone: "+90 532 123 4567",
        type: "LEAD",
        status: "NEW",
        tags: ["personal-injury", "priority"],
        ownerId: admin.id,
        address: "Atatürk Bulvarı No: 123",
        city: "Ankara",
        state: "Çankaya",
        zip: "06420",
        country: "Türkiye",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Ahmet",
        lastName: "Öztürk",
        email: "ahmet.ozturk@example.com",
        phone: "+90 533 234 5678",
        type: "CLIENT",
        status: "ACTIVE",
        tags: ["corporate", "contract-law"],
        ownerId: lawyer1.id,
        company: "Öztürk İnşaat A.Ş.",
        address: "Cumhuriyet Caddesi No: 45",
        city: "İstanbul",
        state: "Beşiktaş",
        zip: "34353",
        country: "Türkiye",
        notes: "Kurumsal müşteri, inşaat hukuku konularında danışmanlık.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Elif",
        lastName: "Yıldız",
        email: "elif.yildiz@example.com",
        phone: "+90 534 345 6789",
        type: "CLIENT",
        status: "ACTIVE",
        tags: ["family-law", "divorce"],
        ownerId: lawyer2.id,
        address: "İstiklal Caddesi No: 78",
        city: "İzmir",
        state: "Konak",
        zip: "35210",
        country: "Türkiye",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Can",
        lastName: "Aydın",
        email: "can.aydin@example.com",
        phone: "+90 535 456 7890",
        type: "LEAD",
        status: "QUALIFIED",
        tags: ["employment", "urgent"],
        ownerId: lawyer1.id,
        company: "TechStart Yazılım Ltd.",
        address: "Kızılay Meydanı No: 12",
        city: "Ankara",
        state: "Çankaya",
        zip: "06420",
        country: "Türkiye",
        notes: "İş hukuku danışmanlığı için başvurdu.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Deniz",
        lastName: "Şahin",
        email: "deniz.sahin@example.com",
        phone: "+90 536 567 8901",
        type: "LEAD",
        status: "QUALIFIED",
        tags: ["real-estate", "property"],
        ownerId: paralegal.id,
        address: "Bağdat Caddesi No: 234",
        city: "İstanbul",
        state: "Kadıköy",
        zip: "34710",
        country: "Türkiye",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Merve",
        lastName: "Çelik",
        email: "merve.celik@example.com",
        phone: "+90 537 678 9012",
        type: "CLIENT",
        status: "ACTIVE",
        tags: ["criminal", "high-priority"],
        ownerId: admin.id,
        address: "Kordon No: 56",
        city: "İzmir",
        state: "Alsancak",
        zip: "35220",
        country: "Türkiye",
        notes: "Ceza davası müvekkili.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Burak",
        lastName: "Arslan",
        email: "burak.arslan@example.com",
        phone: "+90 538 789 0123",
        type: "LEAD",
        status: "NEW",
        tags: ["tax-law"],
        ownerId: lawyer1.id,
        company: "Arslan Danışmanlık",
        city: "İstanbul",
        country: "Türkiye",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Selin",
        lastName: "Korkmaz",
        email: "selin.korkmaz@example.com",
        phone: "+90 539 890 1234",
        type: "CLIENT",
        status: "ACTIVE",
        tags: ["intellectual-property"],
        ownerId: lawyer2.id,
        address: "Tunalı Hilmi Caddesi No: 89",
        city: "Ankara",
        country: "Türkiye",
      },
    }),
  ]);

  console.log(`✓ Created ${contacts.length} contacts`);

  // ========== MATTERS ==========
  console.log("Creating matters...");
  
  const matters = await Promise.all([
    prisma.matter.create({
      data: {
        title: "Doe vs. Corp. - İş Kazası Tazminatı",
        type: "Civil",
        status: "OPEN",
        jurisdiction: "Ankara",
        court: "Ankara 10. İş Mahkemesi",
        clientId: contacts[0].id,
        ownerId: admin.id,
        estimatedValue: new Prisma.Decimal(150000),
        openedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.matter.create({
      data: {
        title: "Öztürk İnşaat - Sözleşme İncelemesi",
        type: "Corporate",
        status: "OPEN",
        jurisdiction: "İstanbul",
        clientId: contacts[1].id,
        ownerId: lawyer1.id,
        estimatedValue: new Prisma.Decimal(50000),
        openedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.matter.create({
      data: {
        title: "Yıldız - Boşanma Davası",
        type: "Family",
        status: "OPEN",
        jurisdiction: "İzmir",
        court: "İzmir 3. Aile Mahkemesi",
        clientId: contacts[2].id,
        ownerId: lawyer2.id,
        estimatedValue: new Prisma.Decimal(75000),
        openedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.matter.create({
      data: {
        title: "TechStart - İşçi Tazminatı Davası",
        type: "Employment",
        status: "OPEN",
        jurisdiction: "Ankara",
        court: "Ankara 15. İş Mahkemesi",
        clientId: contacts[3].id,
        ownerId: lawyer1.id,
        estimatedValue: new Prisma.Decimal(100000),
        openedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.matter.create({
      data: {
        title: "Çelik - Ceza Davası",
        type: "Criminal",
        status: "OPEN",
        jurisdiction: "İzmir",
        court: "İzmir 7. Ağır Ceza Mahkemesi",
        clientId: contacts[5].id,
        ownerId: admin.id,
        estimatedValue: new Prisma.Decimal(200000),
        openedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.matter.create({
      data: {
        title: "Korkmaz - Patent Başvurusu",
        type: "Intellectual Property",
        status: "OPEN",
        jurisdiction: "Ankara",
        clientId: contacts[7].id,
        ownerId: lawyer2.id,
        estimatedValue: new Prisma.Decimal(35000),
        openedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log(`✓ Created ${matters.length} matters`);

  // ========== CALENDARS ==========
  console.log("Creating calendars...");
  
  const calendars = await Promise.all([
    prisma.calendar.upsert({
      where: {
        userId_provider: {
          userId: admin.id,
          provider: CalendarProvider.LOCAL,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        name: "Primary Calendar",
        provider: CalendarProvider.LOCAL,
        isPrimary: true,
        defaultReminderMinutes,
      },
    }),
    prisma.calendar.upsert({
      where: {
        userId_provider: {
          userId: lawyer1.id,
          provider: CalendarProvider.LOCAL,
        },
      },
      update: {},
      create: {
        userId: lawyer1.id,
        name: "Avukat Takvimi",
        provider: CalendarProvider.LOCAL,
        isPrimary: true,
        defaultReminderMinutes,
      },
    }),
    prisma.calendar.upsert({
      where: {
        userId_provider: {
          userId: lawyer2.id,
          provider: CalendarProvider.LOCAL,
        },
      },
      update: {},
      create: {
        userId: lawyer2.id,
        name: "Avukat Takvimi",
        provider: CalendarProvider.LOCAL,
        isPrimary: true,
        defaultReminderMinutes,
      },
    }),
  ]);

  console.log(`✓ Created ${calendars.length} calendars`);

  // ========== EVENTS ==========
  console.log("Creating events...");
  
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: "İlk müşteri görüşmesi - Jane Doe",
        startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        location: "Ofis - Toplantı Odası 1",
        organizerId: admin.id,
        matterId: matters[0].id,
        calendarId: calendars[0].id,
        reminderMinutes: defaultReminderMinutes,
      },
    }),
    prisma.event.create({
      data: {
        title: "Duruşma - Yıldız Boşanma Davası",
        startAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        location: "İzmir 3. Aile Mahkemesi - Duruşma Salonu 2",
        organizerId: lawyer2.id,
        matterId: matters[2].id,
        calendarId: calendars[2].id,
        reminderMinutes: 1440, // 1 day reminder
      },
    }),
    prisma.event.create({
      data: {
        title: "Sözleşme İmza Toplantısı - Öztürk İnşaat",
        startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        location: "Öztürk İnşaat Ofisi",
        organizerId: lawyer1.id,
        matterId: matters[1].id,
        calendarId: calendars[1].id,
        reminderMinutes: defaultReminderMinutes,
      },
    }),
    prisma.event.create({
      data: {
        title: "Ön İnceleme Duruşması - Çelik Ceza Davası",
        startAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        location: "İzmir 7. Ağır Ceza Mahkemesi",
        organizerId: admin.id,
        matterId: matters[4].id,
        calendarId: calendars[0].id,
        reminderMinutes: 2880, // 2 days reminder
      },
    }),
  ]);

  console.log(`✓ Created ${events.length} events`);

  // ========== TASKS ==========
  console.log("Creating tasks...");
  
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: "İlk görüşmeyi planla",
        matterId: matters[0].id,
        description: "Müvekkil ile ilk görüşmeyi organize et ve gerekli notları hazırla.",
        priority: TaskPriority.HIGH,
        assigneeId: admin.id,
        dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        checklists: {
          create: [
            { title: "Görüşme tarihini teyit et" },
            { title: "Toplantı odasını ayarla" },
            { title: "Dosya materyallerini hazırla" },
          ],
        },
      },
    }),
    prisma.task.create({
      data: {
        title: "Dosya ön incelemesi yap",
        description: "Gönderilen belgeleri incele, eksik olanları listele.",
        matterId: matters[0].id,
        assigneeId: lawyer1.id,
        dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
      },
    }),
    prisma.task.create({
      data: {
        title: "Sözleşme taslağı hazırla",
        description: "Öztürk İnşaat için sözleşme taslağını hazırla ve gözden geçir.",
        matterId: matters[1].id,
        assigneeId: lawyer1.id,
        dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        priority: TaskPriority.HIGH,
      },
    }),
    prisma.task.create({
      data: {
        title: "Boşanma dilekçesi hazırla",
        description: "Müvekkil bilgilerini topla ve dilekçeyi hazırla.",
        matterId: matters[2].id,
        assigneeId: lawyer2.id,
        dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        priority: TaskPriority.HIGH,
      },
    }),
    prisma.task.create({
      data: {
        title: "Tanık listesi hazırla",
        description: "Davada dinlenecek tanıkların listesini hazırla.",
        matterId: matters[4].id,
        assigneeId: paralegal.id,
        dueAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
      },
    }),
    prisma.task.create({
      data: {
        title: "Patent başvuru belgelerini kontrol et",
        description: "Patent başvurusu için tüm belgelerin eksiksiz olduğundan emin ol.",
        matterId: matters[5].id,
        assigneeId: paralegal.id,
        dueAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
        checklists: {
          create: [
            { title: "Buluş beyanı kontrol" },
            { title: "Teknik çizimler onay" },
            { title: "İstem listesi hazır" },
          ],
        },
      },
    }),
  ]);

  console.log(`✓ Created ${tasks.length} tasks`);

  // ========== DOCUMENTS ==========
  console.log("Creating documents...");
  
  const documents = await Promise.all([
    prisma.document.create({
      data: {
        filename: "dilekce-doe.pdf",
        mime: "application/pdf",
        size: 1024,
        storageKey: "seed/dilekce-doe.pdf",
        tags: ["dilekce", "iş-kazası"],
        uploaderId: admin.id,
        matterId: matters[0].id,
      },
    }),
    prisma.document.create({
      data: {
        filename: "sozlesme-taslak-ozturk.docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 2048,
        storageKey: "seed/sozlesme-taslak-ozturk.docx",
        tags: ["sözleşme", "taslak"],
        uploaderId: lawyer1.id,
        matterId: matters[1].id,
      },
    }),
    prisma.document.create({
      data: {
        filename: "evlilik-cüzdanı-yildiz.pdf",
        mime: "application/pdf",
        size: 512,
        storageKey: "seed/evlilik-cüzdanı-yildiz.pdf",
        tags: ["belge", "evlilik"],
        uploaderId: lawyer2.id,
        matterId: matters[2].id,
        contactId: contacts[2].id,
      },
    }),
    prisma.document.create({
      data: {
        filename: "is-sozlesmesi-techstart.pdf",
        mime: "application/pdf",
        size: 1536,
        storageKey: "seed/is-sozlesmesi-techstart.pdf",
        tags: ["iş-sözleşmesi"],
        uploaderId: lawyer1.id,
        matterId: matters[3].id,
      },
    }),
    prisma.document.create({
      data: {
        filename: "iddianame-celik.pdf",
        mime: "application/pdf",
        size: 3072,
        storageKey: "seed/iddianame-celik.pdf",
        tags: ["iddianame", "ceza"],
        uploaderId: admin.id,
        matterId: matters[4].id,
      },
    }),
    prisma.document.create({
      data: {
        filename: "patent-basvuru-korkmaz.pdf",
        mime: "application/pdf",
        size: 4096,
        storageKey: "seed/patent-basvuru-korkmaz.pdf",
        tags: ["patent", "başvuru"],
        uploaderId: lawyer2.id,
        matterId: matters[5].id,
      },
    }),
  ]);

  console.log(`✓ Created ${documents.length} documents`);

  // Link first document to review task
  await prisma.taskLink.create({
    data: {
      taskId: tasks[1].id,
      documentId: documents[0].id,
    },
  });

  // ========== WORKFLOW TEMPLATE ==========
  console.log("Creating workflow template...");
  
  const discoveryTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Discovery Kickoff",
      description: "İlk keşif adımları ve kontrol listesi",
      createdById: admin.id,
      isActive: true,
      contextSchema: {
        version: 1,
        fields: {
          clientApproved: {
            type: "boolean",
            label: "Client Approved",
            description: "Whether the client has approved the discovery plan",
            required: true,
            default: false,
          },
          documentCount: {
            type: "number",
            label: "Document Count",
            description: "Number of documents to be discovered",
            required: true,
            min: 0,
            max: 1000,
            default: 0,
          },
          approverName: {
            type: "string",
            label: "Approver Name",
            description: "Name of the person who approved the plan",
            required: false,
            minLength: 2,
            maxLength: 100,
          },
          discoveryDeadline: {
            type: "string",
            label: "Discovery Deadline",
            description: "Deadline for discovery completion (ISO date format)",
            required: false,
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            placeholder: "YYYY-MM-DD",
          },
          requestedDocuments: {
            type: "array",
            label: "Requested Documents",
            description: "List of document types requested from client",
            required: false,
            minItems: 1,
            maxItems: 50,
            itemType: "string",
            default: [],
          },
        },
      },
      steps: {
        create: [
          {
            order: 0,
            title: "Checklist: Discovery hazırlık",
            actionType: ActionType.CHECKLIST,
            roleScope: RoleScope.ADMIN,
            actionConfig: {
              items: ["Discovery talebi hazırla", "Taraflara bilgilendirme gönder"],
            },
          },
          {
            order: 1,
            title: "Lawyer approval of discovery plan",
            actionType: ActionType.APPROVAL_LAWYER,
            roleScope: RoleScope.LAWYER,
            actionConfig: {
              approverRole: "LAWYER",
              message: "Discovery planını onayla veya düzenleme iste.",
            },
          },
          {
            order: 2,
            title: "Client signature on engagement",
            actionType: ActionType.SIGNATURE_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              documentId: documents[0].id,
              provider: "mock",
            },
          },
          {
            order: 3,
            title: "Request outstanding discovery documents",
            actionType: ActionType.REQUEST_DOC_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              requestText: "Lütfen aşağıdaki belgeleri yükleyin",
              acceptedTypes: ["application/pdf", "image/png"],
            },
          },
          {
            order: 4,
            title: "Collect discovery retainer payment",
            actionType: ActionType.PAYMENT_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              amount: 5000,
              currency: "USD",
              provider: "mock",
            },
          },
        ],
      },
    },
    include: {
      steps: true,
    },
  });

  await prisma.workflowInstance.create({
    data: {
      templateId: discoveryTemplate.id,
      matterId: matters[0].id,
      createdById: admin.id,
      templateVersion: discoveryTemplate.version,
      status: WorkflowInstanceStatus.ACTIVE,
      steps: {
        create: discoveryTemplate.steps.map((step, index) => ({
          templateStepId: step.id,
          order: step.order,
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          actionState:
            index === 0 ? ActionState.READY : ActionState.PENDING,
          actionData:
            step.actionType === ActionType.CHECKLIST
              ? ({ completedItems: [] } satisfies Prisma.JsonObject)
              : undefined,
        })),
      },
    },
  });

  console.log(`✓ Created workflow template and instance`);

  // ========== SUMMARY ==========
  console.log("\n========== SEED SUMMARY ==========");
  console.log(`Users: ${4}`);
  console.log(`Contacts: ${contacts.length}`);
  console.log(`Matters: ${matters.length}`);
  console.log(`Events: ${events.length}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Documents: ${documents.length}`);
  console.log(`Workflows: 1 template + 1 instance`);
  console.log("=================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
