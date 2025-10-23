import { CheckCircle2 } from "lucide-react";

interface TaskConfig {
  description?: string;
  estimatedMinutes?: number;
}

interface TaskData {
  notes?: string;
}

interface TaskViewerProps {
  config: TaskConfig;
  data: TaskData;
}

export function TaskViewer({ config, data }: TaskViewerProps) {
  return (
    <div className="rounded-lg border-2 border-cyan-200 bg-cyan-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-5 w-5 text-cyan-600" />
        <h4 className="font-semibold text-cyan-900">Task Completed</h4>
      </div>
      
      {/* Task description */}
      {config?.description && (
        <div className="mb-3 rounded-lg border border-cyan-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-600 mb-1">Task Description:</p>
          <p className="text-sm text-slate-700">{config.description}</p>
        </div>
      )}
      
      {/* Show estimated time if provided */}
      {config?.estimatedMinutes && (
        <div className="mb-3 text-xs text-slate-600">
          <span className="font-medium">Estimated time:</span> {config.estimatedMinutes} minutes
        </div>
      )}
      
      {/* Completion notes */}
      {data?.notes && (
        <div className="rounded-lg border border-cyan-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-600 mb-1">Completion Notes:</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}
    </div>
  );
}
