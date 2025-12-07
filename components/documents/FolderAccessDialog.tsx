"use client";

import { useState, useEffect } from "react";
import { X, Users, Lock, Globe, UserCheck } from "lucide-react";

interface FolderAccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  matterId?: string;
  matterTeamMemberIds?: string[];
}

type AccessScope = "PUBLIC" | "ROLE_BASED" | "USER_BASED" | "PRIVATE";

interface FolderAccessData {
  accessScope: AccessScope;
  accessMetadata?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
  };
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
}

export function FolderAccessDialog({
  isOpen,
  onClose,
  folderId,
  folderName,
  matterId,
  matterTeamMemberIds = [],
}: FolderAccessDialogProps) {
  const [accessScope, setAccessScope] = useState<AccessScope>("PUBLIC");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadFolderAccess();
      loadUsers();
    }
  }, [isOpen, folderId]);

  const loadFolderAccess = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}`);
      if (res.ok) {
        const data: FolderAccessData = await res.json();
        setAccessScope(data.accessScope);
        
        if (data.accessScope === "USER_BASED" && data.accessGrants) {
          setSelectedUsers(data.accessGrants.map(g => g.userId));
        } else if (data.accessScope === "ROLE_BASED" && data.accessMetadata?.allowedRoles) {
          setSelectedRoles(data.accessMetadata.allowedRoles);
        }
      }
    } catch (error) {
      console.error("Failed to load folder access", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
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
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        accessScope,
      };

      if (accessScope === "ROLE_BASED") {
        payload.accessMetadata = { allowedRoles: selectedRoles };
      } else if (accessScope === "USER_BASED") {
        payload.userIds = selectedUsers;
      }

      const res = await fetch(`/api/folders/${folderId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update folder access");
      }
    } catch (error) {
      console.error("Failed to update folder access", error);
      alert("Failed to update folder access");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
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
              Folder Access Settings
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Manage who can access: <span className="font-medium">{folderName}</span>
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
            {/* Access Scope Selection */}
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

            {/* Role Selection (when ROLE_BASED) */}
            {accessScope === "ROLE_BASED" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Roles
                </label>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* User Selection (when USER_BASED) */}
            {accessScope === "USER_BASED" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Users
                </label>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No users available
                    </div>
                  ) : (
                    <div className="divide-y">
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 truncate">
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
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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
