import { PageHeader } from "@/components/page-header";
import { getAuthSession } from "@/lib/auth";
import { TasksClient } from "./_components/tasks-client";

export default async function TasksPage() {
  const session = await getAuthSession();

  return (
    <>
      <PageHeader 
        title="Tasks" 
        description="Standalone tasks and workflow steps assigned to you." 
      />
      <TasksClient currentUserId={session?.user?.id} />
    </>
  );
}
