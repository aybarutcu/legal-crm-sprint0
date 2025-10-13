import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { PortalHeader } from "@/components/portal/PortalHeader";

type PortalLayoutProps = {
  children: ReactNode;
};

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/portal/login");
  }

  if (session.user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader userName={session.user.name ?? session.user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
