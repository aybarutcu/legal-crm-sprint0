"use client";

import { useState, useEffect } from "react";
import { DocumentAccessScope, Role } from "@prisma/client";
import { X, Upload, Globe, Users, UserCheck, Lock, Tag, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { DocumentTypeIcon } from "./DocumentTypeIcon";
import { formatFileSize } from "@/lib/documents/format-utils";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

interface Matter {
  id: string;
  title: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    filename: string;
    displayName: string | null;
    mimeType: string;
    size: number;
    version: number;
    matterId?: string | null;
    contactId?: string | null;
    folderId?: string | null;
    accessScope: DocumentAccessScope;
    accessMetadata?: Record<string, unknown> | null;
    tags?: string[];
  };
  matters: Matter[];
  contacts: Contact[];
  onSave: (newDocumentId?: string) => Promise<void>;
}

export function EditDocumentDialog({
  isOpen,
  onClose,
  document,
  matters,
  contacts,
  onSave,
}: EditDocumentDialogProps) {
  const [activeTab, setActiveTab] = useState<"details" | "version">("details");
  
  // Details tab state
  const [displayName, setDisplayName] = useState(document.displayName || "");
  const [tags, setTags] = useState<string[]>(document.tags || []);
  const [newTag, setNewTag] = useState("");
  
  // Access control state
  const [accessScope, setAccessScope] = useState<DocumentAccessScope>(document.accessScope);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  
  // Version upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load team members
  useEffect(() => {
    if (!isOpen) return;
    if (!document.matterId && !document.contactId) return;

    const loadTeam = async () => {
      setLoadingTeam(true);
      try {
        let teamData: TeamMember[] = [];
        
        if (document.matterId) {
          const res = await fetch(`/api/matters/${document.matterId}/team`);
          if (res.ok) {
            const data = await res.json();
            // The API returns MatterTeamMember[] with nested user objects
            teamData = (data || []).map((item: any) => ({
              id: item.user.id,
              name: item.user.name,
              email: item.user.email,
              role: item.user.role,
            }));
          }
        } else if (document.contactId) {
          const res = await fetch(`/api/contacts/${document.contactId}`);
          if (res.ok) {
            const contact = await res.json();
            if (contact.userId) {
              teamData = [{
                id: contact.userId,
                name: contact.user?.name || null,
                email: contact.user?.email || "",
                role: contact.user?.role || "CLIENT",
              }];
            }
          }
        }
        
        setTeamMembers(teamData);
      } catch (err) {
        console.error("Failed to load team:", err);
      } finally {
        setLoadingTeam(false);
      }
    };

    loadTeam();
  }, [isOpen, document.matterId, document.contactId]);

  // Load access grants for USER_BASED
  useEffect(() => {
    if (!isOpen || accessScope !== "USER_BASED") return;

    const loadGrants = async () => {
      try {
        const res = await fetch(`/api/documents/${document.id}/access`);
        if (res.ok) {
          const data = await res.json();
          const grantedUserIds = data.grants.map((grant: any) => grant.userId);
          setSelectedUsers(grantedUserIds);
        }
      } catch (err) {
        console.error("Failed to load access grants:", err);
      }
    };

    loadGrants();
  }, [isOpen, document.id, accessScope]);

  // Initialize access metadata
  useEffect(() => {
    if (!isOpen) return;
    
    if (accessScope === "ROLE_BASED" && document.accessMetadata?.allowedRoles) {
      setSelectedRoles(document.accessMetadata.allowedRoles as Role[]);
    }
  }, [isOpen, accessScope, document.accessMetadata]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
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

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // 1. Update document details (displayName and tags together)
      const detailsPayload: any = {
        displayName: displayName.trim() || null,
        tags: tags,
      };

      const detailsRes = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detailsPayload),
      });

      if (!detailsRes.ok) {
        throw new Error("Failed to update document details");
      }

      // 2. Update access control
      let accessMetadata: Record<string, unknown> | null = null;
      let grantUserIds: string[] | undefined = undefined;

      if (accessScope === "ROLE_BASED") {
        accessMetadata = { allowedRoles: selectedRoles };
      } else if (accessScope === "USER_BASED") {
        grantUserIds = selectedUsers;
      }

      const accessPayload = {
        accessScope: accessScope,
        accessMetadata: accessMetadata,
        grantUserIds: grantUserIds,
      };

      const accessRes = await fetch(`/api/documents/${document.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessPayload),
      });

      if (!accessRes.ok) {
        throw new Error("Failed to update access control");
      }

      // 4. Upload new version if file selected
      if (uploadFile) {
        // Get presigned URL - use displayName for versioning (not filename)
        const uploadUrlRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.name, // Actual file name can be different
            displayName: displayName || document.displayName || document.filename, // Version identifier
            contentType: uploadFile.type,
            size: uploadFile.size,
            mime: uploadFile.type,
            matterId: document.matterId,
            contactId: document.contactId,
            folderId: document.folderId,
          }),
        });

        if (!uploadUrlRes.ok) {
          const errorData = await uploadUrlRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const uploadData = await uploadUrlRes.json();
        const { putUrl, storageKey, documentId, version: uploadVersion } = uploadData;

        if (!putUrl || !storageKey || !documentId) {
          console.error("Invalid upload response:", uploadData);
          throw new Error("Upload URL, storage key, or document ID is missing from response");
        }

        // Upload to S3
        const s3Res = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": uploadFile.type },
          body: uploadFile,
        });

        if (!s3Res.ok) {
          throw new Error("Failed to upload file");
        }

        // Create new version - use displayName as version identifier
        // filename can be different between versions
        const versionPayload: any = {
          documentId: documentId,
          filename: uploadFile.name, // Can be different from original
          displayName: displayName || document.displayName || document.filename, // Version identifier - must match
          mime: uploadFile.type,
          size: uploadFile.size,
          storageKey: storageKey,
          parentDocumentId: document.id, // Link to the original document
          matterId: document.matterId,
          contactId: document.contactId,
          folderId: document.folderId,
          tags: tags, // Use current tags from form (may have been edited)
          accessScope: accessScope, // Use current access scope from form
          version: uploadVersion, // Use version from uploads API that matches storageKey
        };

        // Only add accessMetadata if it has a value (for ROLE_BASED)
        if (accessScope === "ROLE_BASED" && selectedRoles.length > 0) {
          versionPayload.accessMetadata = { allowedRoles: selectedRoles };
        }

        const versionRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(versionPayload),
        });

        if (!versionRes.ok) {
          throw new Error("Failed to create new version");
        }

        const newVersionDoc = await versionRes.json();
        
        // If USER_BASED access, set the grants for the new version
        if (accessScope === "USER_BASED" && selectedUsers.length > 0) {
          await fetch(`/api/documents/${newVersionDoc.id}/access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessScope: "USER_BASED",
              accessMetadata: null,
              grantUserIds: selectedUsers,
            }),
          });
        }
        
        // Call onSave with the new version's document ID so the drawer can switch to it
        await onSave(newVersionDoc.id);
      } else {
        // No new version uploaded, just refresh current document
        await onSave();
      }

      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDisplayName(document.displayName || "");
    setTags(document.tags || []);
    setNewTag("");
    setAccessScope(document.accessScope);
    setSelectedRoles([]);
    setSelectedUsers([]);
    setUploadFile(null);
    setError(null);
    setActiveTab("details");
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Edit Document</h2>
                <p className="text-sm text-slate-500 mt-0.5">{document.filename}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Details & Access
            </button>
            <button
              onClick={() => setActiveTab("version")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "version"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Upload New Version
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={document.filename}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to use filename: {document.filename}
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addTag}
                    type="button"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Access Control */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  <Lock className="inline h-4 w-4 mr-1" />
                  Access Control
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="PUBLIC"
                      checked={accessScope === "PUBLIC"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="w-4 h-4 mt-0.5 text-blue-600"
                    />
                    <Globe className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">All Team Members</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Everyone in the {document.matterId ? "matter" : document.contactId ? "contact" : "team"} can view
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="ROLE_BASED"
                      checked={accessScope === "ROLE_BASED"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="w-4 h-4 mt-0.5 text-blue-600"
                    />
                    <Users className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Specific Roles</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Only team members with selected roles can view
                      </div>
                      
                      {accessScope === "ROLE_BASED" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"] as Role[]).map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(role)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                selectedRoles.includes(role)
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {accessScope === "ROLE_BASED" && selectedRoles.length === 0 && (
                        <p className="text-sm text-amber-600 mt-2">
                          ⚠️ Please select at least one role
                        </p>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="USER_BASED"
                      checked={accessScope === "USER_BASED"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="w-4 h-4 mt-0.5 text-blue-600"
                    />
                    <UserCheck className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Specific People</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Only selected team members can view
                      </div>
                      
                      {accessScope === "USER_BASED" && (
                        <div className="mt-3">
                          {loadingTeam ? (
                            <p className="text-sm text-slate-500">Loading team members...</p>
                          ) : teamMembers.length === 0 ? (
                            <p className="text-sm text-slate-500">No team members found</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                              {teamMembers.map((member) => (
                                <label
                                  key={member.id}
                                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
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
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="PRIVATE"
                      checked={accessScope === "PRIVATE"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="w-4 h-4 mt-0.5 text-blue-600"
                    />
                    <Lock className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Private</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Only you and owner can view this document
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Version Upload Tab */}
          {activeTab === "version" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Uploading a new version</p>
                    <p>This will create version {document.version + 1} of the document. The original file will be preserved as version {document.version}.</p>
                  </div>
                </div>
              </div>

              {/* Current File Info */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-medium text-slate-700 mb-3">Current Version (v{document.version})</div>
                <div className="flex items-center gap-3">
                  <DocumentTypeIcon mimeType={document.mimeType} className="h-10 w-10" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{document.filename}</div>
                    <div className="text-sm text-slate-500">{formatFileSize(document.size)}</div>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Version File
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-blue-500 bg-blue-50"
                      : uploadFile
                      ? "border-green-300 bg-green-50"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {uploadFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        <DocumentTypeIcon mimeType={uploadFile.type} className="h-12 w-12" />
                        <div className="text-left">
                          <div className="font-medium text-slate-900">{uploadFile.name}</div>
                          <div className="text-sm text-slate-500">{formatFileSize(uploadFile.size)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setUploadFile(null)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 mb-2">
                        <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-sm text-slate-500">Any file type supported</p>
                      <input
                        type="file"
                        onChange={handleFileInput}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-white px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                saving ||
                (accessScope === "ROLE_BASED" && selectedRoles.length === 0) ||
                (accessScope === "USER_BASED" && selectedUsers.length === 0)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              type="button"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
