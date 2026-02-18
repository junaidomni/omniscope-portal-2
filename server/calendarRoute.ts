/**
 * Calendar Route - Production-ready Google Calendar integration
 * Uses OAuth2 + Google Calendar REST API (not MCP)
 */
import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { calendarEvents } from "../drizzle/schema";
import { eq, and, gte, lte, asc, like, sql } from "drizzle-orm";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  isGoogleConnected,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  syncGoogleCalendarEvents,
  sendGmailEmail,
} from "./googleCalendar";

export const calendarRouter = Router();

// ============================================================================
// GOOGLE OAUTH2 FLOW
// ============================================================================

/**
 * Start Google OAuth2 authorization
 * GET /api/google/auth?origin=https://...
 */
calendarRouter.get("/google/auth", (req: Request, res: Response) => {
  const origin = (req.query.origin as string) || "";
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!origin) {
    return res.status(400).json({ error: "Origin is required" });
  }

  const authUrl = getGoogleAuthUrl(origin, userId);
  res.json({ authUrl });
});

/**
 * Google OAuth2 callback
 * GET /api/google/callback?code=...&state=...
 */
calendarRouter.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  const result = await handleGoogleCallback(code, state);

  if (result.success) {
    const returnPath = result.returnPath || "/integrations";
    res.redirect(`${result.origin}${returnPath}?google=connected`);
  } else {
    const returnPath = result.returnPath || "/integrations";
    res.redirect(`${result.origin}${returnPath}?google=error&message=${encodeURIComponent(result.error || "Unknown error")}`);
  }
});

/**
 * Check Google connection status
 * GET /api/google/status
 */
calendarRouter.get("/google/status", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const status = await isGoogleConnected(userId);
  res.json(status);
});

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

/**
 * Get calendar events from local cache
 * GET /api/calendar/events?timeMin=...&timeMax=...&maxResults=...
 */
calendarRouter.get("/calendar/events", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { timeMin, timeMax, maxResults = "250", q } = req.query;

    const conditions: any[] = [];
    if (timeMin) conditions.push(gte(calendarEvents.startTime, new Date(timeMin as string)));
    if (timeMax) conditions.push(lte(calendarEvents.startTime, new Date(timeMax as string)));
    if (q) conditions.push(like(calendarEvents.summary, `%${q}%`));

    const events = await db
      .select()
      .from(calendarEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(calendarEvents.startTime))
      .limit(parseInt(maxResults as string));

    const formatted = events.map((e: typeof calendarEvents.$inferSelect) => ({
      id: e.googleEventId,
      dbId: e.id,
      summary: e.summary,
      description: e.description,
      start: e.startTime.toISOString(),
      end: e.endTime.toISOString(),
      isAllDay: e.isAllDay,
      location: e.location,
      attendees: (() => { try { return JSON.parse(e.attendees || "[]"); } catch { return []; } })(),
      hangoutLink: e.hangoutLink,
      htmlLink: e.htmlLink,
      source: e.googleEventId.startsWith("local-") ? "local" : "google",
    }));

    return res.status(200).json({ events: formatted });
  } catch (error) {
    console.error("[Calendar] Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

/**
 * Create a calendar event (syncs to Google Calendar via API)
 * POST /api/calendar/events
 */
calendarRouter.post("/calendar/events", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { summary, description, startTime, endTime, location, attendees, addGoogleMeet, timezone } = req.body;

    if (!summary || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields: summary, startTime, endTime" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    console.log(`[Calendar] Creating event: "${summary}" with ${attendees?.length || 0} attendees`);

    // Create event via Google Calendar API
    const googleResult = await createGoogleCalendarEvent(userId, {
      summary: summary.trim(),
      description: description?.trim(),
      startTime: start,
      endTime: end,
      location: location?.trim(),
      attendees: attendees || [],
      addGoogleMeet: addGoogleMeet || false,
      timezone: timezone || "America/New_York",
    });

    const googleEventId = googleResult.googleEventId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (googleResult.success) {
      console.log(`[Calendar] Google Calendar event created: ${googleEventId}`);
      if (attendees?.length > 0) {
        console.log(`[Calendar] Email invitations sent to: ${attendees.join(", ")}`);
      }
    } else {
      console.warn(`[Calendar] Google sync failed: ${googleResult.error}. Storing locally.`);
    }

    // Store in local database
    await db.insert(calendarEvents).values({
      googleEventId,
      summary: summary.trim(),
      description: description?.trim() || null,
      startTime: start,
      endTime: end,
      isAllDay: false,
      location: location?.trim() || null,
      attendees: JSON.stringify(attendees || []),
      hangoutLink: googleResult.hangoutLink || null,
      htmlLink: googleResult.htmlLink || null,
      calendarId: "primary",
      syncedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      syncedToGoogle: googleResult.success,
      googleError: googleResult.error || null,
      event: {
        id: googleEventId,
        summary: summary.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
        location: location?.trim() || null,
        attendees: attendees || [],
        hangoutLink: googleResult.hangoutLink || null,
        htmlLink: googleResult.htmlLink || null,
        source: googleResult.success ? "google" : "local",
      },
    });
  } catch (error) {
    console.error("[Calendar] Error creating event:", error);
    return res.status(500).json({ error: "Failed to create event" });
  }
});

/**
 * Delete a calendar event
 * DELETE /api/calendar/events/:eventId
 */
calendarRouter.delete("/calendar/events/:eventId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { eventId } = req.params;

    // Delete from Google Calendar if it's a real Google event
    if (!eventId.startsWith("local-")) {
      console.log(`[Calendar] Deleting Google Calendar event: ${eventId}`);
      await deleteGoogleCalendarEvent(userId, eventId);
    }

    // Delete from local DB
    await db.delete(calendarEvents).where(eq(calendarEvents.googleEventId, eventId));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Calendar] Error deleting event:", error);
    return res.status(500).json({ error: "Failed to delete event" });
  }
});

/**
 * Sync events from Google Calendar to local DB
 * POST /api/calendar/sync
 */
calendarRouter.post("/calendar/sync", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const result = await syncGoogleCalendarEvents(userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Calendar] Error syncing events:", error);
    return res.status(500).json({ error: "Failed to sync calendar" });
  }
});

/**
 * Send an email via Gmail API
 * POST /api/gmail/send
 */
calendarRouter.post("/gmail/send", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { to, subject, htmlBody } = req.body;
    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ error: "Missing required fields: to, subject, htmlBody" });
    }

    const success = await sendGmailEmail(userId, to, subject, htmlBody);
    res.json({ success });
  } catch (error: any) {
    console.error("[Gmail] Send error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check sync status
 * GET /api/calendar/sync-status
 */
calendarRouter.get("/calendar/sync-status", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
        lastSync: sql<Date>`MAX(syncedAt)`,
      })
      .from(calendarEvents);

    return res.status(200).json({
      eventCount: result[0]?.count || 0,
      lastSyncedAt: result[0]?.lastSync || null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check sync status" });
  }
});
