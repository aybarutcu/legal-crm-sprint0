"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback } from "react";

type PortalHeaderProps = {
  userName?: string | null;
};

const NAV_LINKS = [
  { href: "/portal", label: "Panom" },
  { href: "/portal/matters", label: "Davalarım" },
  { href: "/portal/approvals", label: "Onaylar" },
  { href: "/portal/messages", label: "Mesajlar" },
];

export function PortalHeader({ userName }: PortalHeaderProps) {
  const pathname = usePathname();

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: "/portal/login" });
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link
            href="/portal"
            className="text-lg font-semibold text-slate-900"
          >
            Legal CRM Portal
          </Link>
          <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? "text-accent" : "hover:text-slate-900"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {userName ? (
            <span className="hidden text-sm text-slate-600 md:inline">
              {userName}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </header>
  );
}
