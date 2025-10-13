import { prisma } from "@/lib/prisma";
import type { EventWithRelations } from "@/lib/events/service";

type GoogleAccountRecord = {
  id: string;
  userId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
};

type GoogleEventResponse = {
  id?: string;
  etag?: string;
};

type GoogleEventResource = {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: "email" | "popup"; minutes: number }>;
  };
};

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_API_BASE = "https://www.googleapis.com/calendar/v3";

export async function pushEventToGoogle({
  event,
  calendarExternalId,
  calendarUserId,
}: {
  event: EventWithRelations;
  calendarExternalId: string;
  calendarUserId: string;
}): Promise<GoogleEventResponse> {
  const account = await getGoogleAccount(calendarUserId);
  if (!account) {
    throw new Error("Google hesabı bağlı değil");
  }

  const accessToken = await ensureAccessToken(account);
  const resource = buildGoogleEventResource(event);

  const calendarId = encodeURIComponent(calendarExternalId);
  const hasExternal = Boolean(event.externalCalId);
  const url = hasExternal
    ? `${GOOGLE_API_BASE}/calendars/${calendarId}/events/${encodeURIComponent(event.externalCalId ?? "")}`
    : `${GOOGLE_API_BASE}/calendars/${calendarId}/events`;

  const response = await fetch(url, {
    method: hasExternal ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resource),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar event push failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as GoogleEventResponse;
  return {
    id: payload.id,
    etag: payload.etag,
  };
}

export async function deleteEventFromGoogle({
  calendarExternalId,
  calendarUserId,
  externalEventId,
}: {
  calendarExternalId: string;
  calendarUserId: string;
  externalEventId: string;
}): Promise<void> {
  const account = await getGoogleAccount(calendarUserId);
  if (!account) return;

  const accessToken = await ensureAccessToken(account);
  const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalEventId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Google Calendar event delete failed: ${response.status} ${text}`);
  }
}

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method?: string; minutes?: number }>;
  };
  updated?: string;
  etag?: string;
};

export type GoogleEventsListResult = {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
};

export async function listGoogleCalendarEvents({
  calendarExternalId,
  calendarUserId,
  syncToken,
  fallbackTimeMin,
}: {
  calendarExternalId: string;
  calendarUserId: string;
  syncToken?: string | null;
  fallbackTimeMin: string;
}): Promise<GoogleEventsListResult> {
  const account = await getGoogleAccount(calendarUserId);
  if (!account) {
    throw new Error("Google hesabı bağlı değil");
  }

  const accessToken = await ensureAccessToken(account);
  const events: GoogleCalendarEvent[] = [];
  let nextSyncToken: string | undefined;
  let pageToken: string | undefined;
  let useSyncToken = Boolean(syncToken);

  while (true) {
    const params = new URLSearchParams();
    params.set("singleEvents", "true");
    params.set("maxResults", "100");
    params.set("showDeleted", "true");

    if (useSyncToken && syncToken) {
      params.set("syncToken", syncToken);
    } else {
      params.set("timeMin", fallbackTimeMin);
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events?${params}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 410) {
      // Sync token expired; restart with timeMin.
      useSyncToken = false;
      syncToken = undefined;
      pageToken = undefined;
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar list failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    if (payload.items) {
      events.push(...payload.items.filter((item): item is GoogleCalendarEvent => Boolean(item.id)));
    }

    if (payload.nextPageToken) {
      pageToken = payload.nextPageToken;
    } else {
      nextSyncToken = payload.nextSyncToken;
      break;
    }
  }

  return { items: events, nextSyncToken };
}

async function getGoogleAccount(userId: string): Promise<GoogleAccountRecord | null> {
  return prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      id: true,
      userId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });
}

async function ensureAccessToken(account: GoogleAccountRecord): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at - 90 > now) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Google refresh token bulunamadı");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth yapılandırması eksik");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token yenilenemedi: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600);

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: payload.access_token,
      expires_at: expiresAt,
      ...(payload.refresh_token ? { refresh_token: payload.refresh_token } : {}),
    },
  });

  return payload.access_token;
}

function buildGoogleEventResource(event: EventWithRelations): GoogleEventResource {
  const attendees = Array.isArray(event.attendees)
    ? event.attendees
        .map((attendee) => {
          if (!attendee || typeof attendee !== "object") return null;
          const email = (attendee as { email?: string }).email;
          if (!email) return null;
          const name = (attendee as { name?: string }).name;
          return {
            email,
            ...(name ? { displayName: name } : {}),
          };
        })
        .filter(Boolean)
    : [];

  const reminderMinutes = event.reminderMinutes ?? 30;

  const resource: GoogleEventResource = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: {
      dateTime: event.startAt.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: event.endAt.toISOString(),
      timeZone: "UTC",
    },
    attendees: attendees.length > 0 ? (attendees as Array<{ email: string; displayName?: string }>) : undefined,
    reminders: {
      useDefault: false,
      overrides: [{ method: "email", minutes: reminderMinutes }],
    },
  };

  if (reminderMinutes > 0) {
    resource.reminders = {
      useDefault: false,
      overrides: [
        { method: "email", minutes: reminderMinutes },
        { method: "popup", minutes: reminderMinutes },
      ],
    };
  } else {
    resource.reminders = { useDefault: false };
  }

  return resource;
}
