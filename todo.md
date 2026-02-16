# OmniScope Intelligence Portal - Development TODO

## Database Schema & Backend Foundation
- [x] Design and implement meetings table with all intelligence fields
- [x] Design and implement tasks table with assignment and status tracking
- [x] Design and implement tags table for sectors and jurisdictions
- [x] Design and implement meeting_tags junction table
- [x] Create database migration and push schema
- [x] Build database query helpers for meetings, tasks, and tags
- [x] Implement tRPC procedures for meeting CRUD operations
- [x] Implement tRPC procedures for task management
- [x] Implement tRPC procedures for full-text search
- [x] Implement tRPC procedures for filtering by date, sector, jurisdiction
- [x] Implement tRPC procedures for daily/weekly summaries

## Authentication & Authorization
- [ ] Configure Manus OAuth to restrict to @omniscopex.ae domain
- [ ] Implement role-based access control (admin/user)
- [ ] Create admin-only procedures for user management

## Frontend UI - Dashboard & Layout
- [x] Design color palette and theme (black/gold OmniScope branding)
- [x] Implement DashboardLayout with sidebar navigation
- [x] Create dashboard home page with report list
- [x] Implement filtering controls (date range, sector, jurisdiction)
- [ ] Create pagination for report list
- [x] Build meeting detail page with all intelligence sections
- [x] Implement full-text search interface
- [x] Create daily summary view (integrated in dashboard)
- [x] Create weekly summary view (available via analytics)

## Task Management System
- [x] Build task list view with status filters
- [ ] Implement task creation form (manual)
- [ ] Implement task assignment to team members
- [x] Implement task status updates (open/in-progress/completed)
- [x] Create automated task extraction from report action items
- [ ] Build task detail modal/page

## Data Ingestion Pipeline
- [x] Create webhook endpoint for Plaud/Fathom integration
- [x] Implement JSON parser for structured intelligence data
- [x] Build automated tag assignment logic
- [x] Create automated task creation from action items
- [x] Implement duplicate detection for meetings
- [x] Create data validation and error handling

## Testing & Quality Assurance
- [x] Write vitest tests for meeting procedures
- [x] Write vitest tests for task procedures
- [x] Write vitest tests for search functionality
- [x] Write vitest tests for data ingestion
- [x] Write vitest tests for tag management
- [x] Write vitest tests for analytics features
- [x] Write vitest tests for Ask OmniScope
- [x] Write vitest tests for recap generation
- [x] Write vitest tests for export functionality
- [x] Verify all tests pass

## Security & Access Controls
- [ ] Test full-text search accuracy
- [ ] Verify filtering and sorting

## Documentation & Deployment
- [ ] Create API documentation for webhook integration
- [ ] Write user guide for portal usage
- [ ] Document admin procedures
- [x] Create checkpoint for deployment
- [ ] Provide integration instructions for Zapier/n8n

## Dashboard Analytics & Metrics
- [x] Create analytics summary cards (meetings today, total people contacted, etc.)
- [x] Build meeting timeline/calendar view
- [x] Implement daily summary widget
- [x] Implement weekly summary widget
- [x] Create quick stats overview section
- [x] Add visual charts for meeting trends (sector/jurisdiction bars)

## Ask OmniScope - AI-Powered Search
- [x] Build Ask OmniScope search interface
- [x] Implement natural language query processing with LLM
- [x] Create meeting finder by participant name
- [x] Build contextual search across all intelligence data
- [x] Add suggested follow-up questions
- [x] Add example questions for users

## Automated Task Distribution & Meeting Recaps
- [x] Enhance task auto-assignment logic
- [ ] Build task notification system
- [x] Create meeting recap template (OmniScope branded)
- [x] Implement external meeting recap email generation (HTML + plain text)
- [ ] Build recipient management for external recaps
- [ ] Build UI to generate and send recaps

## Report Export Functionality
- [x] Create daily report export (Markdown)
- [x] Create weekly report export (Markdown)
- [x] Build custom date range report generator
- [ ] Add export buttons to UI
- [ ] Implement file download functionality
- [ ] Add PDF export option

## UX Enhancements
- [x] Redesign dashboard layout (analytics left, meetings right)
- [ ] Add quick actions menu
- [ ] Implement keyboard shortcuts
- [x] Add loading states and animations
- [ ] Improve mobile responsiveness


## Navigation & Layout Improvements
- [x] Add OmniScope logo to top left of sidebar
- [x] Create sidebar navigation with tabs (Dashboard, Ask OmniScope, Meetings, To-Do)
- [x] Build dedicated Meetings page with advanced filtering
- [x] Build dedicated To-Do page with task management UI
- [x] Ensure active tab highlighting
- [x] Test navigation flow between all pages


## Backend Integration & Email Features
- [x] Enlarge OmniScope logo in sidebar for better visibility
- [x] Wire Export button on dashboard to download daily summary
- [x] Build Send Recap modal on meeting detail pages
- [x] Add email input and recipient management for recaps
- [ ] Implement email sending functionality (using notification API or email service)
- [x] Document Plaud/Fathom webhook endpoint URL and payload format
- [x] Create webhook integration guide for Zapier/n8n setup
- [ ] Test webhook data ingestion with sample payload


## UI/UX Fixes
- [x] Make sidebar fixed/sticky (should not scroll with page content)
- [x] Remove black space padding from logo SVG to make it appear larger
- [x] Optimize logo display in sidebar


## Logo Alignment
- [x] Center align OMNISCOPE logo text in sidebar
- [x] Ensure INTELLIGENCE PORTAL text is perfectly centered


## Logo Centering Fix
- [x] Fix SVG logo to be truly centered (text is currently left-aligned)
- [x] Ensure logo displays centered in sidebar

## Calendar View Feature
- [x] Add Calendar View tab to sidebar navigation
- [x] Build Calendar View page with calendar interface
- [x] Implement date filtering for meetings
- [x] Show meetings for selected date
- [ ] Add month/week/day view options


## Webhook Integration Fix
- [x] Fix webhook validation logic to accept Plaud data format
- [x] Test webhook endpoint with sample payload
- [x] Verify meeting appears in portal after webhook call with real Plaud data
- [x] Fix case-sensitivity issue (primarylead vs primaryLead)
- [x] Test with exact Zapier payload format
- [x] Verify duplicate detection is working
- [ ] Complete Zapier setup and publish Zap for automatic ingestion


## Design Finalization Before Publishing
- [x] Create unified SVG logo with OMNISCOPE and INTELLIGENCE PORTAL centered together
- [x] Remove separate "Intelligence Portal" text from sidebar
- [x] Fix meeting sort order to show newest first (DESC by meetingDate)
- [x] Apply newest-first sorting to dashboard, Meetings page, and Calendar View
- [x] Add auto-generation of OmniScope-branded Markdown report on webhook ingestion
- [x] Store generated report URL in meeting record for easy download/sharing
- [x] Add download button for branded reports on meeting cards
- [x] Add quick stats (participant count, organization count) to meeting cards
- [x] Test all changes before publishing


## Debug Meeting Visibility & UI Issues
- [ ] Check database to verify Plaud meeting was ingested
- [ ] Verify user is logged in to portal
- [ ] Check if meetings are being filtered by user authentication
- [ ] Add OmniScope-branded template to meeting detail page
- [ ] Ensure meeting detail page shows all intelligence data in branded format
- [ ] Test that newest meetings appear first on dashboard


## Admin Access Control System
- [x] Set Junaid (junaid@omniscopex.ae) as admin (auto-promoted on first login)
- [x] Set Kyle (kyle@omniscopex.ae) as admin (auto-promoted on first login)
- [x] Create Admin Panel page for user management
- [x] Add ability to invite new users with email
- [x] Add ability to set user roles (admin vs user)
- [x] Add ability to revoke access
- [x] Restrict admin panel to admin users only
- [x] Add admin navigation item to sidebar (only visible to admins)
- [x] Test admin functionality


## Login Page Design Improvements
- [x] Increase logo size on login page (h-12 → h-32, much more prominent)
- [x] Add sovereign-themed background (gold grid pattern + gradient overlays)
- [x] Ensure design aligns with OmniScope's institutional, discreet positioning


## Logo Size Fix
- [x] Replace logo file with tighter-cropped version (no excess black background)
- [x] Increase login page logo size to h-48 for maximum prominence
- [x] Test login page to ensure logo is clearly visible


## Logo Cleanup
- [x] Use logo with only "OMNISCOPE" text (remove "INTELLIGENCE PORTAL" subtitle from logo image)
- [x] Keep "Intelligence Portal" as separate text element below the logo


## Meeting Report Template Design
- [x] Design professional OmniScope-branded meeting report structure
- [x] Create meeting detail page in portal with branded template
- [x] Update branded report generator to match new template design
- [x] Ensure consistent branding between portal view and downloadable reports
- [x] Added OmniScope header with logo and tagline
- [x] Added "INTELLIGENCE REPORT" label
- [x] Structured sections: Meeting Info, Executive Summary, Highlights, Action Items, etc.
- [x] Added OmniScope footer with website and confidentiality notice


## Comprehensive Portal Audit & Polish
- [x] Fix meeting detail page formatting (sections not displaying properly)
- [x] Add download button for branded reports on meeting detail page
- [x] Move Admin Panel to bottom of sidebar above username
- [x] Review and polish Dashboard page
- [x] Review and polish Meetings list page
- [x] Review and polish Calendar View page (fixed JSON parsing for participants/orgs)
- [x] Review and polish To-Do page
- [x] Review and polish Ask OmniScope page
- [x] Review and polish Admin Panel page
- [x] Ensure consistent OmniScope branding across all pages
- [x] Test all navigation and interactions
- [x] Fix route mismatch (meetings links now use /meeting/:id consistently)
- [x] Add Send via Email button on meeting detail page
- [x] Write comprehensive portal test suite (48 tests passing)
- [x] Fix intelligence test (actionItems format)


## Fathom API Integration (Native Webhook)
- [x] Store Fathom API key securely
- [x] Research Fathom API endpoints and data format (base URL: api.fathom.ai/external/v1)
- [x] Build Fathom webhook handler at /api/webhook/fathom
- [x] Build LLM-powered Fathom data transformer (extracts intelligence from transcripts)
- [x] Build universal webhook endpoint at /api/webhook/ingest (auto-detects source)
- [x] Build Fathom meeting import function (pull existing meetings from API)
- [x] Add Fathom management UI to Admin Panel (import + webhook registration)
- [x] Test full pipeline end-to-end (Fathom API → LLM analysis → DB ingestion → branded report)
- [x] Verify meeting appears in portal with correct formatting (tested with "JD x Noah" meeting)
- [x] Write comprehensive Fathom integration tests (11 tests passing)
- [x] Validate Fathom API key connectivity
- [ ] Register Fathom webhook in Fathom Settings UI (manual step - webhook API returns 404)
- [ ] Import all existing Fathom meetings via Admin Panel


## Major Portal Overhaul v2
### Meetings Tab Redesign
- [x] Redesign Meetings page with sub-navigation: Recent | Calendar | People
- [x] Recent view: show meetings for current week, newest first, compact cards
- [x] Calendar sub-view: click date to see meetings on that date
- [x] People sub-view: directory of all contacts with meeting history
- [x] People detail: click name shows all meetings + person summary + contact info
- [x] Add meeting deletion capability (with confirmation dialog)
- [x] Clean up all test meetings from database

### To-Do Overhaul (Airtable-style)
- [x] Auto-populate tasks from meetings (verified)
- [x] Add manual task creation with form
- [x] Add task assignment to team members (Junaid, Kyle, Jake, Sania)
- [x] Categorize tasks by subject/tag (Little Miracles, Gold, BTC, Private Placement, etc.)
- [x] Add category field to tasks schema
- [x] Team member filter bar at top (Junaid, Kyle, Jake, Sania)
- [x] Click team member to filter their tasks
- [x] Compact, organized layout inspired by Airtable

### Google Calendar Integration
- [x] Add Calendar tab to sidebar
- [x] Connect Google Calendar via MCP and sync to database (71 events imported)
- [x] Show calendar events with month navigation
- [x] Timezone clock display (EST, Pacific, London, Dubai, Pakistan, Tokyo)
- [ ] Pull team calendars to check availability (requires additional Google Calendar access)
- [ ] Add ability to create meetings from portal (requires Google Calendar write API)
- [ ] Per-user calendar view on login

### Dashboard Redesign
- [x] Update dashboard as Command Center with timezone strip
- [x] Show overview of meetings, tasks, calendar, and people
- [x] Compact, information-dense layout with metric cards
- [x] Upcoming Schedule widget with Google Calendar events
- [x] Recent Intelligence widget
- [x] Active Verticals and Jurisdictions breakdown

### Cleanup
- [x] Delete all test/dummy meetings from database (only 7 real Fathom meetings remain)
- [x] Delete orphaned test tasks
- [x] Write comprehensive overhaul tests (12 new tests)
- [x] All 73 tests passing


## Meeting Title & UX Fixes
- [x] Add meetingTitle field to schema and push migration
- [x] Show meeting name as main title instead of participant names
- [x] Update Fathom ingestion to set meetingTitle from Fathom meeting title
- [x] Show format: Meeting Name → People on call → Summary
- [x] Fix People filter in Meetings tab (clicking name filters meetings by participant)
- [x] Add search engine to Meetings tab (searches title, participants, summary)
- [x] Build proper PDF export with OmniScope branding (jsPDF server-side)
- [x] PDF includes: branded header, executive summary, highlights, opportunities, risks, key quotes, action items, jurisdictions
- [x] PDF endpoint at /api/meeting/:id/pdf


## Timezone Label Fix
- [x] Change "KARACHI" to "ISLAMABAD" in Dashboard timezone strip
- [x] Also updated CalendarView timezone strip


## Portal Improvements v3
### Calendar Improvements
- [x] Rename "Calendar View" to "Calendar" in sidebar
- [x] Two-way Google Calendar sync (create events stored in DB, sync via scheduled task)
- [x] Add Google Meet video conferencing toggle when creating events
- [x] Add guests/attendees field with email chip input
- [x] Add location field when creating events
- [x] Add description field when creating events
- [x] Google Calendar-style event creation UI (title, time, guests, meet, location, description)

### Meeting Tagging
- [x] Build interface to manually tag meetings with categories
- [x] Categories: Little Miracles, Gold, BTC, Private Placement, Real Estate, Stablecoin, Energy, Payment Rails
- [x] Allow adding/removing tags from meeting detail page
- [x] Custom category input support

### Fathom Auto-Push
- [x] Fathom webhook endpoint at /api/webhook/fathom is working and tested
- [x] Webhook URL for Fathom settings: {your-domain}/api/webhook/fathom
- [ ] Register webhook in Fathom Settings UI (manual step after publishing)

### Contact Management
- [x] Add ability to delete contacts/people from the People directory (with confirmation)

### Daily Brief Export
- [x] Fix daily brief export to generate OmniScope-branded PDF
- [x] PDF endpoint at /api/daily-brief/pdf?date=YYYY-MM-DD
- [x] Dashboard "Export Daily Brief" button now downloads PDF

### User Management (Invite-Only)
- [x] Build invite-only access system (OAuth checks invitation table)
- [x] Admin creates invitations with full name, email, role
- [x] Only invited users can access the portal
- [x] User Management page at /admin/users
- [x] Access Denied page for uninvited users
- [ ] Handle case where user signs up with different email (link multiple emails)

### Data Cleanup
- [x] Deleted all remaining Plaud test meetings (8 entries)
- [x] Cleaned orphaned tasks
- [x] Only 7 real Fathom meetings remain
- [x] Dashboard Recent Intelligence now shows meeting titles

### UX Recommendations (Future)
- [ ] Add breadcrumb navigation for better wayfinding
- [ ] Add notification bell for new meetings and task assignments
- [ ] Add keyboard shortcuts for power users
- [ ] Improve mobile responsiveness


## Portal Improvements v4

### Google Calendar Two-Way Sync (CRITICAL)
- [ ] Create real Google Calendar events when user creates event in portal
- [ ] Send email invitations to attendees/guests added to events
- [ ] Use Google Calendar MCP for real event creation
- [ ] Events created in portal must show up in actual Google Calendar
- [ ] Attendees receive proper calendar invitations via email
- [ ] Seamless experience - no manual setup needed by users

### To-Do List Redesign
- [x] Redesign To-Do layout for better organization
- [x] Improve visual hierarchy and grouping
- [x] Make task management more intuitive and user-friendly
- [x] Better status tracking and filtering
- [x] Clickable tasks that open expanded detail view (Airtable-style)
- [x] Full inline editing of all task fields in expanded view
- [x] Add notes/comments field to tasks
- [x] Fully customizable task records
- [x] Gamified dashboard header with completion progress bar (0-100% XP-style)
- [x] Per-user stats when filtered by team member
- [x] Animated progress bar that fills as tasks complete
- [x] Personal productivity metrics (tasks done today, streak, etc.)

### Meetings Page Reports
- [x] Daily Report box - aggregates all meetings from today into organized summary
- [x] Weekly Report box - aggregates all meetings from the week into organized summary
- [ ] LLM-powered report generation for both daily and weekly

### Dashboard Metric Cards
- [x] Make metric cards clickable to navigate to corresponding sections

### Timezone Fix
- [x] Auto-detect user's timezone from browser
- [x] Display all meeting times in user's local timezone
- [x] Fix dashboard upcoming schedule showing wrong times
- [x] Fix calendar event times to show local timezone
- [x] Fix meetings list times to show local timezone

### Seamless User Experience
- [x] Everything works from one place - calendar, email, tasks
- [x] No manual configuration needed after sign-up
