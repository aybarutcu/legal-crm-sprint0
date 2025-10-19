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

  const admin = await prisma.user.upsert({
    where: { email: "admin@legalcrm.local" },
    update: {},
    create: {
      email: "admin@legalcrm.local",
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  const lawyer = await prisma.user.upsert({
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

  // Create multiple contacts with variety
  const contact = await prisma.contact.create({
    data: {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@legalcrm.local",
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
  });

  const contact2 = await prisma.contact.create({
    data: {
      firstName: "Ahmet",
      lastName: "Öztürk",
      email: "ahmet.ozturk@legalcrm.local",
      phone: "+90 533 234 5678",
      type: "CLIENT",
      status: "ACTIVE",
      tags: ["corporate", "contract-law"],
      ownerId: lawyer.id,
      company: "Öztürk İnşaat A.Ş.",
      address: "Cumhuriyet Caddesi No: 45",
      city: "İstanbul",
      state: "Beşiktaş",
      zip: "34353",
      country: "Türkiye",
      notes: "Kurumsal müşteri, inşaat hukuku konularında danışmanlık.",
    },
  });

  const contact3 = await prisma.contact.create({
    data: {
      firstName: "Elif",
      lastName: "Yıldız",
      email: "elif.yildiz@legalcrm.local",
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
  });

  const contact4 = await prisma.contact.create({
    data: {
      firstName: "Can",
      lastName: "Aydın",
      email: "can.aydin@legalcrm.local",
      phone: "+90 535 456 7890",
      type: "LEAD",
      status: "QUALIFIED",
      tags: ["employment", "urgent"],
      ownerId: lawyer.id,
      company: "TechStart Yazılım Ltd.",
      address: "Kızılay Meydanı No: 12",
      city: "Ankara",
      state: "Çankaya",
      zip: "06420",
      country: "Türkiye",
      notes: "İş hukuku danışmanlığı için başvurdu.",
    },
  });

  const contact5 = await prisma.contact.create({
    data: {
      firstName: "Deniz",
      lastName: "Şahin",
      email: "deniz.sahin@legalcrm.local",
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
  });

  const contact6 = await prisma.contact.create({
    data: {
      firstName: "Merve",
      lastName: "Çelik",
      email: "merve.celik@legalcrm.local",
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
  });

  // Test Lead for E2E tests
  const testLead = await prisma.contact.create({
    data: {
      id: "cmgxmy9r000018yc5l7d9xbsg", // Fixed ID for E2E tests
      firstName: "Test",
      lastName: "Lead",
      email: "test.lead@legalcrm.local",
      phone: "+90 555 000 0001",
      type: "LEAD",
      status: "NEW",
      tags: ["test", "e2e"],
      ownerId: admin.id,
      address: "Test Address No: 1",
      city: "Test City",
      state: "Test State",
      zip: "00000",
      country: "Türkiye",
      notes: "Contact for E2E testing - do not delete",
    },
  });

  // Create multiple matters
  const matter = await prisma.matter.create({
    data: {
      title: "Doe vs. Corp. - İş Kazası Tazminatı",
      type: "Civil",
      status: "OPEN",
      jurisdiction: "Ankara",
      court: "Ankara 10. İş Mahkemesi",
      clientId: contact.id,
      ownerId: admin.id,
      estimatedValue: 150000,
      openedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  const matter2 = await prisma.matter.create({
    data: {
      title: "Öztürk İnşaat - Sözleşme İncelemesi",
      type: "Corporate",
      status: "OPEN",
      jurisdiction: "İstanbul",
      clientId: contact2.id,
      ownerId: lawyer.id,
      estimatedValue: 50000,
      openedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    },
  });

  const matter3 = await prisma.matter.create({
    data: {
      title: "Yıldız - Boşanma Davası",
      type: "Family",
      status: "OPEN",
      jurisdiction: "İzmir",
      court: "İzmir 3. Aile Mahkemesi",
      clientId: contact3.id,
      ownerId: lawyer2.id,
      estimatedValue: 75000,
      openedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
  });

  const matter4 = await prisma.matter.create({
    data: {
      title: "TechStart - İşçi Tazminatı Davası",
      type: "Employment",
      status: "OPEN",
      jurisdiction: "Ankara",
      court: "Ankara 15. İş Mahkemesi",
      clientId: contact4.id,
      ownerId: lawyer.id,
      estimatedValue: 100000,
      openedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  const matter5 = await prisma.matter.create({
    data: {
      title: "Çelik - Ceza Davası",
      type: "Criminal",
      status: "OPEN",
      jurisdiction: "İzmir",
      court: "İzmir 7. Ağır Ceza Mahkemesi",
      clientId: contact6.id,
      ownerId: admin.id,
      estimatedValue: 200000,
      openedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
    },
  });

  // Create calendars for users
  const calendar = await prisma.calendar.upsert({
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
  });

  const eventStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

  await prisma.event.create({
    data: {
      title: "İlk müşteri görüşmesi",
      startAt: eventStart,
      endAt: eventEnd,
      location: "Ofis - Toplantı Odası 1",
      organizerId: admin.id,
      matterId: matter.id,
      calendarId: calendar.id,
      reminderMinutes: defaultReminderMinutes,
    },
  });

  const intakeTask = await prisma.task.create({
    data: {
      title: "İlk görüşmeyi planla",
      matterId: matter.id,
      description: "Müvekkil ile ilk görüşmeyi organize et ve gerekli notları hazırla.",
      priority: TaskPriority.HIGH,
      assigneeId: admin.id,
      dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      checklists: {
        create: [
          { title: "Görüşme tarihini teyit et" },
          { title: "Toplantı odasını ayarla" },
        ],
      },
    },
  });

  const reviewTask = await prisma.task.create({
    data: {
      title: "Dosya ön incelemesi yap",
      description: "Gönderilen belgeleri incele, eksik olanları listele.",
      matterId: matter.id,
      assigneeId: lawyer.id,
      dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.MEDIUM,
      links: {
        create: [
          {
            url: "https://legalcrm.local/templates/prep-checklist",
          },
        ],
      },
    },
  });

  const document = await prisma.document.create({
    data: {
      filename: "dilekce.pdf",
      mime: "application/pdf",
      size: 1024,
      storageKey: "seed/dilekce.pdf",
      tags: ["seed"],
      uploaderId: admin.id,
      matterId: matter.id,
    },
  });

  // ============================================
  // LEAD WORKFLOW TEMPLATE - Client Intake
  // ============================================
  const clientIntakeTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Client Intake Process",
      description: "Complete client intake workflow for new leads - from initial contact to engagement",
      createdById: admin.id,
      isActive: true,
      version: 1,
      steps: {
        create: [
          {
            order: 0,
            title: "Initial Contact Checklist",
            actionType: ActionType.CHECKLIST,
            roleScope: RoleScope.LAWYER,
            actionConfig: {
              items: [
                "Record initial contact details",
                "Verify contact information (phone, email)",
                "Document nature of legal issue",
                "Check for conflicts of interest",
                "Set follow-up reminder",
              ],
            },
          },
          {
            order: 1,
            title: "Conflict Check Approval",
            actionType: ActionType.APPROVAL_LAWYER,
            roleScope: RoleScope.LAWYER,
            actionConfig: {
              approverRole: "LAWYER",
              message: "Review conflict check results and approve to proceed with client intake.",
            },
          },
          {
            order: 2,
            title: "Request Initial Documents from Client",
            actionType: ActionType.REQUEST_DOC_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              requestText: "Please upload the following documents to begin your case evaluation:\n- Government-issued ID\n- Any relevant contracts or agreements\n- Supporting documentation related to your legal matter",
              acceptedTypes: ["application/pdf", "image/png", "image/jpeg"],
            },
          },
          {
            order: 3,
            title: "Client Intake Questionnaire",
            actionType: ActionType.POPULATE_QUESTIONNAIRE,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              title: "Client Background Information",
              description: "Please provide detailed information about yourself and your legal matter",
            },
          },
          {
            order: 4,
            title: "Engagement Letter Signature",
            actionType: ActionType.SIGNATURE_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              documentId: document.id,
              provider: "mock",
            },
          },
          {
            order: 5,
            title: "Collect Retainer Payment",
            actionType: ActionType.PAYMENT_CLIENT,
            roleScope: RoleScope.CLIENT,
            actionConfig: {
              amount: 2500,
              currency: "USD",
              provider: "mock",
            },
          },
          {
            order: 6,
            title: "Final Intake Review",
            actionType: ActionType.WRITE_TEXT,
            roleScope: RoleScope.LAWYER,
            actionConfig: {
              prompt: "Summarize the client intake process and any special notes or action items for the case team.",
              minLength: 100,
            },
          },
        ],
      },
    },
    include: {
      steps: true,
    },
  });

  console.log("✅ Created LEAD workflow template: Client Intake Process");

  // ============================================
  // MATTER WORKFLOW TEMPLATE - Discovery
  // ============================================
  const discoveryTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Discovery Kickoff",
      description: "İlk keşif adımları ve kontrol listesi",
      createdById: admin.id,
      isActive: true,
      version: 1,
      steps: {
        create: [
          {
            order: 0,
            title: "Checklist: Discovery hazirlik",
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
              documentId: document.id,
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
      matterId: matter.id,
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

  // ============================================
  // TEST LEAD WORKFLOW - for E2E tests
  // ============================================
  await prisma.workflowInstance.create({
    data: {
      templateId: clientIntakeTemplate.id,
      matterId: matter.id, // Associate with a matter for testing
      contactId: testLead.id, // Link directly to test lead contact
      createdById: admin.id,
      templateVersion: clientIntakeTemplate.version,
      status: WorkflowInstanceStatus.ACTIVE,
      contextData: {
        purpose: "e2e-testing",
      } satisfies Prisma.JsonObject,
      steps: {
        create: clientIntakeTemplate.steps.map((step, index) => ({
          templateStepId: step.id,
          order: step.order,
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          actionState:
            index === 0
              ? ActionState.READY
              : index < 3
                ? ActionState.COMPLETED
                : ActionState.PENDING,
          actionData:
            step.actionType === ActionType.CHECKLIST
              ? ({ completedItems: [] } satisfies Prisma.JsonObject)
              : undefined,
          // Mark first few steps as completed for testing progress
          completedAt: index < 3 ? new Date(now.getTime() - (3 - index) * 24 * 60 * 60 * 1000) : null,
        })),
      },
    },
  });

  console.log({
    admin,
    lawyer,
    contact,
    matter,
    tasks: [intakeTask.id, reviewTask.id],
    workflowTemplate: discoveryTemplate.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
