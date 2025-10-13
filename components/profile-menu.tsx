"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";

type ProfileMenuProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role?: Role;
  };
};

export function ProfileMenu({ user }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const displayName = user.name ?? user.email ?? "Kullanıcı";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="text-left">
          <span className="block leading-tight">{displayName}</span>
          <span className="block text-xs uppercase tracking-widest text-slate-400">
            {user.role ?? "USER"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <div className="mb-3">
            <div className="font-semibold text-slate-900">{displayName}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white hover:bg-slate-700"
          >
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
