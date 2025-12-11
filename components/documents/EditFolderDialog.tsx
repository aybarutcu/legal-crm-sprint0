"use client";

import { useState, useEffect } from "react";
import { X, Folder, Globe, Users, UserCheck, Lock, Palette } from "lucide-react";

interface FolderData {
  id: string;
  name: string;
  color?: string | null;
  parentFolderId?: string | null;
  matterId?: string | null;
  contactId?: string | null;
  createdById: string;
  isMasterFolder?: boolean;
  accessScope: AccessScope;
  accessMetadata?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
  } | null;
  accessGrants?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  parentFolder?: {
    id: string;
    name: string;
    parentFolderId: string | null;
  } | null;
}

type AccessScope = "PUBLIC" | "ROLE_BASED" | "USER_BASED" | "PRIVATE";

interface EditFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  currentUserId?: string;
  currentUserRole?: string;
  matterId?: string;
  matterOwnerId?: string;
  matterTeamMemberIds?: string[];
  onUpdate: () => void;
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

export function EditFolderDialog({
  isOpen,
  onClose,
  folderId,
  currentUserId,
  currentUserRole,
  matterId,
  matterOwnerId,
  matterTeamMemberIds = [],
  onUpdate,
}: EditFolderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  
  // Editable fields
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [accessScope, setAccessScope] = useState<AccessScope>("PUBLIC");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Users list for USER_BASED access
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Permissions
  // System root folders: /Matters, /Contacts (parentFolderId is null, no matterId/contactId)
  const isSystemRootFolder = !folderData?.parentFolderId && !folderData?.matterId && !folderData?.contactId;
  
  // Master folders: Matter/Contact main folder (auto-created, cannot be renamed or deleted)
  const isMasterFolder = folderData?.isMasterFolder ?? false;
  
  // Both system root folders and master folders must be PUBLIC and non-editable
  const isProtectedFolder = isSystemRootFolder || isMasterFolder;
  
  const canEdit = !isProtectedFolder && (
    currentUserRole === "ADMIN" ||
    currentUserId === matterOwnerId ||
    currentUserId === folderData?.createdById
  );

  useEffect(() => {
    if (isOpen && folderId) {
      loadFolderData();
      loadUsers();
    }
  }, [isOpen, folderId]);

  const loadFolderData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}`);
      if (res.ok) {
        const data = await res.json();
        const folder = data.folder;
        console.log('[EditFolderDialog] Loaded folder:', {
          name: folder.name,
          isMasterFolder: folder.isMasterFolder,
          parentFolderId: folder.parentFolderId,
          matterId: folder.matterId,
          contactId: folder.contactId
        });
        setFolderData(folder);
        setName(folder.name);
        setColor(folder.color || "blue");
        setAccessScope(folder.accessScope);
        
        if (folder.accessScope === "ROLE_BASED" && folder.accessMetadata?.allowedRoles) {
          setSelectedRoles(folder.accessMetadata.allowedRoles);
        } else if (folder.accessScope === "USER_BASED" && folder.accessGrants) {
          setSelectedUsers(folder.accessGrants.map((g: any) => g.userId));
        } else {
          setSelectedRoles([]);
          setSelectedUsers([]);
        }
      }
    } catch (error) {
      console.error("Failed to load folder", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        const allUsers = Array.isArray(data) ? data : [];
        
        // Filter to matter team members if applicable
        if (matterId && matterTeamMemberIds.length > 0) {
          setUsers(allUsers.filter((u: any) => matterTeamMemberIds.includes(u.id)));
        } else {
          setUsers(allUsers);
        }
      }
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Folder name is required");
      return;
    }

    setSaving(true);
    try {
      // Update folder name and color
      const updatePayload: any = {
        name: name.trim(),
        color,
        accessScope,
      };

      if (accessScope === "ROLE_BASED") {
        updatePayload.accessMetadata = { allowedRoles: selectedRoles };
      }

      const updateRes = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        throw new Error("Failed to update folder");
      }

      // If USER_BASED, update access grants
      if (accessScope === "USER_BASED") {
        const accessRes = await fetch(`/api/folders/${folderId}/access`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessScope: "USER_BASED",
            userIds: selectedUsers,
          }),
        });

        if (!accessRes.ok) {
          throw new Error("Failed to update folder access");
        }
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to save folder", error);
      alert("Failed to save folder changes");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  const roles = ["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {isProtectedFolder ? "Folder Details" : "Edit Folder"}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {isProtectedFolder
                ? isMasterFolder 
                  ? "Master folders must remain PUBLIC for all matter team members"
                  : "Root folders cannot be renamed or have their access changed"
                : canEdit
                ? "Update folder name, color, and access settings"
                : "You don't have permission to edit this folder"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Folder Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit || isProtectedFolder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                placeholder="Enter folder name"
              />
            </div>

            {/* Folder Color */}
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
                    disabled={!canEdit || isProtectedFolder}
                    onClick={() => setColor(colorOption.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
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

            {/* Access Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Access Level
              </label>
              
              {isProtectedFolder && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <Lock className="inline h-4 w-4 mr-1" />
                  {isMasterFolder 
                    ? "Master folders always have PUBLIC access for all matter team members"
                    : "Root folders always have PUBLIC access for all matter team members"}
                </div>
              )}

              <div className="space-y-2">
                {/* Public */}
                <label className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                  !canEdit || isProtectedFolder ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="accessScope"
                    value="PUBLIC"
                    checked={accessScope === "PUBLIC"}
                    onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                    disabled={!canEdit || isProtectedFolder}
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
                <label className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                  !canEdit || isProtectedFolder ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="accessScope"
                    value="ROLE_BASED"
                    checked={accessScope === "ROLE_BASED"}
                    onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                    disabled={!canEdit || isProtectedFolder}
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

                {accessScope === "ROLE_BASED" && canEdit && !isProtectedFolder && (
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
                <label className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                  !canEdit || isProtectedFolder ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="accessScope"
                    value="USER_BASED"
                    checked={accessScope === "USER_BASED"}
                    onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                    disabled={!canEdit || isProtectedFolder}
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

                {accessScope === "USER_BASED" && canEdit && !isProtectedFolder && (
                  <div className="ml-9 mt-2 space-y-2 p-3 bg-slate-50 rounded-lg max-h-60 overflow-y-auto">
                    <p className="text-xs font-medium text-slate-700 mb-2">Select Users:</p>
                    {users.length === 0 ? (
                      <p className="text-sm text-slate-500">No users available</p>
                    ) : (
                      users.map((user) => (
                        <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                            className="rounded border-slate-300"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-slate-900">{user.name}</span>
                            <span className="text-xs text-slate-500 ml-2">({user.role})</span>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {/* Private */}
                <label className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                  !canEdit || isProtectedFolder ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="accessScope"
                    value="PRIVATE"
                    checked={accessScope === "PRIVATE"}
                    onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                    disabled={!canEdit || isProtectedFolder}
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
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canEdit || isProtectedFolder || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
