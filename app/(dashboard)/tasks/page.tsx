import { PageHeader } from "@/components/page-header";
import { getAuthSession } from "@/lib/auth";
import { TasksClient } from "./_components/tasks-client";

export default async function TasksPage() {
  const session = await getAuthSession();

  return (
    <>
      <PageHeader 
        title="My Workflow Tasks" 
        description="Workflow steps assigned to you based on your role in matter teams." 
      />
      <TasksClient currentUserId={session?.user?.id} />
    </>
  );
}
