import { CircleDot, Clock, CheckCircle, Archive, Pause } from "lucide-react";

type MatterStatus = "OPEN" | "PENDING" | "CLOSED" | "ARCHIVED" | "ON_HOLD";

interface MatterStatusBadgeProps {
  status: MatterStatus;
}

export function MatterStatusBadge({ status }: MatterStatusBadgeProps) {
  const configMap = {
    OPEN: {
      color: "bg-emerald-100 text-emerald-700 border-emerald-300",
      icon: <CircleDot className="h-4 w-4" />,
      label: "Active",
    },
    PENDING: {
      color: "bg-yellow-100 text-yellow-700 border-yellow-300",
      icon: <Clock className="h-4 w-4" />,
      label: "Pending",
    },
    CLOSED: {
      color: "bg-slate-100 text-slate-600 border-slate-300",
      icon: <CheckCircle className="h-4 w-4" />,
      label: "Closed",
    },
    ARCHIVED: {
      color: "bg-slate-100 text-slate-500 border-slate-300",
      icon: <Archive className="h-4 w-4" />,
      label: "Archived",
    },
    ON_HOLD: {
      color: "bg-orange-100 text-orange-700 border-orange-300",
      icon: <Pause className="h-4 w-4" />,
      label: "On Hold",
    },
  };

  const config = configMap[status] || configMap.OPEN;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${config.color}`}
      role="status"
      aria-label={`Matter status: ${config.label}`}
    >
      {config.icon}
      {config.label}
    </div>
  );
}
