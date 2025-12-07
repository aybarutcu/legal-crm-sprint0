"use client";

import { useState, useEffect } from "react";
import { X, Folder, Globe, Users, UserCheck, Lock, Palette } from "lucide-react";

interface FolderOption {
  id: string;
  name: string;
  parentFolderId?: string | null;
  color?: string | null;
}

type AccessScope = "PUBLIC" | "ROLE_BASED" | "USER_BASED" | "PRIVATE";

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color?: string, accessScope?: AccessScope, accessMetadata?: any, userIds?: string[]) => void;
  availableFolders?: FolderOption[];
  selectedParentFolderId?: string | null;
  onParentFolderChange?: (folderId: string | null) => void;
  matterId?: string;
  matterTeamMemberIds?: string[];
}

const FOLDER_COLORS = [
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "gray", label: "Gray", class: "bg-slate-500" },
];

export function CreateFolderDialog({
  isOpen,
  onClose,
  onCreate,
  availableFolders = [],
  selectedParentFolderId,
  onParentFolderChange,
  matterId,
  matterTeamMemberIds = [],
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [accessScope, setAccessScope] = useState<AccessScope>("PUBLIC");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (isOpen && accessScope === "USER_BASED") {
      loadUsers();
    }
  }, [isOpen, accessScope]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        // API returns array directly, not wrapped in { users: ... }
        const allUsers = Array.isArray(data) ? data : [];
        
        // If matterId is provided and we have team member IDs, filter to only team members
        if (matterId && matterTeamMemberIds.length > 0) {
          setUsers(allUsers.filter(u => matterTeamMemberIds.includes(u.id)));
        } else {
          setUsers(allUsers);
        }
      }
    } catch (error) {
      console.error("Failed to load users", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      const accessMetadata = accessScope === "ROLE_BASED" && selectedRoles.length > 0
        ? { allowedRoles: selectedRoles }
        : undefined;
      
      const userIds = accessScope === "USER_BASED" && selectedUsers.length > 0
        ? selectedUsers
        : undefined;

      onCreate(name.trim(), color, accessScope, accessMetadata, userIds);
      setName("");
      setColor("blue");
      setAccessScope("PUBLIC");
      setSelectedRoles([]);
      setSelectedUsers([]);
      onClose();
    }
  };

  const handleClose = () => {
    setName("");
    setColor("blue");
    setAccessScope("PUBLIC");
    setSelectedRoles([]);
    setSelectedUsers([]);
    onClose();
  };

  const roles = ["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"];

  const getFolderColor = (folderColor?: string) => {
    const colorMap: Record<string, string> = {
      blue: "text-blue-500",
      green: "text-green-500",
      yellow: "text-yellow-500",
      red: "text-red-500",
      purple: "text-purple-500",
      pink: "text-pink-500",
      gray: "text-slate-500",
    };
    return colorMap[folderColor || "blue"] || "text-blue-500";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Create Folder
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Create a new folder with custom color and access settings
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Parent folder selection */}
          {availableFolders.length > 0 && onParentFolderChange && (
            <div>
              <label htmlFor="parentFolder" className="block text-sm font-medium text-slate-700 mb-2">
                Parent Folder
              </label>
              <select
                id="parentFolder"
                value={selectedParentFolderId || ""}
                onChange={(e) => onParentFolderChange(e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">📁 Root (No Parent)</option>
                {availableFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    📁 {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Folder name */}
          <div>
            <label htmlFor="folderName" className="block text-sm font-medium text-slate-700 mb-2">
              Folder Name
            </label>
            <input
              id="folderName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Folder color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Palette className="inline h-4 w-4 mr-1" />
              Folder Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setColor(colorOption.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                    color === colorOption.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded ${colorOption.class}`} />
                  <span className="text-sm">{colorOption.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Access Scope */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Access Level
            </label>
            <div className="space-y-2">
              {/* Public */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="accessScope"
                  value="PUBLIC"
                  checked={accessScope === "PUBLIC"}
                  onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-slate-900">Public</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Anyone associated with the matter/contact can access
                  </p>
                </div>
              </label>

              {/* Role Based */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="accessScope"
                  value="ROLE_BASED"
                  checked={accessScope === "ROLE_BASED"}
                  onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-slate-900">Role Based</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Only specific roles can access
                  </p>
                </div>
              </label>

              {accessScope === "ROLE_BASED" && (
                <div className="ml-9 mt-2 space-y-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 mb-2">Select Roles:</p>
                  {roles.map((role) => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">{role}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* User Based */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="accessScope"
                  value="USER_BASED"
                  checked={accessScope === "USER_BASED"}
                  onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-slate-900">User Based</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Only specific users can access
                  </p>
                </div>
              </label>

              {accessScope === "USER_BASED" && (
                <div className="ml-9 mt-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 mb-2">Select Users:</p>
                  {loadingUsers ? (
                    <div className="py-4 text-center text-sm text-slate-500">
                      Loading users...
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-4 text-center text-sm text-slate-500">
                      No users available
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {users.map((user) => (
                        <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                            className="rounded border-slate-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 truncate">
                              {user.name}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {user.email} · {user.role}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Private */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="accessScope"
                  value="PRIVATE"
                  checked={accessScope === "PRIVATE"}
                  onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-slate-900">Private</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Only folder creator and admins can access
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
