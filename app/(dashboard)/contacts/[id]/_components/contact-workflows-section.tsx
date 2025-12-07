"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { StartWorkflowDialog } from "./start-workflow-dialog";
import { WorkflowManagementSection } from "@/components/matters/workflows";
import { MatterDocumentUploadDialog } from "@/components/documents/MatterDocumentUploadDialog";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";
import type { DocumentListItem } from "@/components/documents/types";

type ActionType =
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "AUTOMATION_EMAIL"
  | "AUTOMATION_WEBHOOK";

type ActionState =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

type WorkflowInstanceWithDetails = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  template: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  steps: Array<{
    id: string;
    title: string;
    actionType: ActionType;
    actionState: ActionState;
    actionData: Record<string, unknown> | null;
    roleScope: RoleScope;
    required: boolean;
    order?: number;
    assignedToId: string | null;
    dueDate: Date | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | null;
    startedAt: Date | null;
    completedAt: Date | null;
    positionX?: number | null;
    positionY?: number | null;
  }>;
  dependencies?: Array<{
    id: string;
    sourceStepId: string;
    targetStepId: string;
    dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
    dependencyLogic: "ALL" | "ANY" | "CUSTOM";
    conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
    conditionConfig?: Record<string, unknown>;
  }>;
};

interface ContactWorkflowsSectionProps {
  contactId: string;
  workflows: WorkflowInstanceWithDetails[];
  currentUserRole: Role;
  canManageWorkflows: boolean;
  onRefresh?: () => void;
}

export function ContactWorkflowsSection({
  contactId,
  workflows,
  currentUserRole,
  canManageWorkflows,
  onRefresh,
}: ContactWorkflowsSectionProps) {
  const router = useRouter();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadWorkflowStepId, setUploadWorkflowStepId] = useState<string | null>(null);
  const [uploadDocumentTags, setUploadDocumentTags] = useState<string[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);

  // Load contact documents
  useEffect(() => {
    loadDocuments();
  }, [contactId]);

  async function loadDocuments() {
    setDocsLoading(true);
    try {
      const response = await fetch(`/api/documents?contactId=${contactId}&page=1&pageSize=50`);
      if (!response.ok) {
        throw new Error("Documents could not be loaded");
      }
      const payload: { data: DocumentListItem[] } = await response.json();
      setDocuments(payload.data);
    } catch (error) {
      console.error(error);
    } finally {
      setDocsLoading(false);
    }
  }

  const handleWorkflowStarted = async () => {
    // Refresh the page to show the new workflow
    await loadDocuments();
    if (onRefresh) {
      await onRefresh();
    } else {
      router.refresh();
    }
  };

  const handleAddWorkflow = () => {
    setShowStartDialog(true);
  };

  const handleCancelWorkflow = useCallback(async (workflowId: string) => {
    if (!window.confirm("Are you sure you want to cancel this workflow?")) return;

    try {
      const response = await fetch(`/api/workflows/instances/${workflowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel workflow");
      }

      await handleWorkflowStarted();
    } catch (error) {
      console.error("Error canceling workflow:", error);
      window.alert("Failed to cancel workflow");
    }
  }, [handleWorkflowStarted]);

  const handleDeleteWorkflow = useCallback(async (workflowId: string) => {
    if (!window.confirm("Are you sure you want to delete this workflow?")) return;

    try {
      const response = await fetch(`/api/workflows/instances/${workflowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete workflow");
      }

      await handleWorkflowStarted();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      window.alert("Failed to delete workflow");
    }
  }, [handleWorkflowStarted]);

  const handleUpdateStepMetadata = useCallback(async (workflowId: string, stepId: string, data: {
    dueDate?: string | null;
    assignedToId?: string | null;
    priority?: string | null;
  }) => {
    try {
      const response = await fetch(`/api/workflows/instances/${workflowId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update step metadata");
      }

      await handleWorkflowStarted();
    } catch (error) {
      console.error("Error updating step metadata:", error);
      window.alert("Failed to update step metadata");
    }
  }, [handleWorkflowStarted]);

  const handleAddDocumentForStep = useCallback((stepId: string, documentName: string) => {
    // Set the workflow step and document tag for upload
    setUploadWorkflowStepId(stepId);
    setUploadDocumentTags([documentName]);
    setIsUploadDialogOpen(true);
  }, []);

  const openDocDetail = useCallback((doc: DocumentListItem) => {
    setSelectedDocumentId(doc.id);
    setSelectedDocument(doc);
  }, []);

  return (
    <>
      <WorkflowManagementSection
        entityId={contactId}
        entityType="contact"
        workflows={workflows as any}
        currentUserRole={currentUserRole}
        canManageWorkflows={canManageWorkflows}
        documents={documents}
        docsLoading={docsLoading}
        onUploadDocument={() => setIsUploadDialogOpen(true)}
        onViewDocument={openDocDetail}
        onRefresh={handleWorkflowStarted}
        onAddWorkflow={handleAddWorkflow}
        onCancelWorkflow={handleCancelWorkflow}
        onDeleteWorkflow={handleDeleteWorkflow}
        onUpdateStepMetadata={handleUpdateStepMetadata}
        onAddDocumentForStep={handleAddDocumentForStep}
      />

      {/* Start Workflow Dialog */}
      <StartWorkflowDialog
        contactId={contactId}
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onSuccess={handleWorkflowStarted}
      />

      {/* Document Upload Dialog */}
      <MatterDocumentUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => {
          setIsUploadDialogOpen(false);
          setUploadWorkflowStepId(null);
          setUploadDocumentTags([]);
        }}
        contactId={contactId}
        workflowStepId={uploadWorkflowStepId}
        tags={uploadDocumentTags}
        onUploadComplete={async () => {
          await loadDocuments();
          await handleWorkflowStarted();
          setUploadWorkflowStepId(null);
          setUploadDocumentTags([]);
        }}
      />

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer
        documentId={selectedDocumentId}
        initialDocument={selectedDocument}
        onClose={() => {
          setSelectedDocumentId(null);
          setSelectedDocument(null);
        }}
        onUpdated={(updatedDoc) => {
          setDocuments((prev) =>
            prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
          );
          setSelectedDocument(updatedDoc);
        }}
      />
    </>
  );
}
