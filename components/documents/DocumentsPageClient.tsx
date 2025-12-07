"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderPlus, ChevronDown, ChevronUp, LayoutGrid, List, X } from "lucide-react";
import Select from "react-select";
import type {
  ContactOption,
  DocumentListItem,
  MatterOption,
  UploaderOption,
} from "@/components/documents/types";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";
import { FolderBreadcrumb, type BreadcrumbItem } from "@/components/documents/FolderBreadcrumb";
import { FolderCard, type FolderCardData } from "@/components/documents/FolderCard";
import { CreateFolderDialog } from "@/components/documents/CreateFolderDialog";
import { EditFolderDialog } from "@/components/documents/EditFolderDialog";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getFileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎥";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📊";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("compressed")) return "📦";
  if (mime.includes("text")) return "📃";
  return "📎";
}

type ViewMode = "grid" | "list";

type Filters = {
  q?: string;
  matterId?: string;
  contactId?: string;
  folderId?: string;
  uploaderId?: string;
  tags?: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type DocumentsPageClientProps = {
  documents: DocumentListItem[];
  matters: MatterOption[];
  contacts: ContactOption[];
  uploaders: UploaderOption[];
  pagination: PaginationState;
  filters: Filters;
  maxUploadBytes: number;
};

export function DocumentsPageClient({
  documents,
  matters,
  contacts,
  uploaders,
  pagination,
  filters,
  maxUploadBytes,
}: DocumentsPageClientProps) {
  const [items, setItems] = useState(documents);
  const [folders, setFolders] = useState<FolderCardData[]>([]);
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    filters.folderId || null
  );
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedParentFolderId, setSelectedParentFolderId] = useState<string | null>(null);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedMatter, setSelectedMatter] = useState<{ value: string; label: string } | null>(null);
  const [selectedContact, setSelectedContact] = useState<{ value: string; label: string } | null>(null);
  const [selectedUploader, setSelectedUploader] = useState<{ value: string; label: string } | null>(null);


  useEffect(() => {
    setItems(documents);
    const newFolderId = filters.folderId || null;
    setCurrentFolderId(newFolderId);
    setSelectedDocIds(new Set()); // Clear selection when navigating
    // Load folders and breadcrumb for current location
    loadFolderPath(newFolderId);
    
    // Sync react-select values with URL filters
    if (filters.matterId) {
      const matter = matters.find(m => m.id === filters.matterId);
      if (matter) setSelectedMatter({ value: matter.id, label: matter.title });
    } else {
      setSelectedMatter(null);
    }
    
    if (filters.contactId) {
      const contact = contacts.find(c => c.id === filters.contactId);
      if (contact) setSelectedContact({ value: contact.id, label: contact.name });
    } else {
      setSelectedContact(null);
    }
    
    if (filters.uploaderId) {
      const uploader = uploaders.find(u => u.id === filters.uploaderId);
      if (uploader) setSelectedUploader({ value: uploader.id, label: uploader.name || uploader.email || uploader.id });
    } else {
      setSelectedUploader(null);
    }
  }, [documents, filters.folderId, filters.matterId, filters.contactId, filters.uploaderId, matters, contacts, uploaders]);

  useEffect(() => {
    // Load folders when currentFolderId changes
    loadFolders();
  }, [currentFolderId, filters.matterId, filters.contactId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadFolders = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.matterId) params.set("matterId", filters.matterId);
      if (filters.contactId) params.set("contactId", filters.contactId);
      if (currentFolderId) {
        params.set("parentFolderId", currentFolderId);
      } else {
        params.set("parentFolderId", "null");
      }

      console.log("Loading folders with params:", params.toString(), "currentFolderId:", currentFolderId);
      const response = await fetch(`/api/folders?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Loaded folders:", data.folders);
        setFolders(data.folders || []);
      } else {
        console.error("Failed to load folders, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to load folders", error);
    }
  };

  const loadFolderPath = async (folderId: string | null) => {
    if (!folderId) {
      setFolderPath([]);
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folderId}`);
      if (response.ok) {
        const data = await response.json();
        setFolderPath(data.path || []);
      }
    } catch (error) {
      console.error("Failed to load folder path", error);
    }
  };

  const filterState = useMemo(
    () => ({
      q: filters.q ?? "",
      matterId: filters.matterId ?? "",
      contactId: filters.contactId ?? "",
      folderId: filters.folderId ?? "",
      uploaderId: filters.uploaderId ?? "",
      tags: filters.tags ?? "",
    }),
    [filters],
  );

  const handleFolderNavigate = (folderId: string | null) => {
    const params = new URLSearchParams();
    if (filterState.matterId) params.set("matterId", filterState.matterId);
    if (filterState.contactId) params.set("contactId", filterState.contactId);
    if (folderId) params.set("folderId", folderId);
    params.set("page", "1");
    window.location.href = `/documents?${params.toString()}`;
  };

  const handleCreateFolder = async (name: string, color?: string, accessScope?: string, accessMetadata?: any, userIds?: string[], parentFolderId?: string | null) => {
    try {
      const payload: any = {
        name,
        color,
        accessScope: accessScope || "PUBLIC",
        matterId: filterState.matterId || undefined,
        contactId: filterState.contactId || undefined,
        parentFolderId: parentFolderId || currentFolderId || undefined,
      };

      if (accessMetadata) {
        payload.accessMetadata = accessMetadata;
      }

      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        
        // If USER_BASED access scope with userIds, grant access to those users
        if (accessScope === "USER_BASED" && userIds && userIds.length > 0) {
          for (const userId of userIds) {
            await fetch(`/api/folders/${data.folder.id}/access`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
          }
        }
        
        setFolders((prev) => [data.folder, ...prev]);
        setToast({ message: "Folder created successfully", variant: "success" });
      } else {
        setToast({ message: "Failed to create folder", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to create folder", error);
      setToast({ message: "Failed to create folder", variant: "error" });
    }
  };

  const handleEditFolder = (folderId: string) => {
    setEditingFolderId(folderId);
    setShowEditFolder(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setToast({ message: "Folder deleted", variant: "success" });
      } else {
        setToast({ message: "Failed to delete folder", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to delete folder", error);
      setToast({ message: "Failed to delete folder", variant: "error" });
    }
  };

  const handleDropDocument = async (folderId: string, documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });

      if (response.ok) {
        // Remove document from current view
        setItems((prev) => prev.filter((d) => d.id !== documentId));
        // Update folder count
        setFolders((prev) =>
          prev.map((f) =>
            f.id === folderId
              ? { ...f, _count: { ...f._count, documents: f._count.documents + 1 } }
              : f
          )
        );
        setToast({ message: "Document moved successfully", variant: "success" });
      } else {
        const error = await response.json();
        setToast({ 
          message: error.error || "Failed to move document", 
          variant: "error" 
        });
      }
    } catch (error) {
      console.error("Failed to move document", error);
      setToast({ message: "Failed to move document", variant: "error" });
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === items.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(items.map((d) => d.id)));
    }
  };

  const handleBulkMove = async (folderId: string | null) => {
    if (selectedDocIds.size === 0) return;

    const count = selectedDocIds.size;
    const targetFolder = folders.find((f) => f.id === folderId);
    const message = folderId
      ? `Move ${count} document${count > 1 ? "s" : ""} to "${targetFolder?.name}"?`
      : `Move ${count} document${count > 1 ? "s" : ""} to root?`;

    if (!confirm(message)) return;

    try {
      const response = await fetch("/api/documents/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocIds),
          targetFolderId: folderId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to move documents");
      }

      const result = await response.json();

      if (result.moved > 0) {
        // Remove moved documents from view
        setItems((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
        // Update folder count
        if (folderId) {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === folderId
                ? { ...f, _count: { ...f._count, documents: f._count.documents + result.moved } }
                : f
            )
          );
        }
        setSelectedDocIds(new Set());
        setToast({
          message: `${result.moved} document${result.moved > 1 ? "s" : ""} moved successfully`,
          variant: "success",
        });
      }

      if (result.denied > 0) {
        setToast({
          message: `${result.denied} document${result.denied > 1 ? "s" : ""} failed to move (access denied)`,
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Failed to move documents", error);
      setToast({ message: "Failed to move documents", variant: "error" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;

    const count = selectedDocIds.size;
    const message = `Are you sure you want to delete ${count} document${count > 1 ? "s" : ""}? This action cannot be undone.`;

    if (!confirm(message)) return;

    try {
      const response = await fetch("/api/documents/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocIds),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete documents");
      }

      const result = await response.json();

      if (result.deleted > 0) {
        // Remove deleted documents from view
        setItems((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
        setSelectedDocIds(new Set());
        setToast({
          message: `${result.deleted} document${result.deleted > 1 ? "s" : ""} deleted successfully`,
          variant: "success",
        });
      }

      if (result.denied > 0) {
        setToast({
          message: `${result.denied} document${result.denied > 1 ? "s" : ""} failed to delete (access denied)`,
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Failed to delete documents", error);
      setToast({ message: "Failed to delete documents", variant: "error" });
    }
  };

  const handleCreated = (item: DocumentListItem) => {
    setItems((prev) => [item, ...prev]);
    setToast({ message: "Doküman listesi güncellendi.", variant: "success" });
  };

  const handleUpdated = useCallback((updated: DocumentListItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    setSelectedDocument((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    setToast({ message: "Doküman güncellendi.", variant: "success" });
  }, []);

  const openDetail = useCallback((doc: DocumentListItem) => {
    setSelectedDocumentId(doc.id);
    setSelectedDocument(doc);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedDocumentId(null);
    setSelectedDocument(null);
  }, []);

  const handleDownload = async (doc: DocumentListItem) => {
    setDownloadingId(doc.id);
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) {
        throw new Error("İndirme bağlantısı alınamadı.");
      }

      const payload: { getUrl: string; mime: string } = await response.json();
      const mime = payload.mime ?? doc.mime;
      if (mime.startsWith("application/pdf") || mime.startsWith("image/")) {
        window.open(payload.getUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = payload.getUrl;
      }
    } catch (error) {
      console.error(error);
      setToast({
        message: "İndirme bağlantısı oluşturulamadı.",
        variant: "error",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const removeFilter = (filterKey: keyof Filters) => {
    const params = new URLSearchParams(window.location.search);
    params.delete(filterKey);
    // Remove pagination params if they exist
    params.delete("page");
    params.delete("pageSize");
    const queryString = params.toString();
    window.location.href = queryString ? `/documents?${queryString}` : '/documents';
  };

  const getActiveFilters = () => {
    const active: Array<{ key: keyof Filters; label: string; value: string }> = [];
    if (filterState.q) active.push({ key: "q", label: "Search", value: filterState.q });
    if (filterState.matterId) {
      const matter = matters.find(m => m.id === filterState.matterId);
      if (matter) active.push({ key: "matterId", label: "Matter", value: matter.title });
    }
    if (filterState.contactId) {
      const contact = contacts.find(c => c.id === filterState.contactId);
      if (contact) active.push({ key: "contactId", label: "Contact", value: contact.name });
    }
    if (filterState.uploaderId) {
      const uploader = uploaders.find(u => u.id === filterState.uploaderId);
      if (uploader) active.push({ key: "uploaderId", label: "Uploader", value: uploader.name || uploader.email || uploader.id });
    }
    if (filterState.tags) active.push({ key: "tags", label: "Tags", value: filterState.tags });
    return active;
  };

  const activeFilters = getActiveFilters();

  // Prepare options for react-select
  const matterOptions = matters.map(m => ({ value: m.id, label: m.title }));
  const contactOptions = contacts.map(c => ({ value: c.id, label: c.name }));
  const uploaderOptions = uploaders.map(u => ({ 
    value: u.id, 
    label: u.name || u.email || u.id 
  }));

  // Custom styles for react-select to match our design
  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderColor: '#e2e8f0',
      borderRadius: '0.5rem',
      padding: '0.125rem',
      fontSize: '0.875rem',
      '&:hover': {
        borderColor: '#cbd5e1',
      },
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      zIndex: 9999,
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? '#eff6ff' : 'white',
      color: '#0f172a',
      '&:active': {
        backgroundColor: '#dbeafe',
      },
    }),
  };

  return (
    <section className="space-y-6" data-testid="documents-page-client">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-500">
            Doküman yükleme, sürümleme ve filtreleme.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedParentFolderId(currentFolderId);
              setShowCreateFolder(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <DocumentUploadDialog
            matters={matters}
            contacts={contacts}
            currentFolderId={currentFolderId}
            maxUploadBytes={maxUploadBytes}
            onCreated={handleCreated}
          />
        </div>
      </div>

      {/* Breadcrumb navigation */}
      {(currentFolderId || folderPath.length > 0) && (
        <FolderBreadcrumb
          path={folderPath}
          matterId={filterState.matterId}
          contactId={filterState.contactId}
          onNavigate={handleFolderNavigate}
        />
      )}

      {/* Collapsible Filter Form */}
      <form className="bg-white rounded-xl border border-slate-200 shadow-sm" method="get">
        <div className="p-4">
          {/* Always visible: Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="search"
                name="q"
                defaultValue={filterState.q}
                placeholder="🔍 Dosya adı veya etiket ara..."
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {filtersExpanded ? "Gizle" : "Daha Fazla Filtre"}
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
              Ara
            </button>
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <div
                  key={filter.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 pl-3 pr-2 py-1 text-xs font-medium text-blue-700"
                >
                  <span className="text-blue-500">{filter.label}:</span>
                  <span>{filter.value}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter(filter.key)}
                    className="rounded-full hover:bg-blue-100 p-0.5 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => window.location.href = '/documents'}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
              >
                Tümünü Temizle
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Expandable advanced filters */}
          {filtersExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid gap-4 md:grid-cols-3">
              {selectedMatter && <input type="hidden" name="matterId" value={selectedMatter.value} />}
              {selectedContact && <input type="hidden" name="contactId" value={selectedContact.value} />}
              {selectedUploader && <input type="hidden" name="uploaderId" value={selectedUploader.value} />}
              
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Matter</span>
                <Select
                  value={selectedMatter}
                  onChange={(option) => setSelectedMatter(option)}
                  options={matterOptions}
                  isClearable
                  placeholder="Hepsi"
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Contact</span>
                <Select
                  value={selectedContact}
                  onChange={(option) => setSelectedContact(option)}
                  options={contactOptions}
                  isClearable
                  placeholder="Hepsi"
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Uploader</span>
                <Select
                  value={selectedUploader}
                  onChange={(option) => setSelectedUploader(option)}
                  options={uploaderOptions}
                  isClearable
                  placeholder="Hepsi"
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </label>

              <label className="space-y-2 md:col-span-3">
                <span className="text-sm font-medium text-slate-700">Etiketler</span>
                <input
                  name="tags"
                  defaultValue={filterState.tags}
                  placeholder="kanit,imza"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
          )}
        </div>
      </form>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {folders.length > 0 && items.length > 0 ? "Klasörler ve Dosyalar" : 
           folders.length > 0 ? "Klasörler" : 
           items.length > 0 ? "Dosyalar" : "İçerik"}
        </h3>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "grid"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Folders and Files - Grid View */}
      {viewMode === "grid" && (
        <div className="space-y-6">
          {/* Folders Section */}
          {folders.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-700">Folders</h3>
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={handleFolderNavigate}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    onDropDocument={handleDropDocument}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Files Section - Only show if in a folder or has active filters */}
          {items.length > 0 && (currentFolderId || filterState.matterId || filterState.contactId || filterState.uploaderId || filterState.q || filterState.tags) && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-700">Files</h3>
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((doc) => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("documentId", doc.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="group relative rounded-lg border border-slate-200 bg-white p-3 hover:shadow-md hover:border-blue-300 transition cursor-pointer"
                  >
                    {/* Checkbox - appears on hover */}
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.has(doc.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleDocSelection(doc.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </div>

                    {/* File Icon and Info */}
                    <div 
                      className="flex flex-col items-center gap-2"
                      onClick={() => openDetail(doc)}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 text-2xl group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
                        {getFileIcon(doc.mime)}
                      </div>
                      <div className="w-full text-center space-y-0.5">
                        <div className="font-normal text-slate-900 text-xs truncate px-1 leading-tight" title={doc.displayName || doc.filename}>
                          {doc.displayName || doc.filename}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatBytes(doc.size)} • v{doc.version}
                        </div>
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-center mt-1">
                            {doc.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                #{tag}
                              </span>
                            ))}
                            {doc.tags.length > 2 && (
                              <span className="text-xs text-slate-400">+{doc.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick info on hover */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                        disabled={downloadingId === doc.id}
                        className="rounded-full bg-blue-600 p-1.5 text-white hover:bg-blue-700 transition disabled:opacity-60"
                        title="Download"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="text-4xl text-slate-300">📄</div>
              <p className="text-sm font-medium text-slate-600">Kayıt bulunamadı</p>
              <p className="text-xs text-slate-500">Filtrelerinizi değiştirmeyi deneyin</p>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions toolbar - now below grid */}
      {selectedDocIds.size > 0 && viewMode === "grid" && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {selectedDocIds.size}
            </div>
            <span className="text-sm font-semibold text-blue-900">
              {selectedDocIds.size} document{selectedDocIds.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => setSelectedDocIds(new Set())}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 transition"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkDelete}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition shadow-sm"
            >
              Delete selected
            </button>
            <select
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  handleBulkMove(value === "root" ? null : value);
                  e.target.value = "";
                }
              }}
              className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 transition shadow-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Move to...
              </option>
              <option value="root">📁 Root</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  📁 {folder.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* List View - Combined Folders and Files */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {/* Folders in list view */}
          {folders.map((folder) => (
            <div
              key={`folder-${folder.id}`}
              onClick={() => handleFolderNavigate(folder.id)}
              className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 cursor-pointer transition group"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-2xl bg-${folder.color}-100`}>
                📁
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">{folder.name}</div>
                <div className="text-xs text-slate-500">{folder._count.documents} files{folder._count.subfolders > 0 ? `, ${folder._count.subfolders} folders` : ""}</div>
              </div>
              <div className="text-xs text-slate-400">Folder</div>
            </div>
          ))}

          {/* Files in list view - Only show if in a folder or has active filters */}
          {(currentFolderId || filterState.matterId || filterState.contactId || filterState.uploaderId || filterState.q || filterState.tags) && items.map((doc) => (
            <div
              key={`file-${doc.id}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("documentId", doc.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 cursor-pointer transition group"
            >
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedDocIds.has(doc.id)}
                  onChange={() => toggleDocSelection(doc.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-lg group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors"
              >
                {getFileIcon(doc.mime)}
              </div>
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => openDetail(doc)}
              >
                <div className="font-medium text-slate-900 truncate">{doc.filename}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{formatBytes(doc.size)}</span>
                  <span>•</span>
                  <span>v{doc.version}</span>
                  {doc.matter?.title && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600">{doc.matter.title}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden md:block text-xs text-slate-500">
                {dateFormatter.format(new Date(doc.createdAt))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(doc);
                }}
                disabled={downloadingId === doc.id}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
              >
                {downloadingId === doc.id ? "..." : "↓"}
              </button>
            </div>
          ))}

          {folders.length === 0 && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="text-4xl text-slate-300">📄</div>
              <p className="text-sm font-medium text-slate-600">Kayıt bulunamadı</p>
              <p className="text-xs text-slate-500">Filtrelerinizi değiştirmeyi deneyin</p>
            </div>
          )}
        </div>
      )}

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.variant === "error" ? "bg-rose-600" : "bg-emerald-600"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <DocumentDetailDrawer
        documentId={selectedDocumentId}
        initialDocument={selectedDocument}
        onClose={closeDetail}
        onUpdated={handleUpdated}
      />

      <CreateFolderDialog
        isOpen={showCreateFolder}
        onClose={() => {
          setShowCreateFolder(false);
          setSelectedParentFolderId(null);
        }}
        onCreate={(name, color, accessScope, accessMetadata, userIds) => 
          handleCreateFolder(name, color, accessScope, accessMetadata, userIds, selectedParentFolderId)
        }
        availableFolders={folders.map(f => ({
          id: f.id,
          name: f.name,
          color: f.color,
        }))}
        selectedParentFolderId={selectedParentFolderId}
        onParentFolderChange={setSelectedParentFolderId}
      />

      {editingFolderId && (
        <EditFolderDialog
          isOpen={showEditFolder}
          onClose={() => {
            setShowEditFolder(false);
            setEditingFolderId(null);
          }}
          folderId={editingFolderId}
          onUpdate={() => {
            setShowEditFolder(false);
            setEditingFolderId(null);
            loadFolderPath(currentFolderId);
          }}
        />
      )}
    </section>
  );
}
