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
      {
        href: "/questionnaires",
        label: "Questionnaires",
        allowedRoles: [Role.ADMIN, Role.LAWYER],
      },
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex sticky top-0 h-screen">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="border-b border-slate-200 px-6 py-6">
            <Link href="/dashboard" className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                Legal CRM
              </span>
              <span className="mt-1 text-lg font-bold text-slate-900">
                Yönetim Paneli
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav navGroups={NAV_GROUPS} userRole={session.user.role} />
          </div>

          {/* User info footer */}
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {session.user.name?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {session.user.name || "User"}
                </p>
                <p className="truncate text-xs text-slate-500">{session.user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 min-w-0 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Legal CRM Dashboard
                </h1>
                <p className="mt-0.5 text-sm text-slate-600">
                  Günlük özet kartları, CRM akışları ve rol tabanlı erişim.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors lg:inline-flex"
                >
                  Marketing
                </Link>
                <TaskNotifications />
                <ProfileMenu user={session.user} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 bg-slate-50 px-4 py-4">{children}</main>
      </div>
    </div>
  );
}
