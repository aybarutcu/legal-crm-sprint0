export type DocumentListItem = {
  id: string;
  filename: string;
  displayName?: string | null;
  mime: string;
  size: number;
  version: number;
  tags: string[];
  storageKey: string;
  hash: string | null;
  createdAt: string;
  signedAt: string | null;
  workflowStepId: string | null;
  folderId?: string | null;
  accessScope?: string;
  accessMetadata?: Record<string, unknown> | null;
  matter: {
    id: string;
    title: string;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  uploader: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type MatterOption = {
  id: string;
  title: string;
};

export type ContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export type UploaderOption = {
  id: string;
  name: string | null;
  email: string | null;
};
