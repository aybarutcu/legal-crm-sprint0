"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import {
  ChevronDown,
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  Workflow,
  ClipboardList,
  FileText,
  Calendar,
  Settings,
  Shield,
  UserCog,
} from "lucide-react";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  allowedRoles?: Role[];
};

export type SidebarNavGroup = {
  label: string;
  defaultOpen?: boolean;
  allowedRoles?: Role[];
  items: SidebarNavItem[];
};

type SidebarNavProps = {
  navGroups: SidebarNavGroup[];
  userRole: Role | null | undefined;
};

// Icon mapping helper
const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/contacts": Users,
  "/matters": Briefcase,
  "/tasks": CheckSquare,
  "/workflows/templates": Workflow,
  "/questionnaires": ClipboardList,
  "/documents": FileText,
  "/events": Calendar,
  "/settings/calendar": Settings,
  "/users": UserCog,
  "/dashboard/admin": Shield,
};

export function SidebarNav({ navGroups, userRole }: SidebarNavProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of navGroups) {
      initial[group.label] = group.defaultOpen ?? true;
    }
    return initial;
  });

  const groups = useMemo(() => {
    return navGroups
      .filter((group) => {
        if (!group.allowedRoles || !group.allowedRoles.length) return true;
        if (!userRole) return false;
        return group.allowedRoles.includes(userRole);
      })
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.allowedRoles || !item.allowedRoles.length) return true;
          if (!userRole) return false;
          return item.allowedRoles.includes(userRole);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [navGroups, userRole]);

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {groups.map((group) => {
        const isOpen = openGroups[group.label];
        return (
          <div key={group.label} className="mb-2">
            {/* Group Header */}
            <button
              type="button"
              onClick={() =>
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.label]: !prev[group.label],
                }))
              }
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Group Items */}
            {isOpen && (
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = iconMap[item.href];

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-blue-50 text-blue-700 shadow-sm"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {Icon && (
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              isActive ? "text-blue-600" : "text-slate-400"
                            }`}
                          />
                        )}
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
