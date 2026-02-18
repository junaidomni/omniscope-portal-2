/**
 * Google Calendar API Service
 * Production-ready integration using OAuth2 refresh tokens.
 * Replaces the MCP-based approach that only works in sandbox.
 */
import { google, calendar_v3 } from "googleapis";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { googleTokens, calendarEvents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================================
// OAUTH2 CLIENT
// ============================================================================

function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    ENV.googleClientId,
    ENV.googleClientSecret,
    redirectUri || ""
  );
}

/**
 * Generate the Google OAuth2 authorization URL
 */
export function getGoogleAuthUrl(origin: string, userId: number, returnPath?: string): string {
  const redirectUri = `${origin}/api/google/callback`;
  const oauth2Client = getOAuth2Client(redirectUri);

  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force consent to always get refresh_token
    state: JSON.stringify({ userId, origin, returnPath: returnPath || "/integrations" }),
  });
}

/**
 * Exchange authorization code for tokens and store them
 */
export async function handleGoogleCallback(
  code: string,
  state: string
): Promise<{ success: boolean; origin: string; returnPath?: string; error?: string }> {
  try {
    const { userId, origin, returnPath } = JSON.parse(state);
    const redirectUri = `${origin}/api/google/callback`;
    const oauth2Client = getOAuth2Client(redirectUri);

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return { success: false, origin, error: "No access token received" };
    }

    // Get the user's Google email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email || null;

    const db = await getDb();
    if (!db) return { success: false, origin, error: "Database not available" };

    // Upsert: delete existing tokens for this user, then insert new ones
    await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    await db.insert(googleTokens).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      email: googleEmail,
    });

    console.log(`[Google] OAuth tokens stored for user ${userId} (${googleEmail})`);
    return { success: true, origin, returnPath: returnPath || "/integrations" };
  } catch (error: any) {
    console.error("[Google] OAuth callback error:", error.message);
    return { success: false, origin: "", error: error.message };
  }
}

/**
 * Get an authenticated Google Calendar client for a user
 */
async function getCalendarClient(userId: number): Promise<calendar_v3.Calendar | null> {
  const db = await getDb();
  if (!db) return null;

  const tokens = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (tokens.length === 0) return null;

  const token = tokens[0];
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    token_type: token.tokenType,
    expiry_date: token.expiresAt ? token.expiresAt.getTime() : undefined,
  });

  // Auto-refresh: listen for new tokens
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const updates: any = {};
      if (newTokens.access_token) updates.accessToken = newTokens.access_token;
      if (newTokens.refresh_token) updates.refreshToken = newTokens.refresh_token;
      if (newTokens.expiry_date) updates.expiresAt = new Date(newTokens.expiry_date);

      if (Object.keys(updates).length > 0) {
        await db
          .update(googleTokens)
          .set(updates)
          .where(eq(googleTokens.id, token.id));
        console.log(`[Google] Tokens refreshed for user ${userId}`);
      }
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Get an authenticated Gmail client for a user
 */
export async function getGmailClient(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const tokens = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (tokens.length === 0) return null;

  const token = tokens[0];
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    token_type: token.tokenType,
    expiry_date: token.expiresAt ? token.expiresAt.getTime() : undefined,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const updates: any = {};
      if (newTokens.access_token) updates.accessToken = newTokens.access_token;
      if (newTokens.refresh_token) updates.refreshToken = newTokens.refresh_token;
      if (newTokens.expiry_date) updates.expiresAt = new Date(newTokens.expiry_date);
      if (Object.keys(updates).length > 0) {
        await db.update(googleTokens).set(updates).where(eq(googleTokens.id, token.id));
      }
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

// ============================================================================
// CALENDAR OPERATIONS
// ============================================================================

/**
 * Check if a user has connected their Google account
 */
export async function isGoogleConnected(userId: number): Promise<{
  connected: boolean;
  email?: string;
  hasCalendarScopes?: boolean;
  hasGmailScopes?: boolean;
  scopes?: string[];
}> {
  const db = await getDb();
  if (!db) return { connected: false };

  const tokens = await db
    .select({ email: googleTokens.email, refreshToken: googleTokens.refreshToken, scope: googleTokens.scope })
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (tokens.length === 0 || !tokens[0].refreshToken) {
    return { connected: false };
  }

  const scopeStr = tokens[0].scope || "";
  const scopes = scopeStr.split(/\s+/).filter(Boolean);
  const hasCalendarScopes = scopes.some(s => s.includes("calendar"));
  const hasGmailScopes = scopes.some(s => s.includes("gmail.readonly")) && scopes.some(s => s.includes("gmail.modify"));

  return {
    connected: true,
    email: tokens[0].email || undefined,
    hasCalendarScopes,
    hasGmailScopes,
    scopes,
  };
}

/**
 * Create an event in Google Calendar
 */
export async function createGoogleCalendarEvent(
  userId: number,
  event: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: string[];
    addGoogleMeet?: boolean;
    timezone?: string;
  }
): Promise<{
  success: boolean;
  googleEventId?: string;
  hangoutLink?: string;
  htmlLink?: string;
  error?: string;
}> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const tz = event.timezone || "America/New_York";

    const eventBody: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: tz,
      },
    };

    if (event.attendees && event.attendees.length > 0) {
      eventBody.attendees = event.attendees.map((email) => ({ email }));
    }

    if (event.addGoogleMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `omniscope-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
      conferenceDataVersion: event.addGoogleMeet ? 1 : 0,
      sendUpdates: "all", // Send email invitations to attendees
    });

    const created = response.data;
    console.log(`[Google Calendar] Event created: ${created.id} - "${event.summary}"`);

    return {
      success: true,
      googleEventId: created.id || undefined,
      hangoutLink: created.hangoutLink || undefined,
      htmlLink: created.htmlLink || undefined,
    };
  } catch (error: any) {
    console.error("[Google Calendar] Create event error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  userId: number,
  eventId: string
): Promise<boolean> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return false;

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });
    console.log(`[Google Calendar] Event deleted: ${eventId}`);
    return true;
  } catch (error: any) {
    console.error("[Google Calendar] Delete event error:", error.message);
    return false;
  }
}

/**
 * Sync events from Google Calendar to local database
 */
export async function syncGoogleCalendarEvents(
  userId: number
): Promise<{ synced: number; updated: number; total: number; error?: string }> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) {
    return { synced: 0, updated: 0, total: 0, error: "Google Calendar not connected" };
  }

  const db = await getDb();
  if (!db) return { synced: 0, updated: 0, total: 0, error: "Database not available" };

  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: threeMonthsAgo.toISOString(),
      timeMax: threeMonthsAhead.toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: "startTime",
    });

    const gcalEvents = response.data.items || [];
    let synced = 0;
    let updated = 0;

    for (const event of gcalEvents) {
      if (!event.id || !event.summary) continue;

      const startTime = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date + "T00:00:00Z")
          : null;

      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date + "T23:59:59Z")
          : null;

      if (!startTime || !endTime) continue;

      const attendeeEmails = (event.attendees || [])
        .map((a) => a.email)
        .filter(Boolean) as string[];

      const values = {
        googleEventId: event.id,
        summary: event.summary,
        description: event.description || null,
        startTime,
        endTime,
        isAllDay: !event.start?.dateTime,
        location: event.location || null,
        attendees: JSON.stringify(attendeeEmails),
        hangoutLink: event.hangoutLink || null,
        htmlLink: event.htmlLink || null,
        calendarId: "primary",
        syncedAt: new Date(),
      };

      try {
        const existing = await db
          .select({ id: calendarEvents.id })
          .from(calendarEvents)
          .where(eq(calendarEvents.googleEventId, event.id))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(calendarEvents)
            .set(values)
            .where(eq(calendarEvents.googleEventId, event.id));
          updated++;
        } else {
          await db.insert(calendarEvents).values(values);
          synced++;
        }
      } catch (err) {
        console.warn(`[Google Calendar] Skipping event ${event.id}: ${(err as Error).message}`);
      }
    }

    console.log(`[Google Calendar] Sync complete: ${synced} new, ${updated} updated, ${gcalEvents.length} total`);
    return { synced, updated, total: gcalEvents.length };
  } catch (error: any) {
    console.error("[Google Calendar] Sync error:", error.message);
    return { synced: 0, updated: 0, total: 0, error: error.message };
  }
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailEmail(
  userId: number,
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return false;

  try {
    // Build the MIME message
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      htmlBody,
    ];
    const message = messageParts.join("\n");

    // Base64url encode
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    console.log(`[Gmail] Email sent to ${to}: "${subject}"`);
    return true;
  } catch (error: any) {
    console.error("[Gmail] Send error:", error.message);
    return false;
  }
}
