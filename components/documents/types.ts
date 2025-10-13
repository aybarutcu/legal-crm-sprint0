export type DocumentListItem = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  version: number;
  tags: string[];
  storageKey: string;
  hash: string | null;
  createdAt: string;
  signedAt: string | null;
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
