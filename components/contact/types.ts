export type ContactListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  company?: string | null;
  type: string;
  status: string;
  tags: string[];
  ownerId: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  createdAt: string;
};
