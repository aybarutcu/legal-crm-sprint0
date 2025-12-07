"use client";

import { useState, useEffect } from "react";
import { Folder, File, ChevronRight, ChevronDown, Upload, FolderPlus, Lock, Edit } from "lucide-react";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { EditFolderDialog } from "./EditFolderDialog";

interface FolderNode {
  id: string;
  name: string;
  color?: string | null;
  parentFolderId?: string | null;
  matterId?: string | null;
  contactId?: string | null;
  _count?: {
    documents: number;
    subfolders: number;
  };
}

interface DocumentNode {
  id: string;
  filename: string;
  displayName?: string | null;
  size: number;
  createdAt: string;
  folderId?: string | null;
  tags?: string[];
  version: number;
  parentDocumentId?: string | null;
}

interface FolderTreeProps {
  matterId?: string;
  contactId?: string;
  onDocumentClick?: (documentId: string) => void;
  onCreateFolder?: () => void;
  onUploadDocument?: () => void;
  matterTeamMemberIds?: string[];
  matterOwnerId?: string;
  currentUserId?: string;
  currentUserRole?: string;
  refreshKey?: number; // Add this to trigger refresh from parent
}

export function FolderTreeView({ 
  matterId, 
  contactId, 
  onDocumentClick, 
  onCreateFolder, 
  onUploadDocument, 
  matterTeamMemberIds = [], 
  matterOwnerId,
  currentUserId,
  currentUserRole,
  refreshKey 
}: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [documents, setDocuments] = useState<DocumentNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [selectedParentFolderId, setSelectedParentFolderId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  useEffect(() => {
    loadFolderStructure();
  }, [matterId, contactId, refreshKey]);

  const loadFolderStructure = async () => {
    setLoading(true);
    try {
      // Build query params based on what's provided
      const folderParams = new URLSearchParams();
      if (matterId) folderParams.set('matterId', matterId);
      if (contactId) folderParams.set('contactId', contactId);
      // Don't set parentFolderId - we want ALL folders for this matter/contact
      // The API will return all folders when matterId/contactId is set without parentFolderId

      // Load all folders for this entity
      const foldersRes = await fetch(`/api/folders?${folderParams.toString()}`);
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        const loadedFolders = foldersData.folders || [];
        setFolders(loadedFolders);
        
        // Auto-expand all folders on load
        const allFolderIds = loadedFolders.map((f: FolderNode) => f.id);
        setExpandedFolders(new Set(allFolderIds));
      }

      // Load documents for this entity (fetch all pages if needed)
      const docParams = new URLSearchParams();
      if (matterId) docParams.set('matterId', matterId);
      if (contactId) docParams.set('contactId', contactId);
      
      let allDocuments: DocumentNode[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 10) { // Limit to 10 pages (500 docs max) to prevent infinite loops
        docParams.set('page', page.toString());
        docParams.set('pageSize', '50');
        
        const docsRes = await fetch(`/api/documents?${docParams.toString()}`);
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          allDocuments = [...allDocuments, ...(docsData.data || [])];
          hasMore = docsData.pagination?.hasNext ?? false;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      setDocuments(allDocuments);

    } catch (error) {
      console.error("Failed to load folder structure", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get only the latest versions of documents
  // Groups documents by their version chain and returns only the latest version of each
  const getLatestDocuments = (docs: DocumentNode[]): DocumentNode[] => {
    // Build a map of all document IDs that are children (have a parent)
    const childDocumentIds = new Set<string>();
    docs.forEach(doc => {
      if (doc.parentDocumentId) {
        childDocumentIds.add(doc.id);
      }
    });

    // Create a map to track document families
    const documentFamilies = new Map<string, DocumentNode[]>();
    
    docs.forEach(doc => {
      let groupKey: string;
      
      // If this document has a parent, group by the parent
      if (doc.parentDocumentId) {
        groupKey = doc.parentDocumentId;
      }
      // If this document IS a parent (other docs point to it), use its own ID as the group
      else if (docs.some(other => other.parentDocumentId === doc.id)) {
        groupKey = doc.id;
      }
      // Otherwise, check if this is a workflow document that should be grouped by requestId
      else if (doc.tags && doc.tags.length > 0 && doc.tags[0].includes('-')) {
        const potentialRequestId = doc.tags[0];
        // Check if other documents share this requestId tag
        const siblings = docs.filter(other => 
          other.tags && 
          other.tags.length > 0 && 
          other.tags[0] === potentialRequestId
        );
        
        if (siblings.length > 1) {
          // Multiple documents share this requestId, group them
          groupKey = potentialRequestId;
        } else {
          // Solo document, use its own ID
          groupKey = doc.id;
        }
      }
      // Standalone document
      else {
        groupKey = doc.id;
      }
      
      if (!documentFamilies.has(groupKey)) {
        documentFamilies.set(groupKey, []);
      }
      documentFamilies.get(groupKey)!.push(doc);
    });
    
    // For each family, get the document with the highest version number
    const latestDocs: DocumentNode[] = [];
    documentFamilies.forEach(family => {
      const latest = family.reduce((prev, current) => 
        (current.version > prev.version) ? current : prev
      );
      latestDocs.push(latest);
    });
    
    return latestDocs;
  };

  const handleCreateFolder = async (name: string, color?: string, accessScope?: string, accessMetadata?: any, userIds?: string[], parentFolderId?: string | null) => {
    try {
      const payload: any = {
        name,
        color: color || "blue",
        accessScope: accessScope || "PUBLIC",
      };

      // Add access metadata and userIds if provided
      if (accessMetadata) {
        payload.accessMetadata = accessMetadata;
      }

      // If a specific parent was selected, use it
      if (parentFolderId) {
        payload.parentFolderId = parentFolderId;
        // Don't set matterId/contactId - subfolders inherit context from parent
      } else if (matterId || contactId) {
        // No parent selected, find the matter's root folder
        const matterRootFolder = folders.find(f => 
          (matterId && f.matterId === matterId && f.parentFolderId) || 
          (contactId && f.contactId === contactId && f.parentFolderId)
        );

        if (matterRootFolder?.id) {
          payload.parentFolderId = matterRootFolder.id;
        } else {
          // If no root folder found (creating a new matter/contact root folder), set matterId/contactId
          if (matterId) payload.matterId = matterId;
          if (contactId) payload.contactId = contactId;
        }
      }

      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        
        // If USER_BASED access scope with userIds, grant access to those users
        if (accessScope === "USER_BASED" && userIds && userIds.length > 0) {
          // Grant access to each user
          for (const userId of userIds) {
            await fetch(`/api/folders/${data.folder.id}/access`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
          }
        }

        // Reload the folder structure
        await loadFolderStructure();
      } else {
        const error = await res.json();
        console.error("Failed to create folder:", error);
        alert(error.message || "Failed to create folder");
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Failed to create folder");
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleMoveDocument = async (documentId: string, targetFolderId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (res.ok) {
        // Reload the folder structure to reflect the move
        await loadFolderStructure();
      } else {
        const error = await res.json();
        console.error("Failed to move document:", error);
        alert(error.message || "Failed to move document");
      }
    } catch (error) {
      console.error("Failed to move document:", error);
      alert("Failed to move document");
    }
  };

  const getFolderColor = (color?: string | null) => {
    if (!color) return "text-blue-600";
    const colorMap: Record<string, string> = {
      blue: "text-blue-600",
      green: "text-green-600",
      yellow: "text-yellow-600",
      red: "text-red-600",
      purple: "text-purple-600",
      pink: "text-pink-600",
      gray: "text-gray-600",
    };
    return colorMap[color] || "text-blue-600";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const subfolders = folders.filter((f) => f.parentFolderId === folder.id);
    const folderDocs = documents.filter((d) => d.folderId === folder.id);
    const hasChildren = subfolders.length > 0 || folderDocs.length > 0;
    const isDragOver = dragOverFolderId === folder.id;

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(folder.id);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(null);
    };

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(null);

      if (draggedDocumentId) {
        await handleMoveDocument(draggedDocumentId, folder.id);
        setDraggedDocumentId(null);
      }
    };

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-1 px-2 hover:bg-gray-100 rounded group transition ${
            isDragOver ? "bg-blue-100 border-2 border-blue-400 border-dashed" : ""
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div
            className="flex items-center gap-2 flex-1 cursor-pointer"
            onClick={() => hasChildren && toggleFolder(folder.id)}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )
            ) : (
              <span className="w-4" />
            )}
            <Folder className={`h-4 w-4 ${getFolderColor(folder.color)}`} />
            <span className="text-sm font-medium flex-1">{folder.name}</span>
            {folder._count && (
              <span className="text-xs text-gray-500">
                {folder._count.documents > 0 && `${folder._count.documents} files`}
                {folder._count.documents > 0 && folder._count.subfolders > 0 && ", "}
                {folder._count.subfolders > 0 && `${folder._count.subfolders} folders`}
              </span>
            )}
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFolderId(folder.id);
              setEditDialogOpen(true);
            }}
            title="Edit Folder"
          >
            <Edit className="h-3 w-3 text-gray-600" />
          </button>
        </div>

        {isExpanded && (
          <div>
            {/* Render subfolders */}
            {subfolders.map((subfolder) => renderFolder(subfolder, level + 1))}

            {/* Render documents in this folder - show only latest versions */}
            {getLatestDocuments(folderDocs).map((doc) => {
              // Determine the best display name
              let displayText = doc.filename;
              if (doc.displayName && doc.displayName.trim()) {
                displayText = doc.displayName;
              } else if (doc.tags && doc.tags.length >= 2 && doc.tags[1]) {
                // Second tag is the user-friendly name for workflow docs
                displayText = doc.tags[1];
              } else if (doc.tags && doc.tags.length === 1 && !doc.tags[0].includes('-')) {
                // Single tag that's not a requestId
                displayText = doc.tags[0];
              } 

              const isDragging = draggedDocumentId === doc.id;

              return (
                <div
                  key={doc.id}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedDocumentId(doc.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    setDraggedDocumentId(null);
                    setDragOverFolderId(null);
                  }}
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer group transition ${
                    isDragging 
                      ? "opacity-50 bg-blue-100" 
                      : "hover:bg-blue-50"
                  }`}
                  style={{ paddingLeft: `${(level + 1) * 20 + 32}px` }}
                  onClick={() => !isDragging && onDocumentClick?.(doc.id)}
                >
                  <File className="h-4 w-4 text-gray-400" />
                  <span className="text-sm flex-1">
                    {displayText}
                  </span>
                  {doc.version > 1 && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                      v{doc.version}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{formatFileSize(doc.size)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Find root folders to display
  // When viewing a matter/contact, ONLY show the matter's/contact's main folder as the root
  const rootFolders = folders.filter((f) => {
    if (matterId) {
      // Show ONLY the folder that has this matterId and has a parentFolderId (the matter's main folder under "Matters")
      return f.matterId === matterId && f.parentFolderId !== null;
    } else if (contactId) {
      // Show ONLY the folder that has this contactId and has a parentFolderId
      return f.contactId === contactId && f.parentFolderId !== null;
    } else {
      // If no specific matter/contact, show top-level folders (no parent)
      return !f.parentFolderId;
    }
  });

  // Also get documents that are not in any folder
  const rootDocuments = documents.filter((d) => !d.folderId);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading folder structure...
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Documents & Folders</h3>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-sm border rounded hover:bg-white flex items-center gap-1"
            onClick={() => {
              // Set default parent to matter's root folder
              const matterRootFolder = folders.find(f => 
                (matterId && f.matterId === matterId && f.parentFolderId) || 
                (contactId && f.contactId === contactId && f.parentFolderId)
              );
              setSelectedParentFolderId(matterRootFolder?.id || null);
              setIsCreateFolderDialogOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onUploadDocument}
            disabled={!onUploadDocument}
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      <div className="p-2 max-h-96 overflow-y-auto">
        {rootFolders.length === 0 && rootDocuments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Folder className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No folders or documents yet</p>
            <p className="text-sm">Create a folder or upload a document to get started</p>
          </div>
        ) : (
          <>
            {rootFolders.map((folder) => renderFolder(folder))}
            
            {rootDocuments.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <div className="text-xs font-medium text-gray-500 px-2 mb-1">Root Documents</div>
                {getLatestDocuments(rootDocuments).map((doc) => {
                  // Determine the best display name
                  let displayText = doc.filename;
                  if (doc.displayName && doc.displayName.trim()) {
                    displayText = doc.displayName;
                  } else if (doc.tags && doc.tags.length >= 2 && doc.tags[1]) {
                    // Second tag is the user-friendly name for workflow docs
                    displayText = doc.tags[1];
                  } else if (doc.tags && doc.tags.length === 1 && !doc.tags[0].includes('-')) {
                    // Single tag that's not a requestId
                    displayText = doc.tags[0];
                  }

                  const isDragging = draggedDocumentId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedDocumentId(doc.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation();
                        setDraggedDocumentId(null);
                        setDragOverFolderId(null);
                      }}
                      className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition ${
                        isDragging 
                          ? "opacity-50 bg-blue-100" 
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => !isDragging && onDocumentClick?.(doc.id)}
                    >
                      <File className="h-4 w-4 text-gray-400 ml-4" />
                      <span className="text-sm flex-1">
                        {displayText}
                      </span>
                      {doc.version > 1 && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                          v{doc.version}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{formatFileSize(doc.size)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <CreateFolderDialog
        isOpen={isCreateFolderDialogOpen}
        onClose={() => {
          setIsCreateFolderDialogOpen(false);
          setSelectedParentFolderId(null);
        }}
        onCreate={(name, color, accessScope, accessMetadata, userIds) => 
          handleCreateFolder(name, color, accessScope, accessMetadata, userIds, selectedParentFolderId)
        }
        availableFolders={folders}
        selectedParentFolderId={selectedParentFolderId}
        onParentFolderChange={setSelectedParentFolderId}
        matterId={matterId}
        matterTeamMemberIds={matterTeamMemberIds}
      />

      {selectedFolderId && (
        <EditFolderDialog
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedFolderId(null);
          }}
          onUpdate={() => {
            // Trigger refresh by reloading folder structure
            loadFolderStructure();
            setEditDialogOpen(false);
            setSelectedFolderId(null);
          }}
          folderId={selectedFolderId}
          matterId={matterId}
          matterTeamMemberIds={matterTeamMemberIds}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          matterOwnerId={matterOwnerId}
        />
      )}
    </div>
  );
}
