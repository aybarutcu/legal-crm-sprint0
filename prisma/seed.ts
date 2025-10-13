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
      name: "Lawyer",
      role: Role.LAWYER,
    },
  });

  const contact = await prisma.contact.create({
    data: {
      firstName: "Jane",
      lastName: "Doe",
      type: "LEAD",
      status: "NEW",
      tags: ["personal-injury", "priority"],
      ownerId: admin.id,
    },
  });

  const matter = await prisma.matter.create({
    data: {
      title: "Doe vs. Corp.",
      type: "Civil",
      clientId: contact.id,
      ownerId: admin.id,
    },
  });

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

  const now = new Date();
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

  await prisma.taskLink.create({
    data: {
      taskId: reviewTask.id,
      documentId: document.id,
    },
  });

  const discoveryTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Discovery Kickoff",
      description: "İlk keşif adımları ve kontrol listesi",
      createdById: admin.id,
      isActive: true,
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
