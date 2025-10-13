import "@/lib/events/reminder-worker";
import "@/lib/tasks/reminder-worker";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { ProfileMenu } from "@/components/profile-menu";
import { TaskNotifications } from "@/components/tasks/TaskNotifications";
import {
  SidebarNav,
  type SidebarNavGroup,
} from "@/components/navigation/SidebarNav";

const NAV_GROUPS: SidebarNavGroup[] = [
  {
    label: "Genel",
    defaultOpen: true,
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "CRM",
    defaultOpen: true,
    items: [
      { href: "/contacts", label: "Contacts" },
      { href: "/matters", label: "Matters" },
    ],
  },
  {
    label: "İş Akışı",
    defaultOpen: true,
    items: [
      { href: "/tasks", label: "Tasks" },
      { href: "/workflows/templates", label: "Workflows" },
    ],
  },
  {
    label: "Belgeler & Planlama",
    defaultOpen: false,
    items: [
      { href: "/documents", label: "Documents" },
      { href: "/events", label: "Events" },
    ],
  },
  {
    label: "Ayarlar",
    defaultOpen: false,
    items: [{ href: "/settings/calendar", label: "Calendar Settings" }],
  },
  {
    label: "Yönetim",
    defaultOpen: true,
    allowedRoles: [Role.ADMIN, Role.LAWYER],
    items: [
      {
        href: "/users",
        label: "Kullanıcılar",
        allowedRoles: [Role.ADMIN, Role.LAWYER],
      },
      {
        href: "/dashboard/admin",
        label: "Admin Paneli",
        allowedRoles: [Role.ADMIN],
      },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-col gap-6 border-r border-slate-200 bg-white px-6 py-10 lg:flex">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Legal CRM
          </div>
          <div className="text-lg font-semibold text-slate-900">
            Yönetim Paneli
          </div>
        </div>
        <SidebarNav navGroups={NAV_GROUPS} userRole={session.user.role} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Legal CRM Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                Günlük özet kartları, CRM akışları ve rol tabanlı erişim.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 lg:inline-flex"
              >
                Marketing
              </Link>
              <TaskNotifications />
              <ProfileMenu user={session.user} />
            </div>
          </div>
        </header>

        <main className="flex-1 bg-slate-50 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
