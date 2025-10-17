"use client";

interface WorkflowExecutionLogProps {
  workflow: {
    id: string;
    createdAt: string | Date;
    steps: Array<{
      id: string;
      title: string;
      order: number;
      actionState: string;
      startedAt: string | Date | null;
      completedAt: string | Date | null;
    }>;
    createdBy?: {
      name: string | null;
      email: string | null;
    } | null;
  };
}

export function WorkflowExecutionLog({ workflow }: WorkflowExecutionLogProps) {
  const logs: Array<{ timestamp: Date; action: string; details?: string }> = [];
  
  // Add workflow creation
  logs.push({
    timestamp: new Date(workflow.createdAt),
    action: "İş akışı oluşturuldu",
    details: workflow.createdBy 
      ? `Oluşturan: ${workflow.createdBy.name ?? workflow.createdBy.email}` 
      : undefined,
  });
  
  // Add step events in chronological order
  const stepEvents: Array<{ timestamp: Date; action: string; details?: string }> = [];
  
  workflow.steps.forEach((step) => {
    if (step.startedAt) {
      stepEvents.push({
        timestamp: new Date(step.startedAt),
        action: `"${step.title}" başlatıldı`,
        details: undefined,
      });
    }
    if (step.completedAt) {
      stepEvents.push({
        timestamp: new Date(step.completedAt),
        action: `"${step.title}" ${step.actionState === "COMPLETED" ? "tamamlandı" : "atlandı"}`,
        details: undefined,
      });
    }
  });
  
  // Sort all events by timestamp and merge
  logs.push(...stepEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
  
  return (
    <div className="max-h-96 overflow-y-auto space-y-2">
      {logs.map((log, idx) => (
        <div key={idx} className="text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{log.action}</span>
            <span className="text-slate-400">
              {log.timestamp.toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {log.details && (
            <div className="mt-0.5 text-slate-600 pl-2 border-l-2 border-slate-200">
              {log.details}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
