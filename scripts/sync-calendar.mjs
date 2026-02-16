#!/usr/bin/env node
/**
 * Google Calendar Sync Script
 * 
 * Pulls events from Google Calendar via MCP and stores them in the database.
 * Run this script periodically or on-demand to keep calendar data fresh.
 * 
 * Usage: node scripts/sync-calendar.mjs [--months=3]
 */

import { execSync } from "child_process";
import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function callCalendarMCP(toolName, input) {
  try {
    const result = execSync(
      `manus-mcp-cli tool call ${toolName} --server google-calendar --input '${JSON.stringify(input)}'`,
      { timeout: 60000, encoding: "utf-8" }
    );
    
    const filePathMatch = result.match(/saved to:\s*(.+\.json)/);
    if (filePathMatch) {
      return JSON.parse(fs.readFileSync(filePathMatch[1], "utf-8"));
    }
    return null;
  } catch (error) {
    console.error(`MCP call failed for ${toolName}:`, error.message);
    return null;
  }
}

async function syncCalendar(monthsBack = 2, monthsForward = 3) {
  console.log(`[Calendar Sync] Starting sync: ${monthsBack} months back, ${monthsForward} months forward`);
  
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(timeMin.getMonth() - monthsBack);
  timeMin.setDate(1);
  
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + monthsForward);
  timeMax.setDate(0); // Last day of that month
  timeMax.setHours(23, 59, 59);
  
  console.log(`[Calendar Sync] Range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
  
  // Fetch events from Google Calendar
  const data = callCalendarMCP("google_calendar_search_events", {
    time_min: timeMin.toISOString(),
    time_max: timeMax.toISOString(),
    max_results: 250,
  });
  
  if (!data || !data.result) {
    console.error("[Calendar Sync] No data returned from Google Calendar");
    return { synced: 0, errors: 0 };
  }
  
  const events = Array.isArray(data.result) ? data.result : [];
  console.log(`[Calendar Sync] Fetched ${events.length} events from Google Calendar`);
  
  // Connect to database
  const connection = await mysql.createConnection(DATABASE_URL);
  
  let synced = 0;
  let errors = 0;
  
  for (const event of events) {
    try {
      const googleEventId = event.id;
      const summary = event.summary || "Untitled";
      const description = event.description || null;
      const isAllDay = !event.start?.dateTime;
      const startTime = event.start?.dateTime || `${event.start?.date}T00:00:00Z`;
      const endTime = event.end?.dateTime || `${event.end?.date}T23:59:59Z`;
      const location = event.location || null;
      const attendees = event.attendees ? JSON.stringify(event.attendees.map(a => a.email)) : null;
      const hangoutLink = event.hangoutLink || null;
      const htmlLink = event.htmlLink || null;
      
      // Upsert the event
      await connection.execute(
        `INSERT INTO calendar_events (googleEventId, summary, description, startTime, endTime, isAllDay, location, attendees, hangoutLink, htmlLink, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           summary = VALUES(summary),
           description = VALUES(description),
           startTime = VALUES(startTime),
           endTime = VALUES(endTime),
           isAllDay = VALUES(isAllDay),
           location = VALUES(location),
           attendees = VALUES(attendees),
           hangoutLink = VALUES(hangoutLink),
           htmlLink = VALUES(htmlLink),
           syncedAt = NOW()`,
        [googleEventId, summary, description, startTime, endTime, isAllDay, location, attendees, hangoutLink, htmlLink]
      );
      
      synced++;
    } catch (err) {
      console.error(`[Calendar Sync] Error syncing event ${event.id}:`, err.message);
      errors++;
    }
  }
  
  await connection.end();
  console.log(`[Calendar Sync] Complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// Run
const args = process.argv.slice(2);
const monthsArg = args.find(a => a.startsWith("--months="));
const months = monthsArg ? parseInt(monthsArg.split("=")[1]) : 3;

syncCalendar(months, months).catch(console.error);
