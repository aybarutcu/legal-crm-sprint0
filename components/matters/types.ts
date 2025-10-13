export type MatterListItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  jurisdiction?: string | null;
  court?: string | null;
  openedAt: string;
  nextHearingAt?: string | null;
  ownerId?: string | null;
  client: {
    id: string;
    name: string;
  } | null;
};

export type ContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export type MatterParty = {
  id: string;
  role: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
};

export type MatterDetail = {
  id: string;
  title: string;
  type: string;
  status: string;
  jurisdiction?: string | null;
  court?: string | null;
  openedAt: string;
  nextHearingAt?: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  parties: MatterParty[];
};
