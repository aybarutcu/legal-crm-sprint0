"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  FileText, 
  Users, 
  CheckSquare, 
  Workflow,
  Plus
} from "lucide-react";

interface QuickActionsMenuProps {
  onAddDocument: () => void;
  onAddParty: () => void;
  onAddTask: () => void;
  onAddWorkflow: () => void;
  className?: string;
}

export function QuickActionsMenu({
  onAddDocument,
  onAddParty,
  onAddTask,
  onAddWorkflow,
  className = "",
}: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { icon: FileText, label: "Add Document", onClick: onAddDocument },
    { icon: Users, label: "Add Party", onClick: onAddParty },
    { icon: CheckSquare, label: "Add Task", onClick: onAddTask },
    { icon: Workflow, label: "Add Workflow", onClick: onAddWorkflow },
  ];

  const handleActionClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Plus className="h-4 w-4" />
        Quick Actions
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="py-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleActionClick(action.onClick)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <action.icon className="h-4 w-4 text-slate-500" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
