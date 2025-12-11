"use client";

/// <reference lib="dom" />
import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, AlertCircle, CheckCircle, Lock, Globe, Users, UserCheck } from "lucide-react";
import { DocumentTypeIcon } from "./DocumentTypeIcon";
import { formatFileSize } from "@/lib/documents/format-utils";
import { DocumentAccessScope, Role } from "@prisma/client";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

type MatterDocumentUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  matterId?: string;
  contactId?: string;
  workflowStepId?: string | null;
  tags?: string[]; // First tag is the document name from REQUEST_DOC
  parentDocumentId?: string | null; // For versioning existing documents
  onUploadComplete?: (uploadedDocumentId?: string) => void;
};

type UploadState = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function MatterDocumentUploadDialog({
  isOpen,
  onClose,
  matterId,
  contactId,
  workflowStepId,
  tags,
  parentDocumentId,
  onUploadComplete,
}: MatterDocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [accessScope, setAccessScope] = useState<DocumentAccessScope>("PUBLIC");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showAccessOptions, setShowAccessOptions] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileInputRef = useRef<any>(null);

  // Auto-populate displayName from REQUEST_DOC documentName (second tag)
  useEffect(() => {
    if (isOpen && workflowStepId && tags && tags.length >= 2) {
      // tags[0] = requestId, tags[1] = documentName
      const documentName = tags[1];
      if (documentName) {
        console.log('[MatterDocumentUploadDialog] Auto-setting displayName from tags:', documentName);
        setDisplayName(documentName);
      }
    } else if (!isOpen) {
      // Reset displayName when dialog closes
      setDisplayName("");
    }
  }, [isOpen, workflowStepId, tags]);

  // Load team members when dialog opens
  useEffect(() => {
    const loadTeam = async () => {
      if (!isOpen || (!matterId && !contactId)) return;

      setLoadingTeam(true);
      try {
        if (matterId) {
          const res = await fetch(`/api/matters/${matterId}/team`);
          if (res.ok) {
            const teamData = await res.json();
            console.log("Team data received:", teamData); // Debug log
            
            // API returns array of team members directly
            const uniqueUsers = new Map<string, TeamMember>();
            
            if (Array.isArray(teamData)) {
              teamData.forEach((member: any) => {
                if (member.user && !uniqueUsers.has(member.user.id)) {
                  uniqueUsers.set(member.user.id, {
                    id: member.user.id,
                    name: member.user.name,
                    email: member.user.email,
                    role: member.user.role,
                  });
                }
              });
            }
            
            setTeamMembers(Array.from(uniqueUsers.values()));
            console.log("Team members set:", Array.from(uniqueUsers.values())); // Debug log
          }
        } else if (contactId) {
          // For contacts, just get the contact owner
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
        }
      } catch (error) {
        console.error("Failed to load team members:", error);
      } finally {
        setLoadingTeam(false);
      }
    };

    loadTeam();
  }, [isOpen, matterId, contactId]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "File type not supported";
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setErrorMessage(error);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage("");
      setUploadState("idle");
    },
    [validateFile]
  );

  const handleFileInputChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const files = e.target?.files;
      const file = files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!matterId && !contactId) {
      setErrorMessage("Either matterId or contactId is required");
      return;
    }

    console.log('[MatterDocumentUploadDialog] Starting upload with:', {
      parentDocumentId,
      workflowStepId,
      tags,
      displayName,
    });

    setUploadState("uploading");
    setErrorMessage("");

    try {
      // Step 1: Request signed upload URL from /api/uploads
      const uploadRequestBody: {
        filename: string;
        displayName?: string;
        mime: string;
        size: number;
        matterId?: string;
        contactId?: string;
        parentDocumentId?: string;
      } = {
        filename: selectedFile.name,
        displayName: displayName || (tags && tags.length >= 2 ? tags[1] : selectedFile.name),
        mime: selectedFile.type,
        size: selectedFile.size,
      };

      if (matterId) uploadRequestBody.matterId = matterId;
      if (contactId) uploadRequestBody.contactId = contactId;
      if (parentDocumentId) uploadRequestBody.parentDocumentId = parentDocumentId;

      console.log('[MatterDocumentUploadDialog] Upload request body:', uploadRequestBody);

      const uploadRequestResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uploadRequestBody),
      });

      if (!uploadRequestResponse.ok) {
        const error = await uploadRequestResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const uploadData: {
        documentId: string;
        storageKey: string;
        version: number;
        putUrl?: string;
        upload?: { url: string; method: "PUT" | "POST"; fields?: Record<string, string> | null };
      } = await uploadRequestResponse.json();

      // Step 2: Upload file to signed URL
      const uploadUrl = uploadData.putUrl || uploadData.upload?.url;
      if (!uploadUrl) {
        throw new Error("No upload URL received");
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // Step 3: Finalize document creation via /api/documents
      const finalizeBody: {
        documentId: string;
        filename: string;
        displayName?: string;
        mime: string;
        size: number;
        storageKey: string;
        version: number;
        parentDocumentId?: string;
        matterId?: string;
        contactId?: string;
        workflowStepId?: string;
        tags?: string[];
        accessScope?: DocumentAccessScope;
        accessMetadata?: Record<string, unknown>;
      } = {
        documentId: uploadData.documentId,
        filename: selectedFile.name,
        displayName: displayName || selectedFile.name,
        mime: selectedFile.type,
        size: selectedFile.size,
        storageKey: uploadData.storageKey,
        version: uploadData.version,
      };

      if (matterId) finalizeBody.matterId = matterId;
      if (contactId) finalizeBody.contactId = contactId;
      if (workflowStepId) finalizeBody.workflowStepId = workflowStepId;
      if (parentDocumentId) finalizeBody.parentDocumentId = parentDocumentId;
      // Pass tags directly without filtering
      console.log('[MatterDocumentUploadDialog] Tags received:', tags);
      if (tags && tags.length > 0) {
        finalizeBody.tags = tags;
      }
      console.log('[MatterDocumentUploadDialog] Final body being sent:', finalizeBody);
      
      // Add access control settings
      finalizeBody.accessScope = accessScope;
      if (accessScope === "ROLE_BASED" && selectedRoles.length > 0) {
        finalizeBody.accessMetadata = { allowedRoles: selectedRoles };
      } else if (accessScope === "USER_BASED" && selectedUsers.length > 0) {
        finalizeBody.accessMetadata = { allowedUserIds: selectedUsers };
      }

      const finalizeResponse = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalizeBody),
      });

      if (!finalizeResponse.ok) {
        const error = await finalizeResponse.json();
        throw new Error(error.error || "Failed to finalize document");
      }

      const finalizedDoc = await finalizeResponse.json();
      console.log("✅ Document uploaded successfully:", finalizedDoc);

      // If USER_BASED access, grant access to selected users
      if (accessScope === "USER_BASED" && selectedUsers.length > 0) {
        await fetch(`/api/documents/${finalizedDoc.id}/access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessScope: "USER_BASED",
            grantUserIds: selectedUsers,
          }),
        });
      }

      setUploadState("success");
      
      // Wait a moment to show success state
      setTimeout(() => {
        onUploadComplete?.(finalizedDoc.id);
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDisplayName(""); // Reset displayName
    setUploadState("idle");
    setErrorMessage("");
    setDragActive(false);
    setAccessScope("PUBLIC");
    setSelectedRoles([]);
    setSelectedUsers([]);
    setShowAccessOptions(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {parentDocumentId ? "Upload New Version" : "Upload Document"}
            </h2>
            {tags && tags.length > 0 && workflowStepId && (
              <p className="text-sm text-orange-600 mt-1">
                📋 Required: <span className="font-semibold">{tags[0]}</span>
                {parentDocumentId && <span className="ml-2 text-blue-600">🔄 New Version</span>}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            disabled={uploadState === "uploading"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workflow Step Info Banner */}
        {tags && tags.length > 0 && workflowStepId && (
          <div className="mb-4 rounded-lg border-2 border-orange-200 bg-orange-50 p-3">
            <p className="text-sm text-orange-900">
              <span className="font-semibold">Workflow Document Request:</span><br />
              This document will be linked to the workflow step and marked as "{tags[0]}"
              {parentDocumentId && (
                <>
                  <br /><span className="text-blue-700 font-semibold">📦 Uploading as new version of existing document</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileInputChange}
            disabled={uploadState === "uploading"}
          />

          {!selectedFile ? (
            <>
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-sm font-medium text-slate-700 mb-1">
                Drag and drop your file here
              </p>
              <p className="text-xs text-slate-500 mb-4">or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Browse Files
              </button>
              <p className="mt-4 text-xs text-slate-500">
                Max file size: {formatFileSize(MAX_FILE_SIZE)}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-4">
              <DocumentTypeIcon mimeType={selectedFile.type} className="h-8 w-8" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              {uploadState === "idle" && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Display Name Input */}
        {selectedFile && uploadState === "idle" && (
          <div className="mt-4">
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-2">
              Display Name
              <span className="text-xs text-slate-500 ml-2">(Optional - defaults to filename)</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Örn: Nufüs Cuzdani"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              This name will be used to identify the document and group versions
            </p>
          </div>
        )}

        {/* Access Control Section */}
        {selectedFile && uploadState === "idle" && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setShowAccessOptions(!showAccessOptions)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  Access Control
                </span>
                <span className="text-xs text-slate-500">
                  ({accessScope === "PUBLIC" ? "All team members" : 
                    accessScope === "ROLE_BASED" ? "Specific roles" : 
                    accessScope === "USER_BASED" ? "Specific people" : "Private"})
                </span>
              </div>
              <span className="text-slate-400">{showAccessOptions ? "▲" : "▼"}</span>
            </button>

            {showAccessOptions && (
              <div className="p-4 pt-0 space-y-3">
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input
                      type="radio"
                      name="accessScope"
                      value="PUBLIC"
                      checked={accessScope === "PUBLIC"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="mt-0.5"
                    />
                    <Globe className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">All Team Members</div>
                      <div className="text-xs text-slate-500">
                        Everyone in the {matterId ? "matter" : "contact"} team can view
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input
                      type="radio"
                      name="accessScope"
                      value="ROLE_BASED"
                      checked={accessScope === "ROLE_BASED"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="mt-0.5"
                    />
                    <Users className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Specific Roles</div>
                      <div className="text-xs text-slate-500">
                        Only selected roles can view
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input
                      type="radio"
                      name="accessScope"
                      value="USER_BASED"
                      checked={accessScope === "USER_BASED"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="mt-0.5"
                    />
                    <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Specific People</div>
                      <div className="text-xs text-slate-500">
                        Only selected team members can view
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input
                      type="radio"
                      name="accessScope"
                      value="PRIVATE"
                      checked={accessScope === "PRIVATE"}
                      onChange={(e) => setAccessScope(e.target.value as DocumentAccessScope)}
                      className="mt-0.5"
                    />
                    <Lock className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Private</div>
                      <div className="text-xs text-slate-500">
                        Only you and {matterId ? "matter" : "contact"} owner
                      </div>
                    </div>
                  </label>
                </div>

                {/* Role Selection for ROLE_BASED */}
                {accessScope === "ROLE_BASED" && (
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="text-xs font-medium text-slate-700 mb-2">Select Allowed Roles:</div>
                    <div className="space-y-1">
                      {(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"] as Role[]).map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRoles([...selectedRoles, role]);
                              } else {
                                setSelectedRoles(selectedRoles.filter(r => r !== role));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-slate-700">{role}</span>
                        </label>
                      ))}
                    </div>
                    {selectedRoles.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">⚠️ Please select at least one role</p>
                    )}
                  </div>
                )}

                {/* User Selection for USER_BASED */}
                {accessScope === "USER_BASED" && (
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="text-xs font-medium text-slate-700 mb-2">Select Team Members:</div>
                    {loadingTeam ? (
                      <p className="text-xs text-slate-500">Loading team members...</p>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-xs text-slate-500">No team members found</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <label key={member.id} className="flex items-start gap-2 text-sm p-1 hover:bg-slate-50 rounded">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, member.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== member.id));
                                }
                              }}
                              className="rounded mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-slate-900 truncate">
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
                      <p className="text-xs text-amber-600 mt-2">⚠️ Please select at least one person</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Success Message */}
        {uploadState === "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-700">Document uploaded successfully!</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            disabled={uploadState === "uploading"}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={
              !selectedFile || 
              uploadState === "uploading" || 
              uploadState === "success" ||
              (accessScope === "ROLE_BASED" && selectedRoles.length === 0) ||
              (accessScope === "USER_BASED" && selectedUsers.length === 0)
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {uploadState === "uploading" ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
