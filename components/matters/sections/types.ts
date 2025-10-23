/**
 * Type definitions for Matter sections components
 * 
 * These types support the extracted section components:
 * - MatterPartiesSection: Party management
 * - MatterDocumentsSection: Document listing and upload
 * - MatterStatusUpdateSection: Status and hearing date updates
 */

import type { MatterParty } from "@/components/matters/types";
import type { DocumentListItem } from "@/components/documents/types";

/**
 * Props for MatterPartiesSection component
 */
export type MatterPartiesSectionProps = {
  /** List of parties associated with the matter */
  parties: MatterParty[];
  /** Callback when "Taraf Ekle" button is clicked */
  onAddParty: () => void;
  /** Callback to remove a party by ID */
  onRemoveParty: (partyId: string) => void;
};

/**
 * Props for MatterDocumentsSection component
 */
export type MatterDocumentsSectionProps = {
  /** List of documents associated with the matter */
  documents: DocumentListItem[];
  /** Whether documents are currently loading */
  loading: boolean;
  /** Callback when "Upload" button is clicked */
  onUploadClick: () => void;
  /** Callback when "View" button is clicked for a document */
  onViewDocument: (document: DocumentListItem) => void;
  /** Optional list of document IDs to highlight (e.g., attached to selected workflow step) */
  highlightedDocumentIds?: string[];
};

/**
 * Props for MatterStatusUpdateSection component
 */
export type MatterStatusUpdateSectionProps = {
  /** Current matter status */
  status: string;
  /** Current next hearing date (ISO string or empty) */
  nextHearingAt: string;
  /** Whether an update operation is in progress */
  loading: boolean;
  /** Callback when status changes */
  onStatusChange: (status: string) => void;
  /** Callback when hearing date changes */
  onHearingDateChange: (date: string) => void;
  /** Callback when "Kaydet" button is clicked */
  onSubmit: () => void;
};
