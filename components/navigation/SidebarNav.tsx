"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { ChevronDown } from "lucide-react";

export type SidebarNavItem = {
  href: string;
  label: string;
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
    <nav className="flex flex-1 flex-col gap-4">
      {groups.map((group) => {
        const isOpen = openGroups[group.label];
        return (
          <div key={group.label} className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() =>
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.label]: !prev[group.label],
                }))
              }
              className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen ? (
              <ul className="flex flex-col gap-1 px-3 py-2">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-accent/10 text-accent"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
