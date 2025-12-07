"use client";

import { useState, useEffect } from "react";
import { X, Plus, Shield } from "lucide-react";

interface FolderAccessGrant {
  id: string;
  userId: string;
  grantedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface FolderPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  currentScope: string;
  onSuccess?: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function FolderPermissionsDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  currentScope,
  onSuccess,
}: FolderPermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [scope, setScope] = useState(currentScope);
  const [grants, setGrants] = useState<FolderAccessGrant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadPermissions();
      loadUsers();
    }
  }, [open, folderId]);

  const loadPermissions = async () => {
    try {
      const res = await fetch(`/api/folders/${folderId}/access`);
      if (res.ok) {
        const data = await res.json();
        setGrants(data.grants || []);
      }
    } catch (error) {
      console.error("Failed to load permissions", error);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };

  const handleUpdateScope = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessScope: scope }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update scope");
      }

      setToast({ message: "Access scope updated", variant: "success" });
      onSuccess?.();
    } catch (error: any) {
      setToast({ message: error.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedUserId) {
      setToast({ message: "Please select a user", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to grant access");
      }

      setToast({ message: "Access granted successfully", variant: "success" });
      setSelectedUserId("");
      loadPermissions();
    } catch (error: any) {
      setToast({ message: error.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (grantId: string) => {
    if (!confirm("Are you sure you want to revoke this user's access?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/access/${grantId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to revoke access");
      }

      setToast({ message: "Access revoked", variant: "success" });
      loadPermissions();
    } catch (error: any) {
      setToast({ message: error.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold">Folder Permissions</h2>
              <p className="text-sm text-gray-600">{folderName}</p>
            </div>
          </div>

          {/* Access Scope */}
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <label className="block text-sm font-medium mb-2">
              Access Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            >
              <option value="PUBLIC">Public - Anyone with matter/contact access</option>
              <option value="RESTRICTED">Restricted - Only specific users</option>
              <option value="PRIVATE">Private - Only creator and admins</option>
            </select>
            {scope !== currentScope && (
              <button
                onClick={handleUpdateScope}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {loading ? "Updating..." : "Update Scope"}
              </button>
            )}
          </div>

          {/* Specific User Access */}
          {scope === "RESTRICTED" && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Specific User Access</h3>

              {/* Grant Access */}
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a user...</option>
                  {availableUsers
                    .filter((u) => !grants.find((g) => g.userId === u.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleGrantAccess}
                  disabled={loading || !selectedUserId}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Grant
                </button>
              </div>

              {/* Current Grants */}
              <div className="space-y-2">
                {grants.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No specific users granted access yet
                  </p>
                ) : (
                  grants.map((grant) => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{grant.user.name}</p>
                        <p className="text-sm text-gray-600">{grant.user.email}</p>
                      </div>
                      <button
                        onClick={() => handleRevokeAccess(grant.id)}
                        disabled={loading}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded shadow-lg ${
              toast.variant === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
