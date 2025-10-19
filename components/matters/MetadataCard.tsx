import { type ReactNode } from "react";

interface MetadataCardProps {
  icon: ReactNode;
  label: string;
  value: string | ReactNode;
  subtitle?: string;
  className?: string;
}

export function MetadataCard({ icon, label, value, subtitle, className = "" }: MetadataCardProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">{value}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}
