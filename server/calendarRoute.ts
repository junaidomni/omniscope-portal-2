import { Router } from "express";
import { getDb } from "./db";
import { calendarEvents } from "../drizzle/schema";
import { and, gte, lte, asc, like, sql, eq } from "drizzle-orm";
import { execSync } from "child_process";

export const calendarRouter = Router();

// ============================================================================
// GOOGLE CALENDAR MCP HELPER
// ============================================================================

function callGoogleCalendarMCP(toolName: string, input: Record<string, any>): any {
  try {
    const inputJson = JSON.stringify(input);
    const result = execSync(
      `manus-mcp-cli tool call ${toolName} --server google-calendar --input '${inputJson.replace(/'/g, "'\\''")}'`,
      { timeout: 30000, encoding: "utf-8" }
    );

    // Parse the result file path from stdout
    const filePathMatch = result.match(/\/tmp\/manus-mcp\/mcp_result_[a-f0-9]+\.json/);
    if (filePathMatch) {
      const fs = require("fs");
      const fileContent = fs.readFileSync(filePathMatch[0], "utf-8");
      return JSON.parse(fileContent);
    }

    return null;
  } catch (error: any) {
    console.error(`[Calendar MCP] Error calling ${toolName}:`, error.message);
    return null;
  }
}

// ============================================================================
// GET /api/calendar/events - Fetch events from database
// ============================================================================

calendarRouter.get("/calendar/events", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { timeMin, timeMax, maxResults = "100", q } = req.query;
    
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

// ============================================================================
// POST /api/calendar/events - Create event in Google Calendar + store locally
// ============================================================================

calendarRouter.post("/calendar/events", async (req, res) => {
  try {
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

    // Format times as RFC3339 with timezone offset
    const tz = timezone || "America/New_York";
    const startRFC = formatRFC3339(start, tz);
    const endRFC = formatRFC3339(end, tz);

    // Build Google Calendar event payload
    const gcalEvent: any = {
      summary: summary.trim(),
      start_time: startRFC,
      end_time: endRFC,
    };

    if (description?.trim()) {
      gcalEvent.description = description.trim();
    }
    if (location?.trim()) {
      gcalEvent.location = location.trim();
    }
    if (attendees && attendees.length > 0) {
      gcalEvent.attendees = attendees;
    }

    console.log(`[Calendar] Creating Google Calendar event: "${summary}" with ${attendees?.length || 0} attendees`);

    // Create event via Google Calendar MCP
    const mcpResult = callGoogleCalendarMCP("google_calendar_create_events", {
      events: [gcalEvent],
    });

    let googleEventId: string;
    let hangoutLink: string | null = null;
    let htmlLink: string | null = null;

    if (mcpResult?.success && mcpResult.result?.[0]?.event) {
      const gcEvent = mcpResult.result[0].event;
      googleEventId = gcEvent.id;
      hangoutLink = gcEvent.hangoutLink || null;
      htmlLink = gcEvent.htmlLink || null;

      console.log(`[Calendar] Google Calendar event created: ${googleEventId}`);
      if (attendees?.length > 0) {
        console.log(`[Calendar] Email invitations sent to: ${attendees.join(", ")}`);
      }
      if (hangoutLink) {
        console.log(`[Calendar] Google Meet link: ${hangoutLink}`);
      }
    } else {
      // Fallback: store locally if MCP fails
      googleEventId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      hangoutLink = addGoogleMeet ? "https://meet.google.com/new" : null;
      console.warn("[Calendar] MCP call failed, storing event locally only");
    }

    // Store in local database for portal display
    await db.insert(calendarEvents).values({
      googleEventId,
      summary: summary.trim(),
      description: description?.trim() || null,
      startTime: start,
      endTime: end,
      isAllDay: false,
      location: location?.trim() || null,
      attendees: JSON.stringify(attendees || []),
      hangoutLink,
      htmlLink,
      calendarId: "primary",
      syncedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      syncedToGoogle: !googleEventId.startsWith("local-"),
      event: {
        id: googleEventId,
        summary: summary.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
        location: location?.trim() || null,
        attendees: attendees || [],
        hangoutLink,
        htmlLink,
        source: googleEventId.startsWith("local-") ? "local" : "google",
      },
    });
  } catch (error) {
    console.error("[Calendar] Error creating event:", error);
    return res.status(500).json({ error: "Failed to create event" });
  }
});

// ============================================================================
// DELETE /api/calendar/events/:eventId - Delete event from Google Calendar + DB
// ============================================================================

calendarRouter.delete("/calendar/events/:eventId", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { eventId } = req.params;

    // If it's a real Google Calendar event, delete from Google too
    if (!eventId.startsWith("local-")) {
      console.log(`[Calendar] Deleting Google Calendar event: ${eventId}`);
      const mcpResult = callGoogleCalendarMCP("google_calendar_delete_events", {
        events: [{ event_id: eventId }],
      });
      if (mcpResult?.success) {
        console.log(`[Calendar] Google Calendar event deleted: ${eventId}`);
      } else {
        console.warn(`[Calendar] Failed to delete from Google Calendar: ${eventId}`);
      }
    }
    
    // Delete from local DB
    await db.delete(calendarEvents).where(eq(calendarEvents.googleEventId, eventId));
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Calendar] Error deleting event:", error);
    return res.status(500).json({ error: "Failed to delete event" });
  }
});

// ============================================================================
// POST /api/calendar/sync - Sync events from Google Calendar to local DB
// ============================================================================

calendarRouter.post("/calendar/sync", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);

    console.log("[Calendar] Starting Google Calendar sync...");

    const mcpResult = callGoogleCalendarMCP("google_calendar_search_events", {
      time_min: threeMonthsAgo.toISOString(),
      time_max: threeMonthsAhead.toISOString(),
      max_results: 250,
    });

    if (!mcpResult?.success) {
      return res.status(500).json({ error: "Failed to fetch events from Google Calendar" });
    }

    const gcalEvents = mcpResult.result || [];
    let synced = 0;
    let updated = 0;

    for (const item of gcalEvents) {
      const event = item.event || item;
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
        .map((a: any) => a.email)
        .filter(Boolean);

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

      // Upsert: try insert, on duplicate update
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
        // Skip duplicates
        console.warn(`[Calendar] Skipping event ${event.id}: ${(err as Error).message}`);
      }
    }

    console.log(`[Calendar] Sync complete: ${synced} new, ${updated} updated, ${gcalEvents.length} total from Google`);

    return res.status(200).json({
      success: true,
      synced,
      updated,
      total: gcalEvents.length,
    });
  } catch (error) {
    console.error("[Calendar] Error syncing events:", error);
    return res.status(500).json({ error: "Failed to sync calendar" });
  }
});

// ============================================================================
// GET /api/calendar/sync-status - Check when calendar was last synced
// ============================================================================

calendarRouter.get("/calendar/sync-status", async (_req, res) => {
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

// ============================================================================
// HELPERS
// ============================================================================

function formatRFC3339(date: Date, timezone: string): string {
  // Format date as RFC3339 with timezone offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  // Extract offset from timeZoneName (e.g., "GMT-05:00")
  const tzName = get("timeZoneName");
  const offsetMatch = tzName.match(/GMT([+-]\d{2}:\d{2})/);
  const offset = offsetMatch ? offsetMatch[1] : "-05:00";

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}
