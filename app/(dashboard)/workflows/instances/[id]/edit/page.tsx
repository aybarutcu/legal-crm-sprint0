import { redirect, notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkflowInstanceCanvasEditor } from "./_components/workflow-instance-canvas-editor";

export default async function EditWorkflowInstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const { id } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and LAWYER can edit workflow instances
  if (session.user.role !== "ADMIN" && session.user.role !== "LAWYER") {
    redirect("/dashboard");
  }

  const instance = await prisma.workflowInstance.findUnique({
    where: { id },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      matter: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          teamMembers: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          type: true,
          ownerId: true,
        },
      },
      steps: {
        orderBy: { order: "asc" },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!instance) {
    notFound();
  }

  // Check if user has access
  if (instance.matterId) {
    const hasAccess =
      session.user.role === "ADMIN" ||
      instance.matter!.ownerId === session.user.id ||
      instance.matter!.teamMembers.some((tm) => tm.userId === session.user.id);

    if (!hasAccess) {
      redirect("/dashboard");
    }
  } else if (instance.contactId) {
    const hasAccess =
      session.user.role === "ADMIN" ||
      instance.contact!.ownerId === session.user.id;

    if (!hasAccess) {
      redirect("/dashboard");
    }
  }

  // Fetch available users for assignment
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ["ADMIN", "LAWYER", "PARALEGAL"],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Serialize the data
  const serializedInstance = {
    ...instance,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
    steps: instance.steps.map((step) => ({
      ...step,
      dueDate: step.dueDate?.toISOString() || null,
      startedAt: step.startedAt?.toISOString() || null,
      completedAt: step.completedAt?.toISOString() || null,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    })),
  };

  const contextTitle = instance.matter
    ? instance.matter.title
    : instance.contact
      ? `${instance.contact.firstName} ${instance.contact.lastName}`
      : "Unknown";

  return (
    <div>
      <WorkflowInstanceCanvasEditor
        instance={serializedInstance}
        users={users}
        contextTitle={contextTitle}
        contextType={instance.matterId ? "matter" : "contact"}
      />
    </div>
  );
}
