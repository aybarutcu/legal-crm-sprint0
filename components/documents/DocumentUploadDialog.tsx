"use client";

import { FormEvent, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Globe, Users, UserCheck, Lock, X, Upload, AlertCircle, CheckCircle } from "lucide-react";
import Select from "react-select";
import { DocumentTypeIcon } from "@/components/documents/DocumentTypeIcon";
import { formatFileSize } from "@/lib/documents/format-utils";
import type {
  ContactOption,
  DocumentListItem,
  MatterOption,
} from "@/components/documents/types";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

type AccessScope = "PUBLIC" | "ROLE_BASED" | "USER_BASED" | "PRIVATE";

type DocumentUploadDialogProps = {
  matters: MatterOption[];
  contacts: ContactOption[];
  currentFolderId?: string | null;
  maxUploadBytes?: number;
  onCreated?: (document: DocumentListItem) => void;
};

const defaultMaxBytes = MAX_UPLOAD_BYTES;

type UploadTarget = {
  url: string;
  method: "PUT" | "POST";
  fields?: Record<string, string> | null;
  headers?: Record<string, string> | null;
};

async function performUpload(target: UploadTarget, file: globalThis.File) {
  if (target.method === "POST") {
    const formData = new globalThis.FormData();
    if (target.fields) {
      Object.entries(target.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    formData.append("file", file);
    return fetch(target.url, {
      method: "POST",
      body: formData,
    });
  }

  const headers: Record<string, string> = {
    ...(target.headers ?? {}),
  };

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = file.type;
  }

  return fetch(target.url, {
    method: target.method,
    headers,
    body: file,
  });
}

export function DocumentUploadDialog({
  matters,
  contacts,
  currentFolderId,
  maxUploadBytes = defaultMaxBytes,
  onCreated,
}: DocumentUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<globalThis.File[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [matterId, setMatterId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [selectedMatter, setSelectedMatter] = useState<{ value: string; label: string } | null>(null);
  const [selectedContact, setSelectedContact] = useState<{ value: string; label: string } | null>(null);
  const [tags, setTags] = useState<string>("");
  const [accessScope, setAccessScope] = useState<AccessScope>("PUBLIC");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prepare options for react-select
  const matterOptions = matters.map(m => ({ value: m.id, label: m.title }));
  const contactOptions = contacts.map(c => ({ value: c.id, label: c.name }));

  // Sync react-select values with state
  useEffect(() => {
    setMatterId(selectedMatter?.value || "");
  }, [selectedMatter]);

  useEffect(() => {
    setContactId(selectedContact?.value || "");
  }, [selectedContact]);

  // Custom styles for react-select
  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderColor: '#cbd5e1',
      '&:hover': {
        borderColor: '#94a3b8',
      },
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

  useEffect(() => {
    if (open && accessScope === "USER_BASED") {
      loadUsers();
    }
  }, [open, accessScope]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setError(null);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setError(null);
    }
  }, []);

  const validateFile = (file: globalThis.File): string | null => {
    if (file.size > maxUploadBytes) {
      return `${file.name} exceeds ${maxSizeLabel} limit`;
    }
    if (!file.type) {
      return `${file.name}: MIME type could not be determined`;
    }
    return null;
  };

  const maxSizeLabel = useMemo(() => {
    const mb = maxUploadBytes / 1024 / 1024;
    return `${Math.round(mb)} MB`;
  }, [maxUploadBytes]);

  function resetForm() {
    setFiles([]);
    setDisplayName("");
    setMatterId("");
    setContactId("");
    setSelectedMatter(null);
    setSelectedContact(null);
    setTags("");
    setAccessScope("PUBLIC");
    setSelectedRoles([]);
    setSelectedUsers([]);
    setError(null);
    setDragActive(false);
  }

  function closeDialog() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!files.length) {
      setError("En az bir dosya seçmelisiniz.");
      return;
    }

    // Validate all files
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const accessMetadata = accessScope === "ROLE_BASED" && selectedRoles.length > 0
      ? { allowedRoles: selectedRoles }
      : undefined;

    const userIds = accessScope === "USER_BASED" && selectedUsers.length > 0
      ? selectedUsers
      : undefined;

    setLoading(true);
    let successCount = 0;
    let currentFile: globalThis.File | null = null;
    try {

      for (const file of files) {
        currentFile = file;

        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            displayName: displayName || file.name,
            mime: file.type,
            size: file.size,
            matterId: matterId || undefined,
            contactId: contactId || undefined,
            folderId: currentFolderId || undefined,
          }),
        });

        if (!uploadResponse.ok) {
          const payload = await uploadResponse.json().catch(() => ({}));
          throw new Error(payload.error ?? "Signed URL oluşturulamadı");
        }

        const uploadPayload: {
          documentId: string;
          storageKey: string;
          version: number;
          upload?: UploadTarget;
          putUrl?: string;
          method?: "PUT" | "POST";
        } = await uploadResponse.json();

        const fallbackMethod = uploadPayload.method === "POST" ? "POST" : "PUT";
        const uploadTarget: UploadTarget =
          uploadPayload.upload ??
          {
            url: uploadPayload.putUrl ?? "",
            method: fallbackMethod,
            fields: null,
            headers: null,
          };

        if (!uploadTarget.url) {
          throw new Error("Yükleme hedefi sağlanamadı.");
        }

        const uploadResult = await performUpload(uploadTarget, file);

        if (!uploadResult.ok) {
          throw new Error("Dosya yüklemesi başarısız oldu");
        }

        const metaResponse = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: uploadPayload.documentId,
            filename: file.name,
            displayName: displayName || file.name,
            mime: file.type,
            size: file.size,
            storageKey: uploadPayload.storageKey,
            version: uploadPayload.version,
            matterId: matterId || undefined,
            contactId: contactId || undefined,
            folderId: currentFolderId || undefined,
            tags: tagsArray,
            accessScope,
            accessMetadata,
            userIds,
          }),
        });

        if (!metaResponse.ok) {
          const payload = await metaResponse.json().catch(() => ({}));
          throw new Error(payload.error ?? "Doküman kaydedilemedi");
        }

        const created = (await metaResponse.json()) as DocumentListItem;
        onCreated?.(created);
        successCount += 1;
      }

      if (successCount) {
        setToast(
          successCount === 1
            ? "Doküman yüklendi."
            : `${successCount} doküman yüklendi.`,
        );
        setTimeout(() => setToast(null), 3000);
        closeDialog();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu";
      setError(currentFile ? `${currentFile.name}: ${message}` : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
        data-testid="document-upload-button"
      >
        Yeni Doküman
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            data-testid="document-upload-dialog"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Doküman Yükle</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Dosya yükleyin ve erişim ayarlarını yapılandırın
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg p-1 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* File Upload Area - Drag and Drop */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Dosya
                </label>
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
                    accept={ALLOWED_MIME_TYPES.join(",") + ",image/*"}
                    multiple
                    onChange={handleFileInputChange}
                  />

                  {files.length === 0 ? (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Drag and drop your files here
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
                        Maksimum {maxSizeLabel} per file
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3 text-left">
                          <DocumentTypeIcon mimeType={file.type} className="h-8 w-8 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFiles(files.filter((_, i) => i !== index));
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                      >
                        + Add More Files
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name <span className="text-slate-400 font-normal">(Opsiyonel)</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Örn: Nufüs Cuzdani"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Versiyonlama için kullanılır. Boş bırakılırsa dosya adı kullanılır.
                </p>
              </div>

              {/* Matter and Contact (Optional) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="matter" className="block text-sm font-medium text-slate-700 mb-2">
                    Matter <span className="text-slate-400 font-normal">(Opsiyonel)</span>
                  </label>
                  <Select
                    id="matter"
                    value={selectedMatter}
                    onChange={(option) => setSelectedMatter(option)}
                    options={matterOptions}
                    isClearable
                    placeholder="Seçiniz"
                    styles={selectStyles}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>

                <div>
                  <label htmlFor="contact" className="block text-sm font-medium text-slate-700 mb-2">
                    Contact <span className="text-slate-400 font-normal">(Opsiyonel)</span>
                  </label>
                  <Select
                    id="contact"
                    value={selectedContact}
                    onChange={(option) => setSelectedContact(option)}
                    options={contactOptions}
                    isClearable
                    placeholder="Seçiniz"
                    styles={selectStyles}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>
              </div>

              {/* Tags (Optional) */}
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-slate-700 mb-2">
                  Etiketler <span className="text-slate-400 font-normal">(Opsiyonel, virgülle ayrılmış)</span>
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="kanit,imza"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Access Scope */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Erişim Seviyesi
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
                      <p className="text-xs text-slate-500 mt-1">
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
                      <p className="text-xs text-slate-500 mt-1">
                        Only specific roles can access
                      </p>
                      {accessScope === "ROLE_BASED" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"].map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(role)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
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
                      <p className="text-xs text-slate-500 mt-1">
                        Only specific users can access
                      </p>
                      {accessScope === "USER_BASED" && (
                        <div className="mt-3">
                          {loadingUsers ? (
                            <p className="text-xs text-slate-500">Loading users...</p>
                          ) : (
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {users.map((user) => (
                                <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => toggleUser(user.id)}
                                    className="rounded border-slate-300"
                                  />
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-slate-900">
                                      {user.name || user.email}
                                    </div>
                                    <div className="text-xs text-slate-500">{user.role}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
                      <p className="text-xs text-slate-500 mt-1">
                        Only document creator and admins can access
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error Display */}
              {error ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Yükleniyor..." : "Yükle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          <CheckCircle className="h-5 w-5" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
