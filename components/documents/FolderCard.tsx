"use client";

import { Folder as FolderIcon, MoreVertical } from "lucide-react";
import { useState } from "react";

export interface FolderCardData {
  id: string;
  name: string;
  color?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  isMasterFolder?: boolean;
  matterId?: string | null;
  contactId?: string | null;
  parentFolderId?: string | null;
  parentFolder?: {
    id: string;
    name: string;
    parentFolderId: string | null;
  } | null;
  _count: {
    documents: number;
    subfolders: number;
  };
}

interface FolderCardProps {
  folder: FolderCardData;
  onOpen: (folderId: string) => void;
  onEdit?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  onChangeColor?: (folderId: string, color: string) => void;
  onDropDocument?: (folderId: string, documentId: string) => void;
}

const FOLDER_COLORS = {
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-yellow-500",
  red: "text-red-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  gray: "text-slate-500",
};

export function FolderCard({
  folder,
  onOpen,
  onEdit,
  onDelete,
  onChangeColor,
  onDropDocument,
}: FolderCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const colorClass = folder.color
    ? FOLDER_COLORS[folder.color as keyof typeof FOLDER_COLORS] || "text-blue-500"
    : "text-blue-500";

  // Check if this is a master folder (matter/contact main folder)
  // Master folders cannot be renamed or deleted
  const isMasterFolder = folder.isMasterFolder ?? false;

  const handleDoubleClick = () => {
    onOpen(folder.id);
  };

  const handleEdit = () => {
    onEdit?.(folder.id);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (isMasterFolder) {
      alert("Master folders cannot be deleted. This is the main folder for the matter/contact and must remain for organizational purposes.");
      setShowMenu(false);
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${folder.name}"?`)) {
      onDelete?.(folder.id);
    }
    setShowMenu(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const documentId = e.dataTransfer.getData("documentId");
    if (documentId && onDropDocument) {
      onDropDocument(folder.id, documentId);
    }
  };

  return (
    <div
      className={`group relative rounded-lg border bg-white p-4 hover:shadow-md transition cursor-pointer ${
        isDragOver
          ? "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500"
          : "border-slate-200 hover:border-slate-300"
      }`}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Menu button */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-slate-100 transition"
        >
          <MoreVertical className="h-4 w-4 text-slate-600" />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-slate-200 bg-white shadow-lg">
              <button
                onClick={handleEdit}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 rounded-t-lg"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Folder icon and name */}
      <div className="flex items-start gap-3">
        <FolderIcon className={`h-10 w-10 ${colorClass} ${isDragOver ? "scale-110" : ""} transition-transform`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{folder.name}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {folder._count.documents} file{folder._count.documents !== 1 ? "s" : ""}
            {folder._count.subfolders > 0 &&
              `, ${folder._count.subfolders} folder${folder._count.subfolders !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/50 rounded-lg pointer-events-none">
          <div className="text-sm font-medium text-blue-600">
            Drop to move here
          </div>
        </div>
      )}

      {/* Created by */}
      <p className="text-xs text-slate-400 mt-3">
        Created by {folder.createdBy.name || folder.createdBy.email}
      </p>
    </div>
  );
}
