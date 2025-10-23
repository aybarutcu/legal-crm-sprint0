"use client";

/// <reference lib="dom" />
import React, { useState, useRef, useCallback } from "react";
import { X, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { DocumentTypeIcon } from "./DocumentTypeIcon";
import { formatFileSize } from "@/lib/documents/format-utils";

type MatterDocumentUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  matterId: string;
  workflowStepId?: string | null;
  tags?: string[];
  onUploadComplete?: () => void;
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
  workflowStepId,
  tags,
  onUploadComplete,
}: MatterDocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileInputRef = useRef<any>(null);

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

    setUploadState("uploading");
    setErrorMessage("");

    try {
      // Step 1: Request signed upload URL from /api/uploads
      const uploadRequestResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          mime: selectedFile.type,
          size: selectedFile.size,
          matterId,
        }),
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
      const finalizeResponse = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: uploadData.documentId,
          filename: selectedFile.name,
          mime: selectedFile.type,
          size: selectedFile.size,
          storageKey: uploadData.storageKey,
          version: uploadData.version,
          matterId,
          workflowStepId: workflowStepId || undefined,
          tags: tags || undefined,
        }),
      });

      if (!finalizeResponse.ok) {
        const error = await finalizeResponse.json();
        throw new Error(error.error || "Failed to finalize document");
      }

      const finalizedDoc = await finalizeResponse.json();
      console.log("✅ Document uploaded successfully:", finalizedDoc);
      console.log("📋 Document matterId:", finalizedDoc.matterId);

      setUploadState("success");
      
      // Wait a moment to show success state
      setTimeout(() => {
        console.log("🔄 Calling onUploadComplete callback...");
        onUploadComplete?.();
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
    setUploadState("idle");
    setErrorMessage("");
    setDragActive(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Upload Document</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            disabled={uploadState === "uploading"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
            disabled={!selectedFile || uploadState === "uploading" || uploadState === "success"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {uploadState === "uploading" ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
