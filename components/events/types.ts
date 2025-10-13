import type { CalendarView } from "@/lib/events/date-range";

export type CalendarOption = {
  id: string;
  name: string;
  provider: "LOCAL" | "GOOGLE";
  isPrimary: boolean;
  lastSyncedAt: string | null;
  defaultReminderMinutes: number;
};

export type MatterOption = {
  id: string;
  title: string;
};

export type EventAttendee = {
  email: string;
  name?: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  reminderMinutes: number;
  attendees: EventAttendee[];
  calendar: {
    id: string;
    name: string;
    provider: string;
  } | null;
  matter: {
    id: string;
    title: string;
  } | null;
  organizer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  externalCalId: string | null;
  externalEtag: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventsResponse = {
  data: EventItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type CalendarFilters = {
  q?: string;
  matterId?: string;
  attendee?: string;
  calendarId?: string;
  view: CalendarView;
};
