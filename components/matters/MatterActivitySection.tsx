"use client";

import { useEffect, useState } from "react";
import { Clock, FileText, Users, Workflow, CheckSquare, AlertCircle } from "lucide-react";
import { formatDateWithRelative } from "@/lib/date-utils";

type ActivityItem = {
  id: string;
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  };
};

type MatterActivitySectionProps = {
  matterId: string;
};

function getActivityIcon(entityType: string, action: string) {
  const lowerAction = action.toLowerCase();
  const lowerEntity = entityType.toLowerCase();
  
  if (lowerEntity === "document" || lowerAction.includes("document")) {
    return <FileText className="w-5 h-5 text-blue-600" />;
  }
  if (lowerEntity === "workflow" || lowerAction.includes("workflow")) {
    return <Workflow className="w-5 h-5 text-purple-600" />;
  }
  if (lowerEntity === "task" || lowerAction.includes("task")) {
    return <CheckSquare className="w-5 h-5 text-green-600" />;
  }
  if (lowerEntity === "team" || lowerAction.includes("team") || lowerAction.includes("party")) {
    return <Users className="w-5 h-5 text-orange-600" />;
  }
  return <Clock className="w-5 h-5 text-gray-600" />;
}

function formatActionDescription(action: string, entityType: string, metadata: Record<string, unknown> | null): string {
  const lowerAction = action.toLowerCase();
  
  // Document actions
  if (lowerAction === "document.create" || lowerAction === "document_uploaded") {
    const filename = metadata?.filename as string | undefined;
    return filename ? `Uploaded document: ${filename}` : "Uploaded a document";
  }
  if (lowerAction === "document.update" || lowerAction === "document_updated") {
    return "Updated a document";
  }
  if (lowerAction === "document.delete" || lowerAction === "document_deleted") {
    return "Deleted a document";
  }

  // Workflow actions
  if (lowerAction === "workflow.start" || lowerAction === "workflow_started") {
    const templateName = metadata?.templateName as string | undefined;
    return templateName ? `Started workflow: ${templateName}` : "Started a workflow";
  }
  if (lowerAction === "workflow.step.start" || lowerAction === "workflow_step_started") {
    const stepTitle = metadata?.stepTitle as string | undefined;
    return stepTitle ? `Started workflow step: ${stepTitle}` : "Started a workflow step";
  }
  if (lowerAction === "workflow.step.update") {
    const stepTitle = metadata?.stepTitle as string | undefined;
    const changes = metadata?.changes as Record<string, unknown> | undefined;
    if (stepTitle && changes) {
      const changeDescriptions: string[] = [];
      if (changes.priority) changeDescriptions.push(`priority to ${changes.priority}`);
      if (changes.dueDate) {
        const date = new Date(changes.dueDate as string);
        changeDescriptions.push(`due date to ${date.toLocaleDateString()}`);
      }
      if (changes.assignedToId !== undefined) {
        changeDescriptions.push(changes.assignedToId ? 'assigned to a user' : 'removed assignee');
      }
      return `Updated ${stepTitle}: ${changeDescriptions.join(', ')}`;
    }
    return stepTitle ? `Updated workflow step: ${stepTitle}` : "Updated a workflow step";
  }
  if (lowerAction === "workflow.step.document_uploaded") {
    const stepTitle = metadata?.stepTitle as string | undefined;
    const documentName = metadata?.documentName as string | undefined;
    const filename = metadata?.filename as string | undefined;
    const allUploaded = metadata?.allDocumentsUploaded as boolean | undefined;
    const remaining = metadata?.remainingDocuments as string[] | undefined;
    
    if (stepTitle && documentName) {
      let message = `Uploaded "${documentName}" for ${stepTitle}`;
      if (filename) message += ` (${filename})`;
      if (allUploaded) {
        message += " - All documents received ✓";
      } else if (remaining && remaining.length > 0) {
        message += ` - ${remaining.length} remaining`;
      }
      return message;
    }
    return "Uploaded document for workflow step";
  }
  if (lowerAction === "workflow.step.complete" || lowerAction === "workflow_step_completed") {
    const stepTitle = metadata?.stepTitle as string | undefined;
    const actionType = metadata?.actionType as string | undefined;
    if (stepTitle) {
      return `Completed workflow step: ${stepTitle}${actionType ? ` (${actionType})` : ""}`;
    }
    return "Completed a workflow step";
  }
  if (lowerAction === "workflow.complete" || lowerAction === "workflow_completed") {
    return "Completed workflow";
  }
  if (lowerAction === "workflow.cancel" || lowerAction === "workflow_canceled") {
    return "Canceled workflow";
  }

  // Matter actions
  if (lowerAction === "matter.create" || lowerAction === "matter_created") {
    return "Created matter";
  }
  if (lowerAction === "matter.update" || lowerAction === "matter_updated") {
    const changes = metadata?.changes as { status?: string } | undefined;
    const statusChange = changes?.status;
    if (statusChange && statusChange.includes("→")) {
      const [oldStatus, newStatus] = statusChange.split("→").map(s => s.trim());
      return `Changed status from ${oldStatus} to ${newStatus}`;
    }
    return "Updated matter details";
  }
  if (lowerAction === "matter.delete" || lowerAction === "matter_deleted") {
    return "Deleted matter";
  }

  // Party actions
  if (lowerAction === "matter.party.create" || lowerAction === "party_added") {
    const role = metadata?.role as string | undefined;
    const contactName = metadata?.contactName as string | undefined;
    if (contactName && role) {
      return `Added ${role.toLowerCase()}: ${contactName}`;
    }
    if (role) {
      return `Added ${role.toLowerCase()}`;
    }
    return "Added a party to the matter";
  }
  if (lowerAction === "matter.party.remove" || lowerAction === "party_removed") {
    return "Removed a party from the matter";
  }

  // Team actions
  if (lowerAction === "team.member.add" || lowerAction === "team_member_added") {
    const memberName = metadata?.memberName as string | undefined;
    return memberName ? `Added team member: ${memberName}` : "Added a team member";
  }
  if (lowerAction === "team.member.remove" || lowerAction === "team_member_removed") {
    const memberName = metadata?.memberName as string | undefined;
    return memberName ? `Removed team member: ${memberName}` : "Removed a team member";
  }

  // Task actions
  if (lowerAction === "task.create" || lowerAction === "task_created") {
    return "Created a task";
  }
  if (lowerAction === "task.complete" || lowerAction === "task_completed") {
    return "Completed a task";
  }

  // Generic fallback - convert dots or underscores to spaces
  return action.toLowerCase().replace(/[._]/g, " ");
}

export function MatterActivitySection({ matterId }: MatterActivitySectionProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivities() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/matters/${matterId}/activity`);
        
        if (!response.ok) {
          throw new Error("Failed to load activity history");
        }
        
        const data = await response.json() as ActivityItem[];
        setActivities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void loadActivities();
  }, [matterId]);

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <span className="ml-3 text-slate-600">Loading activity history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-2xl border border-red-200 bg-red-50 shadow-card p-8">
        <div className="flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card p-8">
        <div className="text-center text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium">No activity yet</p>
          <p className="text-sm mt-1">Activity history will appear here as actions are performed on this matter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">Activity History</h3>
        <p className="text-sm text-slate-600 mt-1">
          Track all changes and actions performed on this matter
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {activities.map((activity) => {
          const description = formatActionDescription(
            activity.action,
            activity.entityType,
            activity.metadata as Record<string, unknown> | null
          );
          const icon = getActivityIcon(activity.entityType, activity.action);
          const actorName = activity.actor.name || activity.actor.email;
          
          return (
            <div key={activity.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-grow">
                      <p className="text-sm font-medium text-slate-900">
                        {description}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        by <span className="font-medium">{actorName}</span>
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-slate-500">
                        {formatDateWithRelative(activity.createdAt).relative}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateWithRelative(activity.createdAt).absolute}
                      </p>
                    </div>
                  </div>

                  {/* Metadata details (if any interesting info) */}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        View details
                      </summary>
                      <pre className="mt-2 text-xs bg-slate-100 p-3 rounded border border-slate-200 overflow-x-auto">
                        {JSON.stringify(activity.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
