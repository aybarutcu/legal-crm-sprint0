"use client";

import { useState, useEffect } from "react";
import { X, Lock, Globe, Users, UserCheck } from "lucide-react";
import { Role, DocumentAccessScope } from "@prisma/client";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

interface DocumentAccessControlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  matterId?: string | null;
  contactId?: string | null;
  currentScope: DocumentAccessScope;
  currentAccessMetadata?: Record<string, unknown> | null;
  onSave: (
    scope: DocumentAccessScope,
    metadata: Record<string, unknown> | null,
    userGrants?: string[]
  ) => Promise<void>;
}

export function DocumentAccessControlDialog({
  isOpen,
  onClose,
  documentId,
  matterId,
  contactId,
  currentScope,
  currentAccessMetadata,
  onSave,
}: DocumentAccessControlDialogProps) {
  const [scope, setScope] = useState<DocumentAccessScope>(currentScope);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(
    (currentAccessMetadata?.allowedRoles as Role[]) || []
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Load matter/contact team members
  useEffect(() => {
    const loadTeam = async () => {
      if (!isOpen || (!matterId && !contactId)) return;

      setLoadingTeam(true);
      try {
        let url = "";
        if (matterId) {
          url = `/api/matters/${matterId}/team`;
        } else if (contactId) {
          // For contacts, we need a different approach since they don't have team members
          // Just get the contact owner
          const res = await fetch(`/api/contacts/${contactId}`);
          if (res.ok) {
            const contact = await res.json();
            if (contact.owner) {
              setTeamMembers([
                {
                  id: contact.owner.id,
                  name: contact.owner.name,
                  email: contact.owner.email,
                  role: contact.owner.role,
                },
              ]);
            }
          }
          return;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Extract unique users from team
          const uniqueUsers = new Map<string, TeamMember>();
          data.team?.forEach((member: any) => {
            if (member.user && !uniqueUsers.has(member.user.id)) {
              uniqueUsers.set(member.user.id, {
                id: member.user.id,
                name: member.user.name,
                email: member.user.email,
                role: member.role,
              });
            }
          });
          setTeamMembers(Array.from(uniqueUsers.values()));
        }
      } catch (error) {
        console.error("Failed to load team members:", error);
      } finally {
        setLoadingTeam(false);
      }
    };

    loadTeam();
  }, [isOpen, matterId, contactId]);

  // Load current access grants for USER_BASED scope
  useEffect(() => {
    const loadGrants = async () => {
      if (!isOpen || scope !== "USER_BASED") return;

      try {
        const res = await fetch(`/api/documents/${documentId}/access`);
        if (res.ok) {
          const data = await res.json();
          const grantedUserIds = data.grants.map((grant: any) => grant.userId);
          setSelectedUsers(grantedUserIds);
        }
      } catch (error) {
        console.error("Failed to load access grants:", error);
      }
    };

    loadGrants();
  }, [isOpen, documentId, scope]);

  const handleSave = async () => {
    setLoading(true);
    try {
      let metadata: Record<string, unknown> | null = null;
      let userGrants: string[] | undefined = undefined;

      if (scope === "ROLE_BASED") {
        metadata = { allowedRoles: selectedRoles };
      } else if (scope === "USER_BASED") {
        userGrants = selectedUsers;
      }

      await onSave(scope, metadata, userGrants);
      onClose();
    } catch (error) {
      console.error("Failed to save access control:", error);
      alert("Failed to save access control settings");
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: Role) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Document Access Control</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Access Scope Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Who can access this document?
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="PUBLIC"
                  checked={scope === "PUBLIC"}
                  onChange={(e) => setScope(e.target.value as DocumentAccessScope)}
                  className="w-4 h-4 mt-0.5 text-blue-600"
                />
                <Globe className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">All Team Members</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Everyone in the {matterId ? "matter" : "contact"} team can view this document
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="ROLE_BASED"
                  checked={scope === "ROLE_BASED"}
                  onChange={(e) => setScope(e.target.value as DocumentAccessScope)}
                  className="w-4 h-4 mt-0.5 text-blue-600"
                />
                <Users className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Specific Roles</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Only team members with selected roles can view
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="USER_BASED"
                  checked={scope === "USER_BASED"}
                  onChange={(e) => setScope(e.target.value as DocumentAccessScope)}
                  className="w-4 h-4 mt-0.5 text-blue-600"
                />
                <UserCheck className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Specific People</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Only selected team members can view
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="PRIVATE"
                  checked={scope === "PRIVATE"}
                  onChange={(e) => setScope(e.target.value as DocumentAccessScope)}
                  className="w-4 h-4 mt-0.5 text-blue-600"
                />
                <Lock className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Private</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Only you and {matterId ? "matter" : "contact"} owner can view this document
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Role Selection (for ROLE_BASED) */}
          {scope === "ROLE_BASED" && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Select Allowed Roles
              </label>
              <div className="space-y-2">
                {(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"] as Role[]).map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-slate-700">{role}</span>
                  </label>
                ))}
              </div>
              {selectedRoles.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ Please select at least one role
                </p>
              )}
            </div>
          )}

          {/* User Selection (for USER_BASED) */}
          {scope === "USER_BASED" && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Select Team Members
              </label>
              {loadingTeam ? (
                <p className="text-sm text-slate-500">Loading team members...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-slate-500">No team members found</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(member.id)}
                        onChange={() => toggleUser(member.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {member.name || member.email}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {member.email} • {member.role}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedUsers.length === 0 && !loadingTeam && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ Please select at least one person
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                loading ||
                (scope === "ROLE_BASED" && selectedRoles.length === 0) ||
                (scope === "USER_BASED" && selectedUsers.length === 0)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : "Save Access Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
