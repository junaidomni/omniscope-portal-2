import { Router } from "express";
import { getDb } from "./db";
import { calendarEvents } from "../drizzle/schema";
import { and, gte, lte, asc, like, sql } from "drizzle-orm";

export const calendarRouter = Router();

/**
 * GET /api/calendar/events - Fetch events from database (synced from Google Calendar)
 */
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
    
    // Transform to frontend format
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
    }));
    
    return res.status(200).json({ events: formatted });
  } catch (error) {
    console.error("[Calendar] Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

/**
 * GET /api/calendar/sync-status - Check when calendar was last synced
 */
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
