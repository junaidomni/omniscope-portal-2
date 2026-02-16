#!/usr/bin/env python3
"""
Import Google Calendar events from MCP JSON result into the database.
Usage: python3 scripts/import-calendar.py /path/to/mcp_result.json
"""

import json
import sys
import os
import mysql.connector
from datetime import datetime
from urllib.parse import urlparse

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import-calendar.py <mcp_result.json>")
        sys.exit(1)
    
    json_path = sys.argv[1]
    
    # Read the MCP result
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    events = data.get('result', [])
    if not isinstance(events, list):
        print(f"Expected array of events, got {type(events)}")
        sys.exit(1)
    
    print(f"[Calendar Import] Found {len(events)} events to import")
    
    # Parse DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        # Try reading from .env
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
    
    if not db_url:
        print("DATABASE_URL not found")
        sys.exit(1)
    
    # Parse MySQL URL
    parsed = urlparse(db_url)
    db_config = {
        'host': parsed.hostname,
        'port': parsed.port or 3306,
        'user': parsed.username,
        'password': parsed.password,
        'database': parsed.path.lstrip('/'),
    }
    
    # Add SSL if needed
    if 'ssl-mode' in db_url or parsed.hostname and 'tidb' in parsed.hostname:
        db_config['ssl_disabled'] = False
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    
    synced = 0
    errors = 0
    
    for event in events:
        try:
            google_event_id = event.get('id', '')
            summary = (event.get('summary', 'Untitled') or 'Untitled')[:500]
            description = event.get('description')
            
            start = event.get('start', {})
            end = event.get('end', {})
            is_all_day = 'dateTime' not in start
            
            start_time = start.get('dateTime') or f"{start.get('date', '2026-01-01')}T00:00:00+00:00"
            end_time = end.get('dateTime') or f"{end.get('date', '2026-01-01')}T23:59:59+00:00"
            
            # Parse to datetime
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            location = (event.get('location') or '')[:500] or None
            attendees = json.dumps([a.get('email', '') for a in event.get('attendees', []) if a.get('email')])
            hangout_link = (event.get('hangoutLink') or '')[:500] or None
            html_link = (event.get('htmlLink') or '')[:500] or None
            
            cursor.execute("""
                INSERT INTO calendar_events 
                    (googleEventId, summary, description, startTime, endTime, isAllDay, location, attendees, hangoutLink, htmlLink, syncedAt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
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
                    syncedAt = NOW()
            """, (google_event_id, summary, description, start_dt, end_dt, is_all_day, location, attendees, hangout_link, html_link))
            
            synced += 1
        except Exception as e:
            print(f"[Calendar Import] Error importing event {event.get('id', 'unknown')}: {e}")
            errors += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"[Calendar Import] Complete: {synced} synced, {errors} errors")

if __name__ == '__main__':
    main()
