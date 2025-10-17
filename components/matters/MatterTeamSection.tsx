"use client";

import { useEffect, useState } from "react";

type TeamMember = {
  id: string;
  userId: string;
  role: "LAWYER" | "PARALEGAL";
  addedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: "LAWYER" | "PARALEGAL";
    isActive: boolean;
  };
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

type MatterTeamSectionProps = {
  matterId: string;
  currentUserRole?: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";
  matterOwnerId?: string | null;
};

export function MatterTeamSection({ 
  matterId, 
  currentUserRole,
  matterOwnerId 
}: MatterTeamSectionProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canManageTeam = currentUserRole === "ADMIN" || currentUserRole === "LAWYER";

  useEffect(() => {
    loadTeamMembers();
  }, [matterId]);

  useEffect(() => {
    if (showAddDialog) {
      loadAvailableUsers();
    }
  }, [showAddDialog]);

  async function loadTeamMembers() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/matters/${matterId}/team`);
      
      if (!response.ok) {
        if (response.status === 403) {
          setError("You don't have permission to view team members");
          return;
        }
        throw new Error("Failed to load team members");
      }
      
      const data = await response.json();
      setTeamMembers(data);
    } catch (err) {
      console.error("Error loading team members:", err);
      setError("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableUsers() {
    try {
      const response = await fetch("/api/users?role=LAWYER,PARALEGAL");
      if (!response.ok) throw new Error("Failed to load users");
      
      const users = await response.json();
      
      // Filter out users who are already team members
      const memberUserIds = new Set(teamMembers.map(m => m.userId));
      const available = users.filter((user: User) => !memberUserIds.has(user.id));
      
      setAvailableUsers(available);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  async function handleAddMember() {
    if (!selectedUserId) return;

    try {
      setAddingMember(true);
      setError(null);
      
      const response = await fetch(`/api/matters/${matterId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add team member");
      }

      await loadTeamMembers();
      setShowAddDialog(false);
      setSelectedUserId("");
    } catch (err) {
      console.error("Error adding team member:", err);
      setError(err instanceof Error ? err.message : "Failed to add team member");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string, userId: string) {
    if (!window.confirm("Are you sure you want to remove this team member?")) {
      return;
    }

    try {
      setRemovingMemberId(memberId);
      setError(null);
      
      const response = await fetch(`/api/matters/${matterId}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove team member");
      }

      await loadTeamMembers();
    } catch (err) {
      console.error("Error removing team member:", err);
      setError(err instanceof Error ? err.message : "Failed to remove team member");
    } finally {
      setRemovingMemberId(null);
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case "LAWYER":
        return "bg-blue-100 text-blue-700";
      case "PARALEGAL":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Team Members</h2>
        <div className="py-12 text-center text-sm text-slate-500">Loading team members...</div>
      </div>
    );
  }

  if (error && teamMembers.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Team Members</h2>
        <div className="py-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Team Members</h2>
        {canManageTeam && (
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Member
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {teamMembers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-slate-700">No team members yet</p>
          <p className="text-xs text-slate-500">
            {canManageTeam 
              ? "Add lawyers and paralegals to collaborate on this matter"
              : "Team members will appear here once added"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                  {member.user.name?.charAt(0).toUpperCase() || member.user.email?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {member.user.name || member.user.email}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeColor(
                        member.user.role
                      )}`}
                    >
                      {member.user.role}
                    </span>
                    {member.userId === matterOwnerId && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Owner
                      </span>
                    )}
                    {!member.user.isActive && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{member.user.email}</p>
                  <p className="text-xs text-slate-400">
                    Added {new Date(member.addedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {canManageTeam && member.userId !== matterOwnerId && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id, member.userId)}
                  disabled={removingMemberId === member.id}
                  className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Remove team member"
                >
                  {removingMemberId === member.id ? (
                    <span className="text-xs">Removing...</span>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Member Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Team Member</h3>
            
            <div className="mb-4">
              <label htmlFor="user-select" className="block text-sm font-medium text-slate-700 mb-2">
                Select User
              </label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select a user --</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.role})
                  </option>
                ))}
              </select>
              {availableUsers.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  All available users are already team members
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddDialog(false);
                  setSelectedUserId("");
                  setError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={addingMember}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={!selectedUserId || addingMember}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingMember ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
