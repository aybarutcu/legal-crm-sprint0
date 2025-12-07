"use client";

import Link from "next/link";
import { ChevronRight, Home, Folder } from "lucide-react";

export interface BreadcrumbItem {
  id: string;
  name: string;
}

interface FolderBreadcrumbProps {
  path: BreadcrumbItem[];
  matterId?: string;
  contactId?: string;
  onNavigate?: (folderId: string | null) => void;
}

export function FolderBreadcrumb({
  path,
  matterId,
  contactId,
  onNavigate,
}: FolderBreadcrumbProps) {
  const buildUrl = (folderId: string | null) => {
    const params = new URLSearchParams();
    if (matterId) params.set("matterId", matterId);
    if (contactId) params.set("contactId", contactId);
    if (folderId) params.set("folderId", folderId);
    return `/documents?${params.toString()}`;
  };

  const handleClick = (e: React.MouseEvent, folderId: string | null) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(folderId);
    }
  };

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-600">
      {/* Root/Home */}
      <Link
        href={buildUrl(null)}
        onClick={(e) => handleClick(e, null)}
        className="flex items-center gap-1 hover:text-slate-900 transition"
      >
        <Home className="h-4 w-4" />
        <span>Root</span>
      </Link>

      {/* Breadcrumb trail */}
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          {index === path.length - 1 ? (
            // Current folder (not clickable)
            <div className="flex items-center gap-1 font-medium text-slate-900">
              <Folder className="h-4 w-4" />
              <span>{item.name}</span>
            </div>
          ) : (
            // Parent folders (clickable)
            <Link
              href={buildUrl(item.id)}
              onClick={(e) => handleClick(e, item.id)}
              className="flex items-center gap-1 hover:text-slate-900 transition"
            >
              <Folder className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
