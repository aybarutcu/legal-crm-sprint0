import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getAllMetrics } from "@/lib/metrics";
import { Role } from "@prisma/client";

/**
 * GET /api/workflows/metrics
 * 
 * Returns workflow metrics for observability.
 * Only accessible by ADMIN users.
 */
export const GET = withApiHandler(
  async (_req, { session }) => {
    const user = session!.user!;
    
    // Only admins can view metrics
    if (user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can view workflow metrics" },
        { status: 403 }
      );
    }

    const allMetrics = getAllMetrics();
    
    // Filter to only workflow-related metrics
    const workflowMetrics = Object.entries(allMetrics)
      .filter(([key]) => key.startsWith("workflow."))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, number>);

    // Organize metrics by category
    const organized = {
      steps: {
        started: {} as Record<string, number>,
        completed: {} as Record<string, number>,
        failed: {} as Record<string, number>,
        skipped: {} as Record<string, number>,
        claimed: {} as Record<string, number>,
        advanced: {} as Record<string, number>,
      },
      transitions: {} as Record<string, number>,
      handlers: {
        durations: {} as Record<string, number>,
        errors: {} as Record<string, number>,
      },
      instances: {
        created: {} as Record<string, number>,
        completed: {} as Record<string, number>,
      },
      cycleTime: {} as Record<string, number>,
      notifications: {
        sent: {} as Record<string, number>,
        failed: {} as Record<string, number>,
      },
      raw: workflowMetrics,
    };

    // Categorize metrics
    for (const [key, value] of Object.entries(workflowMetrics)) {
      const parts = key.split(".");
      
      if (parts[1] === "step") {
        const action = parts[2]; // started, completed, failed, etc.
        const actionType = parts[3] || "total";
        
        if (action in organized.steps) {
          organized.steps[action as keyof typeof organized.steps][actionType] = value;
        }
      } else if (parts[1] === "transition") {
        organized.transitions[key] = value;
      } else if (parts[1] === "handler") {
        if (parts[2] === "error") {
          organized.handlers.errors[key] = value;
        } else {
          organized.handlers.durations[key] = value;
        }
      } else if (parts[1] === "instance") {
        const action = parts[2]; // created, completed
        if (action === "created" || action === "completed") {
          organized.instances[action][key] = value;
        }
      } else if (parts[1] === "cycle_time") {
        organized.cycleTime[key] = value;
      } else if (parts[1] === "notification") {
        const action = parts[2]; // sent, failed
        if (action === "sent" || action === "failed") {
          organized.notifications[action][key] = value;
        }
      }
    }

    // Calculate derived metrics
    const totalSteps = {
      started: organized.steps.started.total || 0,
      completed: organized.steps.completed.total || 0,
      failed: organized.steps.failed.total || 0,
      skipped: organized.steps.skipped.total || 0,
    };

    const successRate = totalSteps.completed > 0
      ? (totalSteps.completed / (totalSteps.completed + totalSteps.failed)) * 100
      : 0;

    const summary = {
      totalStepsStarted: totalSteps.started,
      totalStepsCompleted: totalSteps.completed,
      totalStepsFailed: totalSteps.failed,
      totalStepsSkipped: totalSteps.skipped,
      successRate: Math.round(successRate * 100) / 100,
      totalInstancesCreated: organized.instances.created["workflow.instance.created.total"] || 0,
      totalNotificationsSent: organized.notifications.sent["workflow.notification.sent.total"] || 0,
      totalNotificationsFailed: organized.notifications.failed["workflow.notification.failed.total"] || 0,
    };

    return NextResponse.json({
      summary,
      metrics: organized,
      timestamp: new Date().toISOString(),
    });
  }
);
