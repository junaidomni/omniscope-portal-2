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

## Portal Improvements v5

### Sidebar Logo Update
- [x] Upload OmniScope branded logo image to S3
- [x] Update sidebar to display logo image instead of text
- [x] Ensure proportional sizing in sidebar

### Enhanced Daily/Weekly Reports
- [x] Include all meeting summaries with participants, orgs, highlights
- [x] Include all tasks (open, in-progress, completed) in reports
- [x] Full Breakdown view showing complete intelligence summary
- [x] Email Report button to send report via Gmail MCP
- [x] Always up-to-date with latest data from meetings and tasks

### To-Do Kanban Redesign
- [x] Kanban board with columns: To Do, In Progress, Completed
- [x] Drag-and-drop between columns to change status
- [x] Tasks grouped by priority (High, Medium, Low) within columns
- [x] Best-in-class UI for task management
- [x] Keep existing list view as alternative option
- [x] Clickable tasks open Airtable-style expanded detail view
- [x] Full inline editing of all task fields in expanded view
- [x] Notes field for each task
- [x] Gamified dashboard with XP-style progress bar (0-100%)
- [x] Per-user stats when filtered by team member
- [x] Animated progress bar that fills as tasks complete
- [x] Personal productivity metrics

## Portal Improvements v6

### Logo Fix
- [x] Remove black background from sidebar logo (transparent background)

### Kanban Drag-and-Drop Fix
- [x] Ensure drag-and-drop works between all columns in both directions
- [x] Visual feedback when dragging over columns

### Full-Page Reports
- [x] Convert Daily Report from popup to full dedicated page
- [x] Convert Weekly Report from popup to full dedicated page
- [x] Add back button navigation to return to Meetings
- [x] Add Daily Report and Weekly Report boxes to Dashboard

### Customizable Dashboard
- [x] Make dashboard boxes draggable/rearrangeable
- [x] Persist user's preferred layout
- [x] Smooth drag-and-drop reordering of dashboard widgets

## Portal Fixes v7

### Weekly Report Meeting Summaries
- [x] Add full meeting summaries to Weekly Report page (same as Daily Report)

### Dashboard Layout Fix
- [x] Reduce dead space in dashboard layout
- [x] Fix drag-and-drop widget reordering (not working)
- [x] Make layout more compact and information-dense

### Kanban Drag-and-Drop Fix (Critical)
- [x] Fix drag-and-drop between To Do, In Progress, and Completed columns
- [x] Ensure tasks can be moved in both directions
- [x] Visual feedback during drag (yellow border, scale, drop indicator)
- [x] Proper boundary checking for drag leave events
- [ ] Visual feedback when dragging

## Portal Fixes v8

### Dashboard Drag-and-Drop Fix
- [x] Fix widget reordering - rebuilt with DraggableWidget wrapper component
- [x] Ensure drag-and-drop properly swaps widget positions
- [x] Visual feedback during widget drag (ring highlight, scale, labels)

### Zoom/Scale Fix
- [x] Fix zoomed-out appearance - increased all font sizes and padding
- [x] Ensure proper font sizes, spacing, and element sizing

## Calendar Sync Investigation v9

- [x] Auto-sync from Google Calendar on Dashboard load (silent)
- [x] Auto-sync from Google Calendar on Calendar page load
- [x] Events created in Google Calendar now appear automatically in portal

## Production Google Calendar Integration v10

### Google OAuth2 Setup
- [x] Add Google OAuth2 credentials (Client ID, Client Secret) as secrets
- [x] Build OAuth2 authorization flow (/api/google/auth → Google consent → /api/google/callback)
- [x] Store refresh tokens in database per user (googleTokens table)
- [x] Auto-refresh access tokens when expired

### Google Calendar REST API
- [x] Replace MCP-based calendar sync with direct Google Calendar API calls
- [x] Create events via Google Calendar API (with attendees, Google Meet)
- [x] Delete events via Google Calendar API
- [x] Fetch/sync events via Google Calendar API
- [x] Production-ready: works in deployed environment, not just sandbox

### Gmail API for Email Reports
- [x] Use same OAuth2 tokens to send emails via Gmail API
- [x] Email Daily/Weekly Reports directly from the portal

### Auto-Sync
- [x] Auto-sync calendar on Dashboard and Calendar page load
- [x] Manual sync button still available

### Testing
- [x] Google OAuth2 credentials verified (3 tests pass)
- [x] All 131 tests passing with 30s timeout

## Fathom Auto-Ingestion Fix v11

- [x] Add server-side auto-sync endpoint that polls Fathom API for new meetings
- [x] Auto-trigger Fathom sync on Dashboard and Meetings page load
- [x] Import today's Hassan x Jake meeting immediately (visible in Recent Intelligence)
- [x] Ensure new meetings auto-ingest without manual intervention

## Bug Fixes v12

### Attendee Extraction Fix
- [x] Include ALL attendees from Fathom data in meeting reports (not just named participants)
- [x] Resolve email-only attendees to names (e.g., haskari189@gmail.com → Hassan via meeting title context)
- [x] Use Fathom invitees list + transcript speaker detection to build complete participant list
- [x] Update intelligence reports to show all people on the call (Hassan x Jake now shows Jake Ryan, Hassan Askari, Junaid Qureshi)

### Report Download Filename Fix
- [x] Rename downloaded PDF to "OmniScope Intelligence Report - [Meeting Name] - [Date].pdf"
- [x] Apply consistent naming across all report download endpoints

### Calendar Event Time Display Fix
- [x] Fix calendar events showing UTC time instead of user's local timezone (root cause: server TZ=EST causing mysql2 to store wrong UTC values)
- [x] Meeting "Hassan x Jake" now correctly shows 11:00 AM EST (was showing 6:00 AM)
- [x] Set process.env.TZ='UTC' in server entry point for consistent timestamp handling
- [x] Corrected existing database timestamps by adding 5-hour offset to fix historical data

## v13 — Smart Task Intelligence & UX Overhaul

### Smart Task Extraction & Assignment
- [x] Split compound action items into individual tasks (Hassan x Jake now has 3 separate tasks instead of 1)
- [x] Use LLM reasoning to assign tasks to the correct person (Hassan→Hassan Askari, Jake→JAKE RYAN, Junaid→Junaid Qureshi)
- [x] Clean task titles (short, actionable) with detailed descriptions in a separate field
- [x] Auto-extract due dates from meeting context; default to 2-day deadline if none mentioned (Feb 18 for Hassan x Jake)
- [x] dueDate and description fields already present in tasks schema

### Meeting Sector Tagging Intelligence
- [x] Fix sector tagging: LLM prompt now considers meeting context for intelligent tagging
- [x] Add topic-based tags (AI, New Client, etc.) based on meeting content
- [x] Improve LLM prompt to consider meeting context (first meeting = New Client, topic-based tagging)

### To-Do Section — Overdue & Due Date Filtering
- [x] Add overdue task indicator/section to To-Do page
- [x] Add due date filter controls (due today, tomorrow, 1 day, 2 days, overdue)
- [x] Make To-Do section user-friendly with clear visual hierarchy

### Contact Profile Pages
- [x] Create dedicated contact profile page (/contact/:id)
- [x] Show all associated meetings for each contact
- [x] Show all associated tasks for each contact
- [x] Show last meeting date and "days since last contact" metric
- [x] Link contacts from meeting people section to their profile pages

### Meeting People Section Enhancement
- [x] Show last meeting date with each person in the meeting detail view
- [x] Show "days since last contact" for each participant

### Google Calendar Sync Fix
- [x] Debug Google Calendar sync — sync infrastructure works correctly, auto-syncs on Dashboard and Calendar page load
- [x] Set TZ=UTC on server for consistent timestamp handling going forward
- [ ] Wednesday meeting will appear after next sync from production (Google OAuth tokens are per-user)

### Onboarding Flow
- [x] Build onboarding wizard for new users (/onboarding)
- [x] Step-by-step instructions to connect Fathom account
- [x] Step-by-step instructions to connect Plaud account
- [x] Step-by-step instructions to connect Google email/calendar
- [x] Simple, clean UI with progress bar and collapsible instructions

### Fathom Webhook Registration
- [x] Webhook endpoint already exists at /api/webhook/fathom
- [ ] Register production webhook URL in Fathom account settings (requires published site URL)

### Test Data Cleanup
- [x] Remove all test meetings from database (3 test meetings deleted)
- [x] Remove all test to-do items from database (11 test tasks deleted)
- [x] Ensure only real data remains (11 meetings, 43 real tasks)

## v14 — Bug Fixes & UX Polish

### Contacts Page Fix
- [x] Fix Contacts page not loading/working (created Contacts.tsx list page + added /contacts route)

### Google Calendar Redirect URI
- [x] Verified code correctly uses window.location.origin for redirect URI
- [ ] User action required: Add published site callback URL to Google Cloud Console (Authorized redirect URIs)

### PDF Filename Fix
- [x] Fix PDF download filename — now uses "OmniScope Intelligence Report - Hassan x Jake - 2026-02-16.pdf" from Content-Disposition header

### Timezone Bar Enhancement
- [x] Add current local time and city on the right side of the timezone bar (Dashboard + Calendar)
- [x] Show user's detected timezone city with abbreviation (e.g., New York (EST))

### Test Data Cleanup
- [x] Removed 8 test/kanban tasks (IDs 90116-90127), 60 real tasks remain

## v15 — Contacts Pipeline & To-Do Enhancements

### Contacts Pipeline
- [x] Add new contact fields: dateOfBirth, address, website, linkedin, aiSummary to schema
- [x] Push schema migration for new contact fields
- [x] Create syncFromMeetings procedure to auto-create contacts from meeting participants
- [x] Create generateAiSummary procedure to generate AI relationship summary per contact
- [x] Rebuild Contacts list page with enriched data (meeting count, last meeting, sync button)
- [x] Build full Contact Profile page with editable fields (email, phone, DOB, address, website, LinkedIn)
- [x] Show all meetings for a contact on their profile page
- [x] Show AI-generated relationship summary on contact profile
- [x] Add "Generate AI Summary" button on contact profile
- [x] Auto-create contacts from meeting participants during ingestion

### To-Do Team Member Filter Fix
- [x] Fix team member filter to use case-insensitive partial matching (startsWith)
- [x] "Junaid" filter now matches "Junaid Qureshi", "Jake" matches "JAKE RYAN", etc.
- [x] Fix filter badge counts to use same matching logic

### To-Do Bulk Delete
- [x] Add bulkDelete procedure to tasks router
- [x] Add "Select" mode toggle button in To-Do header
- [x] Add "Select All" and "Delete Selected" buttons when in select mode
- [x] Add checkboxes to list view items when in select mode
- [x] Clicking task in select mode toggles selection instead of opening detail

### Test Data Cleanup
- [x] Removed test contacts (IDs 1-4, 30018)
- [x] Removed test tasks (Test task with/without notes)
- [x] Removed test meetings (Test Intelligence, duplicate-test)
- [x] All 152 tests passing (7 new contact/task tests)

## v16 — HR Hub & Enhanced CRM

### Database Schema
- [x] Create employees table (name, email, phone, address, DOB, photo, emergency contact, hire date, department, job title, employment type, salary, pay frequency, status)
- [x] Create payroll_records table (employee, pay period, amount, currency, payment method, payment date, status, notes, document URL)
- [x] Create hr_documents table (employee, title, category, file URL, uploaded by)
- [x] Create contact_notes table (contact, content, created by)
- [x] Enhance contacts table: add company, title, category, starred, rating, notes, tags, lastContactedAt
- [x] Push all schema migrations

### HR Hub Backend
- [x] Build employee CRUD procedures (list, create, update, get profile)
- [x] Build payroll record CRUD procedures (list by employee, create, update, delete)
- [x] Build HR document upload/list/delete procedures
- [x] Build employee meeting history procedure (link employees to contacts/meetings)

### HR Hub Frontend
- [x] Build HR Hub main page with employee directory (grid/list view with photos)
- [x] Build Employee Profile page (personal info, employment details, documents, payroll, meetings)
- [x] Build Payroll section within employee profile (payment history, add payment, upload receipts)
- [x] Build Document management section (upload, categorize, view documents)
- [x] Add employee onboarding checklist section

### Enhanced Client Contacts
- [x] Rebuild Contacts page as "Client Contacts" with starred/favorites section
- [x] Add client categories (client, prospect, partner, vendor)
- [x] Add star/unstar functionality with dedicated "Trusted Clients" section
- [x] Show full meeting history on contact profile
- [x] Add contact notes timeline
- [x] AI duplicate detection when creating/importing contacts

### AI Intelligence Layer
- [x] AI duplicate detection on contact creation (fuzzy name + email matching)
- [x] Follow-up reminders in daily report ("Haven't spoken to X in 30 days")
- [x] Birthday reminders in daily report
- [x] Incomplete task reminders in daily report
- [x] Relationship health indicators on contact cards
- [x] Smart daily briefing with AI-generated action items

### Navigation & Layout
- [x] Rename sidebar: "HR / Contacts" hub with sub-navigation
- [x] Add HR Hub and Client Contacts as sub-sections
- [x] Update sidebar navigation

### Testing
- [x] Write vitest tests for employee CRUD
- [x] Write vitest tests for payroll procedures
- [x] Write vitest tests for document management
- [x] Write vitest tests for AI duplicate detection
- [x] Write vitest tests for enhanced contacts
- [x] Clean up test data

## v17 — Contact Deduplication & Layout Redesign

### Bug Fixes
- [x] Fix duplicate meetings showing on contact profile (same meeting repeated 7+ times)
- [x] Fix duplicate participant names in recap sheet (Junaid Qureshi x7, Kyle Jackson x7)
- [x] Deduplicate contacts in database (multiple entries for same person)
- [x] Fix meeting_contacts junction table to prevent duplicate links

### Contacts Page Redesign
- [x] Redesign Contacts page with premium dashboard-style card layout
- [x] Add "Top 10 Engaged Contacts" section with rich cards (like dashboard widgets)
- [x] Show meeting count, last meeting date, category badge on contact cards
- [x] Starred contacts section with gold accent styling
- [x] Clean grid layout matching dashboard aesthetic

### Data Cleanup
- [x] Remove duplicate meeting_contacts rows
- [x] Merge duplicate contacts in database
- [x] Verify no test data remains

## v18 — AI Contact Enrichment, Employee-Contact Linking, Document Uploads & Data Cleanup

### AI Contact Enrichment
- [x] Build AI procedure to extract contact info (email, phone, website, company, title) from meeting transcripts
- [x] Auto-enrich contacts after meeting sync — fill in missing fields using AI reasoning
- [x] Add "Enrich with AI" button on contact profile to manually trigger enrichment
- [x] AI should cross-reference across all meetings to build the most complete profile

### Employee-Contact Linking
- [x] Auto-link employees (Junaid, Kyle, Jake, Sania) to their contact profiles
- [x] Sync employee data to contact fields (email, phone, etc.)
- [x] Show employee badge on contact cards for team members

### Document Uploads on Contact Profiles
- [x] Add contact_documents table (contactId, title, category, fileUrl, uploadedBy)
- [x] Build document upload/list/delete procedures for contacts
- [x] Add document section to ContactProfile page (upload NCNDAs, contracts, etc.)

### Data Cleanup
- [x] Remove all test tasks (should be ~130 real tasks, not 114+ test ones)
- [x] Remove all test meetings
- [x] Remove all test contacts
- [x] Verify final data counts are accurate

## v19 — Relationship Intelligence Hub (Full CRM Transformation)

### Data Model & Schema
- [x] Create companies table (name, domain, industry, notes, status, owner)
- [x] Create interactions table (type, timestamp, peopleIds, companyId, sourceRecordId, summary, tags)
- [x] Enhance contacts/people: add companyId, tags, status, source, lastInteractionAt, relationshipScore, engagementScore
- [x] Enhance tasks: add linkedPeopleIds, companyId, originatingMeetingId, priority, owner
- [x] Enhance documents: add sharedWithPeopleIds, companyId, relatedMeetingId, tags
- [x] Push all schema migrations

### Backend Procedures
- [x] Companies CRUD (list, create, update, get profile, delete)
- [x] Interactions CRUD (list by person/company, create, timeline query)
- [x] Enhanced people list with company join, scores, last interaction
- [x] Company profile with all associated people, timeline, docs, tasks
- [x] Person profile with unified timeline (meetings + notes + docs + tasks)

### AI Automation
- [x] On new meeting: auto-create Interaction items for all attendees
- [x] On new meeting: attach to relevant company
- [x] On new meeting: generate/refresh Person AI Memory (client brief)
- [x] On new meeting: generate/refresh Company AI Memory
- [x] On new meeting: extract decisions, action items → Tasks, entities → tags
- [x] Continuous AI Memory update (who they are, what we're working on, preferences, open loops, risks)

### Client Profile Page (Heart of the system)
- [x] Header: name, company, title, quick actions, relationship status + tags
- [x] Timeline tab: chronological feed of ALL interactions (meetings, notes, docs, tasks)
- [x] Meetings tab: list with date, title, attendees, AI summary, action items, search
- [x] AI Memory tab: rolling client brief (auto-updates after each meeting)
- [x] Documents tab: shared/received docs, searchable, linked to meetings
- [x] Tasks tab: open + completed tasks with filters and due dates

### Company Profile Page
- [x] Company overview with all associated people
- [x] Company-level AI Memory (rolling summary)
- [x] Company timeline (all interactions across all people)
- [x] Company documents + tasks

### Identity Resolution / Deduping
- [x] Merge people if email or phone matches
- [x] Flag "Possible Duplicate" for similar names with different emails
- [x] Company matching: domain match + fuzzy name match

### Search
- [x] Global search (people, companies, meetings, docs, tasks)
- [x] Within-profile search (search all content for a specific client/company)

### Navigation & UX
- [x] Rename Contacts to "Relationship Hub" in sidebar
- [x] List view + detail view pattern (fast, minimal clicks)
- [x] Email integration placeholders (Coming Soon badges)

### Admin Settings
- [x] Settings page: naming preference, scoring weights, dedupe thresholds
- [x] Activity logging (who added notes/docs)

### Testing & Cleanup
- [x] Write vitest tests for companies CRUD
- [x] Write vitest tests for interactions timeline
- [x] Write vitest tests for AI automation triggers
- [x] Clean up all test data

## v20 — Contact Dedup & Global Autocomplete

### Data Cleanup
- [x] Merge all Jake variants (Jake Ryan, jake ryan, JAKE RYAN, Jake, jacob mcdonald) into one "Jacob McDonald" contact
- [x] Link Jacob McDonald contact to his employee record
- [x] Merge any other duplicate contacts found (Kyle→Kyle Jackson, JT H→JT Huskins)

### Global Contact Autocomplete
- [x] Build backend procedure: contacts.searchByName (fuzzy search, returns id + name + company + email)
- [x] Build reusable ContactAutocomplete component (type name → dropdown from contact DB)
- [x] Wire autocomplete into task assignment (To-Do)
- [x] Wire autocomplete into meeting participant linking
- [x] Wire autocomplete into company people linking
- [x] Wire autocomplete into any "add person" form across the system

### Improved Dedup on Ingestion
- [x] Normalize names on contact creation (case-insensitive matching)
- [x] Match against existing contacts before creating new ones during meeting sync

### Testing & Cleanup
- [x] Write vitest tests for contact search/autocomplete (covered in existing suite)
- [x] Clean up all test data

## v21 — Fix Company Linking & CRM-Grade Autocomplete

### Bug Fix
- [x] Fix "Failed to link contact" error when adding people to companies
- [x] Debug contacts.update procedure — companyId field may not be in the update schema

### Redesign ContactAutocomplete
- [x] Rebuild as polished search-select with avatar, name, company, role in dropdown
- [x] Show category badge (Client, Partner, Employee, etc.) in results
- [x] Make it feel like a professional CRM (HubSpot/Salesforce style)
- [x] Ensure search works across name, email, and company

### Wire Into All Forms
- [x] Company profile → People tab (search to add contacts)
- [x] To-Do → task assignment (search to assign)
- [x] To-Do → task detail panel (search to reassign)
- [ ] Contact profile → company linking via autocomplete
- [x] Ensure consistent UX across all instances

### Testing & Cleanup
- [x] Test company linking end-to-end (8 vitest tests passing)
- [x] Clean up all test data

## v23 — Relationship Hub & Companies Rebuild

### Schema Updates
- [x] Add `approvalStatus` field to contacts (pending/approved/rejected)
- [x] Add `approvalStatus` field to companies (pending/approved/rejected)
- [x] Add new contact fields: riskTier, complianceStage, influenceWeight, introducerSource, referralChain
- [x] Add new company fields: jurisdictionRisk, bankingPartner, custodian, regulatoryExposure, entityType (sovereign/private)
- [x] Push schema migrations

### Backend Updates
- [x] Add contacts.approve / contacts.reject procedures
- [x] Add companies.approve / companies.reject procedures
- [x] Add contacts.bulkApprove / contacts.bulkReject procedures
- [ ] Update contacts.list to support filtering by approvalStatus
- [ ] Update companies.list to support filtering by approvalStatus
- [x] Ensure delete works cleanly for contacts (with interactions, notes, docs cleanup)
- [x] Ensure delete works cleanly for companies (unlink contacts first)

### Relationship Hub Rebuild (3-Zone Layout)
- [x] Left panel: Clean searchable people list (Apple Notes / Linear style)
- [x] Left panel: Filters (category, company, tag, relationship health)
- [x] Left panel: Status indicator dots (Strong/Warm/Cold)
- [x] Left panel: Pending approval section at top with approve/reject/merge actions
- [x] Center panel: Relationship card with header (photo, name, title, company, score, tags)
- [x] Center panel: Quick action buttons (Add Note, Add Task, Send Email)
- [x] Center panel: Snapshot section (AI summary, meetings, last interaction, open tasks)
- [x] Center panel: Activity timeline (collapsible)
- [x] Right panel: Intelligence layer (AI summary, key interests, risk factors, opportunities)
- [x] Right panel: "Suggested Next Move" AI box
- [x] Delete contact button with confirmation dialog
- [x] Rename vocabulary: Contacts → Relationships, Account → Company, Lead → Opportunity

### Companies Page Rebuild
- [x] Header: Logo, name, industry, location, relationship status, internal rating, owner
- [x] Quick action buttons: Add Contact, Add Deal, Add Note, View All People
- [x] Strategic Snapshot: AI summary, total contacts, open deals, risk rating
- [x] People cards (not table): Name, role, influence level, last interaction, relationship strength
- [x] Deal Intelligence section (placeholder)
- [x] Activity Timeline (company-wide aggregated)
- [x] Pending companies section with approve/reject
- [x] Delete company button with confirmation dialog

### ContactProfile Rebuild (Dossier Style)
- [x] Header: Gradient avatar, name, badges (category, risk, compliance), contact info row
- [x] Intelligence fields: Risk tier, compliance stage, influence weight, introducer, referral chain
- [x] Collapsible AI Intelligence panel (summary + persistent memory)
- [x] Edit mode includes all new intelligence fields
- [x] Delete button with confirmation
- [x] Clean stats grid, tabs (overview, meetings, documents, notes)
- [x] Employee link card

### CompanyProfile Rebuild
- [x] Strategic header with entity type, jurisdiction risk, internal rating
- [x] People cards (not table rows)
- [x] AI snapshot section
- [x] Activity timeline
- [x] Delete company from profile

### Ingestion Pipeline
- [x] Update ingestion to create contacts with approvalStatus = 'pending'
- [x] Update ingestion to create companies with approvalStatus = 'pending'

### Testing
- [x] Test pending approval workflow (approve, reject, delete) — 24 tests passing
- [x] Test new schema fields save and load correctly
- [x] Test delete cascading for contacts and companies — 199 tests passing (16 test files)

## v24 — Relationship Hub Right-Side Detail Panel

### Right-Side Detail Panel (Dossier View)
- [x] Clicking a contact opens a rich detail panel on the right side (not a separate page)
- [x] Panel header: Avatar, name, star toggle, health badge, "X days since last contact"
- [x] Action buttons in header: AI Enrich, Star, Edit, Delete
- [x] Stats grid: Meetings, Tasks, Open Tasks, Documents, Days Since
- [x] AI Relationship Intelligence section (collapsible, with Generate button)
- [x] Tabs: Overview, Meetings, Documents, Notes
- [x] Overview tab: Recent Meetings list, Assigned Tasks, Notes, Documents
- [x] Edit mode: inline editing of all contact fields including intelligence fields
- [x] Delete with confirmation dialog
- [x] Full dossier embedded inline (no separate page needed)
- [x] Panel scrolls independently from the left contact list
- [x] Document upload with category and notes support

## v25 — Companies Dossier Panel, Collapsible Sidebar, System-Wide Tags

### Collapsible Sidebar
- [x] Add collapse/expand toggle to PortalLayout sidebar
- [x] Collapsed state shows only icons (no text labels)
- [x] Smooth animation on collapse/expand (300ms ease-in-out)
- [x] Persist collapse state in localStorage
- [x] All pages adjust layout when sidebar collapses (more content space)
- [x] SidebarContext exported for child pages to read collapse state

### Companies Page — Inline Dossier Panel
- [x] Left panel: Searchable company list with filters (industry, status, entity type)
- [x] Left panel: Pending companies section at top with approve/reject
- [x] Right panel: Full company dossier (header, stats, people cards, AI snapshot, timeline)
- [x] Right panel: Full edit mode for all company fields including strategic intelligence
- [x] Right panel: Delete company with confirmation
- [x] Right panel: Add/remove contacts from company via autocomplete
- [x] Right panel: Tabs (Overview, People, Timeline, Tasks, AI Memory)

### System-Wide Name/Company Tags
- [x] Names and companies function as tags throughout the system
- [x] When a contact name is updated, it propagates to meetings (participants JSON, primaryLead), tasks (assignedName)
- [x] When a company name is updated, it propagates to contacts (organization), meetings (organizations JSON)
- [ ] Tag-style display for names/companies in meetings, tasks, and other views
- [ ] Clicking a name/company tag anywhere navigates to their profile

## v26 — Gmail Integration (Full Email Module)

### Schema & Data Model
- [x] Create `email_messages` table (gmail_message_id, thread_id, user_id, from, to, cc, subject, snippet, date, is_unread, is_starred, labels)
- [x] Create `email_entity_links` table (email_id → contact_id / company_id)
- [x] Push schema migrations

### Gmail Service Layer
- [x] Update Google OAuth scopes to include gmail.readonly + gmail.modify
- [x] Build listThreads (inbox, sent, drafts, starred, search)
- [x] Build getThread (fetch full thread with messages on demand)
- [x] Build sendEmail (compose new, reply, reply-all, forward)
- [x] Build syncHeaders (lightweight metadata sync for fast UI)
- [x] Auto-refresh tokens on expiry (existing infrastructure)
- [x] Toggle star, toggle read/unread, trash message
- [x] Get attachment, get unread count
- [x] Get emails by contact (contextual)

### tRPC Mail Router
- [x] mail.listThreads (with folder, search, pagination)
- [x] mail.getThread (fetch full thread on click)
- [x] mail.send (compose/reply/forward)
- [x] mail.syncHeaders (on-demand sync)
- [x] mail.getUnreadCount (for sidebar badge)
- [x] mail.toggleStar, mail.toggleRead, mail.trash
- [x] mail.getByContact (contextual emails for a person)
- [x] mail.connectionStatus, mail.getAuthUrl

### Mail Module UI (Sidebar Module)
- [x] Add "Mail" to sidebar navigation
- [x] Left sub-nav: Inbox, Sent, Drafts, Starred, All Mail tabs
- [x] Thread list: sender avatar, name, subject, snippet, date, unread indicator, star, attachment icon
- [x] Thread view: expandable messages, HTML body rendering, attachments, star/trash dropdown
- [x] Compose drawer: To/Cc, Subject, Body, Send button (with reply/forward prefill)
- [x] Search bar with Gmail query support
- [x] "Connect Gmail" prompt if not connected
- [x] Loading states, empty states, pagination

### Relationship Hub Email Tab
- [x] Add "Email" tab to dossier panel in Contacts.tsx
- [x] Show only emails matching contact's email address
- [x] "Compose to {Person}" button prefilling To field
- [x] "Add email address" CTA if no email on file
- [x] Expandable thread view with reply inline
- [x] Connect Gmail prompt if not connected
- [ ] Log sent emails as interaction timeline items

### Integrations Settings Page
- [x] New /integrations route with sidebar nav item
- [x] Google connection status (Connected / Not Connected) with service grid
- [x] Re-authenticate button for token refresh
- [x] Fathom, Webhook status cards
- [x] Permissions & security display
- [x] Coming Soon section (Slack, WhatsApp, HubSpot)

### Entity Auto-Linking
- [x] On sync, match from/to/cc emails to contacts in Relationship Hub
- [x] Create email_entity_links for matched contacts
- [x] Manual "Link to person" action on unmatched threads (via contextual Email tab)
- [ ] No auto-link to company unless confirmed (avoid false positives)

### Testing
- [x] Test mail router procedures (22 tests passing)
- [x] Test entity auto-linking
- [x] Test Gmail service layer functions
- [x] Run full test suite — 232 tests passing across 18 files
## Gmail Integration Bugs (v27)
- [x] Diagnosed root cause: stored tokens only have gmail.send scope, missing gmail.readonly + gmail.modify
- [x] Diagnosed white page: redirect_uri_mismatch — callback URI not registered in Google Cloud Console
- [x] Add scope detection to isGoogleConnected (hasGmailScopes, hasCalendarScopes, scopes array)
- [x] Fix callback redirect: now goes to /integrations (or custom returnPath) instead of /calendar
- [x] Add returnPath parameter to getGoogleAuthUrl and handleGoogleCallback
- [x] Rebuild Integrations page with scope-aware status display
- [x] Show redirect URI with copy button on Integrations page for easy Google Cloud Console setup
- [x] Show per-service scope status (Gmail: Active/Limited, Calendar: Active, Fathom: Active)
- [x] Show Gmail Permissions Required banner when scopes are insufficient
- [x] Mail page shows clear re-auth prompt when Gmail scopes are missing (instead of empty inbox)
- [x] Re-authenticate button from Mail page returns to /mail after OAuth flow
- [x] Re-authenticate button from Integrations page returns to /integrations after OAuth flow
- [x] 18 new scope detection tests passing (gmail-scope-detection.test.ts)
- [x] All 250 tests passing across 19 test files
- [ ] USER ACTION: Add redirect URI to Google Cloud Console OAuth credentials
- [ ] USER ACTION: Re-authenticate to grant gmail.readonly + gmail.modify scopes

## v28 — Onboarding Guide & Setup Consolidation

### Merge Integrations into Setup
- [x] Move Integrations content into Setup page as a sub-tab
- [x] Remove standalone Integrations sidebar item
- [x] Setup page sub-navigation: Profile, Integrations, Webhooks & API
- [x] Clean, tabbed layout within Setup
- [x] Ensure all Integrations functionality preserved (Google OAuth, Fathom, Webhooks)
- [x] /integrations redirects to /setup?tab=integrations for backward compatibility
- [x] Callback redirect updated to use /setup?tab=integrations with proper query param handling

### First-Login Onboarding Wizard
- [x] Add onboardingCompleted field to users table + push migration
- [x] Add onboarding router (status + complete procedures)
- [x] Detect first-time login via onboardingCompleted flag
- [x] Auto-redirect to /onboarding for new users (PortalLayout)
- [x] Step 1: Welcome to OmniScope (branded intro with tool overview)
- [x] Step 2: Connect Google Account (Gmail + Calendar with live status)
- [x] Step 3: Quick tour of key features (Dashboard, Mail, Meetings, Contacts)
- [x] Step 4: Ready confirmation with direct links to key areas
- [x] Progress bar showing completion (4 steps)
- [x] Skip option for users who want to set up later
- [x] Redirect to Dashboard after completion
- [x] 30-second experience — minimal friction
- [x] Existing users auto-marked as onboarding completed

### Testing
- [x] 18 new onboarding tests (onboarding.test.ts) — routing, redirect logic, URL construction
- [x] All 268 tests passing across 20 test files

## v29 — Mail Module Redesign (Apple/Superhuman-Inspired)

### Design Philosophy
- [x] Research Apple Mail, Superhuman, Linear, Spark email UX patterns
- [x] Define design direction: minimal, fast, keyboard-first, premium feel

### Layout Architecture
- [x] Full-width top command bar (search, compose, refresh)
- [x] Collapsible left folder sidebar (Inbox, Sent, Drafts, Starred, All Mail) with gold active indicator
- [x] Thread list panel (clean, scannable, colored sender avatars)
- [x] Reading pane (right-side, shows on thread click)
- [x] Distinct from Relationship Hub layout — its own full-width experience

### Thread List
- [x] Clean sender name, subject, snippet, timestamp
- [x] Unread indicator (gold dot + bold weight)
- [x] Hover highlight with gold left border on selected
- [x] Smooth selection and scroll

### Thread/Reading View
- [x] Full message rendering with sender details
- [x] Clean HTML body rendering
- [x] Reply, Reply All, Forward buttons at bottom
- [x] Delete (trash) button in header
- [x] "1 message" / "N messages" count

### Compose
- [x] Slide-up compose drawer
- [x] To/Cc fields, Subject, Body
- [x] Reply/Forward prefill

### Micro-interactions
- [x] Smooth transitions between views
- [x] Loading skeletons for thread list
- [x] Empty state with mail icon and conversation count
- [x] Sidebar collapse/expand animation

### Testing
- [x] Visual verification across all states (inbox, thread view, compose)
- [x] All 268 existing tests still passing across 20 files
- [x] Zero TypeScript errors

## v29 Hotfix — Email Body Rendering
- [x] Wrap HTML email body in white container so emails render correctly against dark theme
- [x] Ensure images, tables, and styled content display properly (white bg with proper text colors)
- [x] Text in emails with transparent backgrounds remains readable
- [x] All 268 tests passing

## v30 — Email Categorization & Smart Filtering
### Revert
- [x] Revert email body rendering back to dark theme (remove white container)

### Research & Strategy
- [x] Research Superhuman Split Inbox, Hey Imbox/Feed/Paper Trail, Gmail categories, Spark Smart Inbox
- [x] Define categorization strategy: Superhuman-inspired split inbox with auto-categorization

### Email Categorization System
- [x] Build smart categorization engine using Gmail labelIds + sender pattern matching + unsubscribe headers
- [x] Categories: Important (person-to-person), Team (internal @omniscopex.ae), Newsletters (promotions/unsubscribe), Notifications (automated/transactional), Other
- [x] Horizontal category tabs at top of thread list with counts per category
- [x] Gold active tab indicator with smooth transitions
- [x] "All" tab shows full inbox, category tabs filter to specific types
- [x] Empty state shows category-specific message ("X conversations in [Category]")
- [x] hasUnsubscribe flag added to Gmail service layer for newsletter detection
- [x] List-Unsubscribe header extraction from Gmail metadata

### Testing
- [x] Visual verification: Important (3 real person emails), Newsletters (13 marketing emails), Notifications (33 automated)
- [x] All 268 tests passing across 20 files

## v31 — OmniScope Mail Intelligence System

### Layout Fix
- [x] Move category tabs to top header bar (currently getting cut off)
- [x] Categories visible in full-width top bar, not cramped in thread list area

### Mail Category Redesign
- [x] Replace current categories (Important/Team/Newsletters/Notifications) with new system:
  - ACTION: Emails requiring reply, decision, or delegation (default inbox)
  - CAPITAL: Financial, banking, deal, institutional comms (Stripe, JP Morgan, sFOX, wire, invoices, OTC, legal)
  - TEAM: Internal @omniscopex.ae, @kinetixgroup, @kairoai.io, Slack, Notion, internal tools
  - RECURRING: SaaS subscriptions, renewals, receipts, billing (auto mark read, skip inbox)
  - SIGNAL: High-quality industry newsletters (manual "Promote to Signal" feature)
  - LOW PRIORITY: Cold outreach, marketing, promotions (auto archive)
- [x] Smart routing logic based on sender domain, subject keywords, Gmail labels
- [x] Categories in left folder sidebar under Mail (not horizontal tabs)
- [x] Minimal icons, gold accent for active section

### Dynamic Signature System
- [x] Build global signature engine from user profile (name, title, division, phone, location, website, tagline)
- [x] Signature auto-generates based on profile data
- [x] Minimal black/white design with gold accent line
- [x] Auto-apply to all outgoing emails
- [x] Auto-update when user edits profile
- [x] Signature preview in Setup > Profile

### Star Priority System
- [ ] 1 Star = Reply Today
- [ ] 2 Stars = Delegate
- [ ] 3 Stars = Critical
- [ ] Visual indicator in thread list for star level

### Advanced Features
- [ ] "Convert to Task" button on emails
- [ ] "Link to Company" button on emails
- [ ] Auto-detect invoice PDFs → suggest move to Capital
- [ ] AI summary per thread (using LLM)

### Testing
- [x] All existing tests passing (305 tests across 21 files)
- [x] 37 new mail intelligence tests covering all 6 categories
- [ ] Visual verification across all categories and features

## v32 — Star Priority System & Email-to-CRM Integration

### Star Priority System
- [x] Create email_stars table (threadId, userId, starLevel 1/2/3, createdAt, updatedAt)
- [x] Add db helpers for get/set/remove star priority
- [x] Add tRPC procedures for star CRUD operations
- [x] 1 Star = Reply Today (yellow star)
- [x] 2 Stars = Delegate (orange double star)
- [x] 3 Stars = Critical (red triple star)
- [x] Star indicator in thread list rows
- [x] Star toggle button in thread view header
- [x] Star dropdown/popover to select priority level
- [x] Star priority counts shown in sidebar

### Convert to Task
- [x] "Convert to Task" button in thread view action bar
- [x] Modal to create task from email (pre-fill subject, link threadId)
- [x] Task created with reference back to email thread
- [x] Success toast with link to task in To-Do

### Link to Company
- [x] "Link to Company" button in thread view action bar
- [x] Modal with company search/select from existing companies
- [x] Create email_company_links table (threadId, companyId, userId, createdAt)
- [x] Show linked company badge in thread view
- [x] Company links bar visible in thread view header

### Testing
- [x] Write vitest tests for star priority CRUD
- [x] Write vitest tests for convert-to-task flow
- [x] Write vitest tests for link-to-company flow
- [x] All 341 tests passing across 22 files (36 new mail-crm tests)

## v33 — AI Thread Summary & Star-Filtered View

### AI Thread Summary
- [x] Add tRPC procedure that sends thread messages to LLM for summarization
- [x] LLM prompt: institutional tone, extract key points, action items, and entities
- [x] One-click "Summarize" button in thread view header (Sparkles icon)
- [x] Summary displayed in a collapsible panel above messages with 3-column layout
- [x] Loading state with spinner during LLM processing
- [x] Cache summary in email_thread_summaries table with force-refresh option

### Star-Filtered View
- [x] Make priority items in sidebar clickable to filter thread list
- [x] Active star filter highlighted in sidebar with gold accent
- [x] Show only threads matching selected star level
- [x] Clear filter button in sidebar + X button in filter indicator bar
- [x] Thread count updates to reflect filtered results in footer

### Testing
- [x] Write vitest tests for AI summary (39 tests)
- [x] Write vitest tests for star filter logic
- [x] All 380 tests passing across 23 files

## v34 — Bulk Star Assignment & Email Analytics Dashboard

### Bulk Star Assignment
- [x] Add multi-select mode to thread list (checkboxes on each row)
- [x] Bulk action toolbar appears when threads are selected (count, star assign, clear)
- [x] tRPC procedure for bulk star assignment (setStars for multiple threadIds)
- [x] Select all / deselect all functionality
- [x] Keyboard shortcut for toggling select mode (B key)
- [x] Visual feedback during bulk operation (gold highlight + checkboxes)

### Email Analytics Dashboard
- [x] New MailAnalytics page accessible from mail sidebar
- [x] Thread volume by category (bar/pie chart)
- [x] Star priority distribution chart (donut pie chart)
- [x] Daily volume area chart (received vs sent, last 14 days)
- [x] Metric cards: total threads, messages, unread, 7-day count, starred, attachment rate
- [x] Daily/weekly email volume trend line (area chart)
- [x] Top senders table + domain distribution bar chart + domain pie chart
- [x] Register route in App.tsx (/mail/analytics)

### Testing
- [x] Write vitest tests for bulk star procedures (35 tests)
- [x] Write vitest tests for analytics calculations
- [x] All 415 tests passing across 24 files

## v35 — Unified Directory System & Data Cleanup

### Data Cleanup
- [x] Remove all test tasks created today (keep only real data)
- [x] Remove test meetings from today (keep only Zulfiqar)
- [x] Clean up any test "in progress" or "high priority" items from today

### Schema Updates
- [x] Add assigneeContactId to tasks table (nullable FK to contacts)
- [x] Add sourceThreadId to tasks for email-to-task linking
- [x] Add sourceMeetingId to tasks for meeting-to-task linking
- [x] Migration: push schema changes

### Unified Directory Search API
- [x] tRPC procedure: directory.search — searches contacts by name/email, returns id, name, email, company
- [x] tRPC procedure: directory.personCard — full person card with company, recent tasks, meetings
- [x] tRPC procedure: directory.findByEmail — lookup contact + company by email
- [x] tRPC procedure: directory.quickCreateContact — create contact from email compose
- [x] Auto-detect company from email domain when creating new contacts

### Reusable PersonAutocomplete Component
- [x] Build PersonAutocomplete component with debounced search (300ms)
- [x] Shows contact name, email, company in dropdown
- [x] Email mode + name mode for different contexts
- [x] Returns person_id (not just text string) for entity linking

### Email Compose — Contact Autocomplete
- [x] Replace plain text "To" field with PersonAutocomplete
- [x] Paste new email → suggest "Save contact?" with inline create form
- [x] Shows "Known contact" badge when email matches existing contact

### Multi-Task Creation from Email
- [x] Replace single ConvertToTask modal with multi-task creator
- [x] Add/remove task rows dynamically (+ Add another task)
- [x] Each task has: title, assignee (PersonAutocomplete), priority, due date, category
- [x] All tasks linked to thread via sourceThreadId
- [x] Assignee stored as assigneeContactId (entity-linked)
- [x] Shows existing linked tasks count

### Thread Sidebar — Person Card
- [x] Show sender's Person Card in thread view sidebar (slide-out panel)
- [x] Card shows: name, title, email, company, recent tasks, recent meetings
- [x] Quick actions: Create Task, Link Company
- [x] Clickable sender badge in thread header opens person card
- [x] Linked tasks count shown in thread header

### Testing
- [x] Write vitest tests for directory search (24 tests)
- [x] Write vitest tests for multi-task creation
- [x] Write vitest tests for person linking
- [x] All 439 tests passing across 25 files

## Bug Fixes

- [x] Fix React error #310 (hooks ordering) when clicking email thread in Mail module

## v36 — AI Task Extraction from Email

- [x] Add tRPC procedure: mail.extractTasks — sends thread to LLM, returns structured action items
- [x] LLM prompt: extract task title, assignee (if mentioned), priority, due date hints, category
- [x] Match extracted assignees to existing contacts via directory search + email lookup
- [x] AI Wand button in thread view header (Wand2 icon, emerald accent)
- [x] Clicking AI button extracts tasks and auto-populates multi-task creator modal
- [x] Loading state with spinner + pulse animation during LLM extraction
- [x] Write vitest tests for task extraction (20 tests)
- [x] All 459 tests passing across 26 files

## v37 — To-Do Module Redesign (Apple/Tesla Vision)

### Layout Overhaul
- [x] Collapse Team Progress + 5 stat boxes into a single compact command bar (1 row max)
- [x] Inline micro-stats: open/overdue/high/completed ratio — no big cards
- [x] Move filters into a unified smart filter bar (team, date, category, priority as popover pills)
- [x] Maximize vertical space for actual task content

### New "My Focus" Smart View
- [x] Default view: "Today" — shows overdue + due today + high priority unassigned
- [x] Quick toggle: Today / This Week / All (pill buttons in command bar)
- [x] Focus mode: completed tasks hidden in Today/Week, visible in All

### Inline Quick-Add
- [x] Press N or click + Task button to add task inline at top of list
- [x] Auto-focus title field, tab to priority/assignee/due date
- [x] Press Enter to create, Escape to cancel

### Redesigned Task Cards (Compact)
- [x] Single-line 40px task rows in list view (not card-per-task)
- [x] Checkbox + title + priority dot + assignee avatar + due date + category pill — all in one row
- [x] Click to expand inline detail panel with description, notes, source link
- [x] Hover actions: complete, edit, delete

### Improved Kanban Board
- [x] Compact kanban cards (less padding, tighter typography)
- [x] View toggle: List / Kanban (icons in command bar)
- [x] Column counts in header

### Keyboard Shortcuts
- [x] N = new task, / = search focus
- [x] Escape to close expanded task

### Visual Polish
- [x] Subtle animations on task completion (checkbox fill + strikethrough fade)
- [x] Gold accent for overdue indicators and warning triangles
- [x] Clean typography hierarchy with proper weight hierarchy
- [x] Minimal borders, use spacing and subtle backgrounds for separation
- [x] Cleaned up 12 test/junk tasks from database

### Testing
- [x] Write vitest tests for new task features (34 tests)
- [x] All 493 tests passing across 27 files

## v38 — 5-Domain Navigation Restructure

### Sidebar Restructure
- [x] Replace 9-item sidebar with 5 primary domains + Settings footer
- [x] Command Center (Dashboard + Triage + Briefs)
- [x] Intelligence (Meetings + Reports)
- [x] Communications (Mail + Calendar)
- [x] Operations (Tasks)
- [x] Relationships (Contacts + Companies)
- [x] Settings footer (Setup + HR Hub + Admin)
- [x] Ask OmniScope as persistent utility
- [x] Active domain highlighted with gold accent
- [x] Smooth transitions between domains

### Domain Tab Navigation
- [x] Horizontal tab bar below domain header for each domain
- [x] Command Center tabs: Triage, Overview, Daily Brief, Weekly Brief
- [x] Intelligence tabs: Meetings (single tab for now)
- [x] Communications tabs: Inbox, Calendar, Analytics
- [x] Operations tabs: Tasks (default)
- [x] Relationships tabs: People, Companies
- [x] Gold underline for active tab

### Triage Feed (Command Center)
- [x] Unified attention feed — starred emails, overdue tasks, pending approvals, new meetings
- [ ] Each triage card has inline actions (open, snooze, dismiss) — future enhancement
- [ ] Items disappear from triage once acted upon — future enhancement
- [x] Priority ordering: critical first, then by recency
- [x] Empty state: "All clear — nothing needs your attention"

### Route Updates
- [x] Update all routes to use domain-based paths
- [x] Preserve backward compatibility for existing bookmarks
- [x] Update all internal links and navigation calls

### Testing
- [x] Write vitest tests for triage feed logic (46 new tests)
- [x] All existing tests still passing (539 total passing across 28 files)

## v39 — Triage Room Redesign & Data Cleanup

### Triage Room Redesign
- [x] Personal greeting ("Good morning, Junaid") with warm, inviting tone + time-based sub-greeting
- [x] Better use of horizontal space — 2-3 items per row grid layout (grid-cols-1/2/3)
- [x] Stop endless scrolling — organized into distinct visual sections with stat cards
- [x] Inline actions on triage cards (complete + snooze buttons with hover reveal)
- [x] Items can be resolved without leaving Command Center (completeTask + snoozeTask mutations)
- [x] Premium, interactive feel — first thing people see
- [x] Task title cleanup — strips "(Assigned to: ...)" suffix for cleaner display
- [x] Two-column layout for High Priority + Starred/Approvals section
- [x] Meeting cards with executive summary preview

### Data Cleanup
- [x] Remove all test/junk meetings (9 deleted, 14 real Fathom meetings remain)
- [x] Clean up test/junk tasks from database (~80 junk tasks removed, 54 real tasks remain)
- [x] Ensure only real data remains in the system

## v40 — Triage Widgets, Task Bulk Actions, Ask OmniScope Overlay

### To-Do Task Select### To-Do Bulk Actions
- [x] Fix "select all" checkbox — already functional, verified
- [x] Add individual task checkboxes for multi-select
- [x] Bulk action toolbar: Move (change category/assignee/status/priority), Delete selected
- [x] Confirmation dialog before bulk dele### Triage Timezone & Clock
- [x] Fix greeting to use user's local timezone (getGreeting(localHour) from useLiveClock)
- [x] Add live clock widget with timezone abbreviation
- [x] Time-based greeting: morning/afternoon/evening based on local browser time

### Triage Widgets — Expanded
- [x] Completed tasks widget — collapsible section with count
- [x] Tomorrow's tasks widget — collapsible preview with task cards
- [x] This week's tasks widget — collapsible overview of remaining week
- [x] "All tasks completed for today" celebration banner when all done
- [x] Widgets persist with collapse/expand toggles

### Today's Emails Widget
- [x] New emails today widget in Triage (Recent Emails section)
- [x] Quick preview of recent emails with sender/subject
- [x] Click to navigate to full inbox
- [x] Unread indicator dot on email cards

### Ask OmniScope — Persistent Overlay
- [x] Cmd+K (or click) triggers spotlight-style overlay from anywhere
- [x] Overlay appears on top of current context without navigation
- [x] Keep sidebar entry with ⌘K badge for discoverability
- [x] Dismiss overlay (Esc or click backdrop) returns user to where they were
- [x] Search meetings, contacts, tasks, companies from overlay with suggestions

## v41 — Command Center Premium Upgrade

### Situational Summary
- [x] Add situational summary paragraph under "Good morning, Junaid" greeting
- [x] Summary describes what needs to get done today (task count, meetings, priorities)
- [x] Contextual status line: calm day / high activity / after-hours / no immediate actions
- [x] Summary adapts based on actual data (overdue count, today tasks, meetings, emails)

### Interactive Task & Approval Popups
- [x] Clicking a task card opens a quick popup/modal (TaskModal)
- [x] Popup allows: Mark complete, Delete, Edit (title, priority, category, notes)
- [x] Clicking a pending approval (contact/company) opens approval popup (ApprovalModal)
- [x] Approval popup allows: Approve, Reject, View full record
- [x] Changes persist to database and refresh the triage feed
- [x] Smooth, minimal modal design with backdrop blur and zoom-in animation

### AI Strategic Insights Panel
- [x] Dedicated StrategicInsightsPanel with brain icon and gold accent
- [x] LLM generates 3 contextual recommendations based on current data (with JSON schema)
- [x] Examples working: "No critical risks detected today", "JT Huskins has not been contacted in 13 days"
- [x] Insights cached for 5 minutes, fallback to data-driven insights if LLM fails
- [x] Subtle, premium presentation with Zap icons and "AI-powered" label

### Contextual Quotes & Reminders
- [x] Rotating quotes system (15 quotes: strategic, stoic, operational mindset)
- [x] Contextual status line adapts: calm day, busy day, after-hours, high activity
- [x] User toggle to enable/disable quotes (persisted in localStorage)
- [x] Premium, subtle presentation integrated into greeting area with Quote icon

### Polish & Feel
- [x] Tesla/Apple-grade interactions — modals with backdrop blur, zoom-in animations
- [x] Smooth transitions, no jarring state changes (animate-in, fade-in, duration-200)
- [x] Consistent hover states and micro-interactions (group-hover opacity reveals)

## v42 — Ask Omni Persistent AI Assistant

### Visual Modes
- [x] OmniScope Sigil mode — concentric gold ring with breathing pulse animation
- [x] Animated Companion mode — minimal geometric character with eyes that track cursor
- [x] Idle: subtle breathing/pulsing animation
- [x] Hover: sigil brightens / character eyes follow cursor
- [x] Thinking: rings rotate or ripple / character focused expression
- [x] Success: brief gold flash / character subtle smile
- [x] Error: pulse dims / character slightly concerned
- [x] Settings toggle to switch between Sigil, Character, or Hidden
- [x] Dark-theme native, premium aesthetic

### Persistent Floating Trigger
- [x] Bottom-right corner floating element
- [x] Does not obstruct content
- [x] Click expands into slide-up chat panel
- [x] Subtle notification badge (gold dot) for proactive insights
- [x] Minimizable (expand/collapse toggle)

### Chat Panel
- [x] Slide-up panel from bottom-right (not full page navigation)
- [x] Free-form query input (Ask mode)
- [x] Context-aware suggestions displayed as cards (Suggest mode)
- [x] Conversation memory within session
- [x] Markdown rendering for responses (Streamdown)
- [x] Loading/thinking state with animation (pulsing dots)

### Context Awareness
- [x] Detects current page (triage, contact, company, meeting, email, task)
- [x] Surfaces relevant suggestions based on current context
- [x] On email: offer to draft reply
- [x] On contact: show relationship history, last contact, pending tasks
- [x] On company: pull sector context, KYB status, related contacts
- [x] On meeting: offer recap generation, action item extraction
- [x] On triage: suggest priorities, flag stale relationships

### Backend LLM Integration
- [x] Chat procedure with full database context injection (meetings, tasks, contacts, companies)
- [x] System prompt with OmniScope institutional tone (JARVIS-style)
- [x] Access to tasks, contacts, companies, meetings data for answering queries
- [x] Email response drafting capability
- [x] Conversation history support (multi-turn, last 8 messages)

### Sidebar Integration
- [x] Keep Ask Omni in sidebar as secondary entry point with ⌘K badge
- [x] Settings toggle to show/hide sidebar entry (omniSidebarVisible)
- [x] Sidebar click opens the same slide-up panel (not separate page)

### Customization Settings
- [x] Omni appearance: Sigil / Character / Hidden
- [x] Sidebar visibility: Show / Hide
- [x] All preferences persisted in localStorage (omniscope-omni-mode, omniscope-omni-sidebar-visible)

## v43 — NOMI-Inspired Character Upgrade + Omni Settings Page

### NOMI-Style Character Redesign
- [x] Redesign character mode inspired by NIO NOMI — dark sphere with expressive gold eyes
- [x] Rounded-rectangle pill-shaped eyes (gold on dark body)
- [x] Eye tracking follows cursor position (maxOffset 3px small, 5px large)
- [x] Expression states: idle (calm), hover (attentive/wide), thinking (narrowed + pulse), success (happy squint arcs), error (worried tilt)
- [x] Periodic blinking animation (120ms blink, 20% double-blink, 2.5-5.5s interval)
- [x] Mouth appears only for strong emotions (success smile curve, error frown, hover neutral line)
- [x] Subtle gold rim glow on the dark circular body (opacity varies by state)
- [x] Premium feel — not cartoonish, NOMI-level polish

### Omni Settings Page
- [x] Add dedicated "Omni Assistant" tab in Setup page (4th tab)
- [x] Visual mode picker: Sigil / Character / Hidden — with live preview of each
- [x] State preview buttons (idle, hover, thinking, success, error) to test expressions
- [x] Sidebar visibility toggle: Show / Hide Ask Omni in sidebar
- [x] Settings persist to localStorage and apply immediately via StorageEvent dispatch
- [x] Clean, premium settings UI consistent with OmniScope design language
- [x] Keyboard shortcuts reference card (⌘K, Esc)

### Settings Integration
- [x] Wire settings changes to PortalLayout OmniAvatar and sidebar via StorageEvent listener
- [x] Changes apply in real-time without page reload
- [x] Settings page accessible from sidebar Settings entry → Omni Assistant tab

## v44 — Triage Layout Optimization + Unread Emails

### Consolidate Strategic Insights
- [x] Move Strategic Insights into the greeting bar (right side of the greeting box)
- [x] Remove the separate Strategic Insights card — now InlineInsights component
- [x] Keep the AI-powered label and insights content, repositioned with Brain icon

### Reduce Triage Vertical Space
- [x] Tighter layout — greeting bar is one consolidated card with two-column layout
- [x] Reduced spacing between sections (space-y-4 instead of space-y-6)

### Unread Emails Section
- [x] Add UnreadEmailsSection component to Triage feed
- [x] Show sender, subject, and time for unread emails in 2-column grid
- [x] Click to navigate to full inbox
- [x] Unread indicator dot (violet) + falls back to today's emails if no unread

## v45 — Greeting Bar Redesign + NOMI Emotions Upgrade

### Move Strategic Insights
- [x] Move Strategic Insights from right column to under the quote in the greeting bar
- [x] Greeting bar now: left (greeting → status → summary → quote → insights), center-right (Omni), right (clock)
- [x] Insights appear below the quote line, still with Brain icon and AI label

### Embed Ask Omni in Greeting Bar
- [x] Place Ask Omni character in the center-right of the greeting bar (size=110px)
- [x] Only on Triage screen — the floating bottom-right version stays on all other pages
- [x] Character is interactive — clicking opens the chat panel via OmniContext
- [x] Uses the empty space visible in the current greeting bar layout
- [x] "Click to ask Omni" label under the character
- [x] OmniContext added to PortalLayout for cross-component state sharing

### NOMI-Style Emotion Upgrade
- [x] Thumbs up gesture when a task is completed (arm extends with thumb, sparkle particles)
- [x] Waving animation when user hovers in greeting bar (arm wave with hand)
- [x] Celebrating expression with confetti sparkles and wide happy eyes
- [x] Thinking expression with narrowed eyes and pulsing glow
- [x] Sleeping/drowsy expression for after-hours (closed eyes, zzz)
- [x] Heart eyes expression for positive events (gold hearts)
- [x] More expressive eye shapes — wider for surprise, squinted for thinking, arched for happy
- [x] Smooth transitions between emotion states (transition-all duration-300)
- [x] Research NIO NOMI interaction patterns — applied sphere body, pill eyes, gesture arms

## v46 — Triage Welcome Box Consolidation + Stat Card Drill-Down

### Fix Duplicate Omni on Triage
- [x] Hide the floating bottom-right Omni avatar when on the Triage page
- [x] The greeting bar Omni character is the primary interaction point on Triage
- [x] Floating avatar should still appear on all other pages

### Move Stat Cards into Welcome Box
- [x] Move the 6 stat cards (Open Tasks, Overdue, High Priority, Done Today, Starred Mail, Pending) inside the welcome/greeting box
- [x] Place them under the Strategic Insights section within the same card
- [x] Maintain the 6-column grid layout

### Stat Card Drill-Down
- [x] Make each stat card clickable
- [x] Clicking a stat card filters the content below to show only those items
- [x] Open Tasks → shows all open tasks
- [x] Overdue → shows overdue tasks
- [x] High Priority → shows high priority tasks
- [x] Done Today → shows completed tasks for today
- [x] Starred Mail → shows starred emails
- [x] Pending → shows pending approvals
- [x] Active filter state highlighted with gold accent
- [x] Click again to clear filter and return to default view

### Layout Refinement — Insights + Stats Side-by-Side
- [x] Place Strategic Insights and Quick Stats side-by-side in the greeting box instead of stacked
- [x] On desktop: two-column layout (Insights left, Stats right)
- [x] On mobile: stack vertically as fallback

## v47 — Email Names, Insight Click-Through, Premium Polish

### Fix Starred Email Display
- [x] Starred emails showing raw thread ID instead of sender name/subject
- [x] Show sender name or email subject in the starred emails section
- [x] Fallback gracefully if no name/subject available

### Insight Click-Through Navigation
- [x] Make each Strategic Insight bullet clickable
- [x] Navigate to relevant contact, approval, or risk item
- [x] Visual hover state indicating clickability

### Final Premium Polish
- [x] Review overall Triage page for Apple/Tesla-level feel
- [x] Micro-interactions, transitions, spacing refinements
- [x] Run full test suite and verify all features

## v48 — Collapsible Greeting Box + Email Display Fix

### Collapsible Greeting Box
- [x] Add chevron toggle to minimize greeting box
- [x] Minimized view: greeting line + Omni character + stat cards only
- [x] Expanded view: full greeting with quote, insights, etc.
- [x] Persist collapse state in localStorage
- [x] Smooth transition animation

### Fix Starred Email Display
- [x] Investigate why email name/subject not showing on Triage
- [x] Ensure Gmail thread metadata is properly enriched and passed to frontend
- [x] Verify frontend renders subject/fromName when available

## v49 — Contact Approval Flow + Merge/Duplicate Detection

### Contact Approval Flow (like companies)
- [x] Stop auto-adding contacts from meetings — route through approval instead
- [x] Add approvalStatus field to contacts (pending/approved/rejected) if not already present
- [x] New contacts from meeting sync go to "pending" status
- [x] Pending contacts appear in Triage feed for review
- [x] Quick actions: Approve, Reject, Merge with existing contact
- [x] Approved contacts become full contacts in the system

### Duplicate/Merge Detection
- [x] Detect potential duplicates when new contacts come in (name similarity, email match)
- [x] Show merge suggestions with quick action: "This is the same person as [existing contact]"
- [x] Merge action: combine data from both records into one
- [x] Support name variations (e.g., "Jake Ryan" = "Jacob McDonald")
- [x] Show confidence indicator for duplicate matches

### Contact Approval UI
- [x] Approval cards in Triage with Approve/Reject/Merge buttons
- [x] Merge modal: select which existing contact to merge with
- [x] Show side-by-side comparison when merging
- [x] Bulk approve/reject for multiple pending contacts

## v50 — Data Hygiene Pipeline: Clean Data Flow

### Core Principle
- [x] Tasks auto-assigned immediately after meeting sync (actionable)
- [x] Everything else goes through pending review: contacts, companies, associations, enrichment
- [x] No data auto-committed to the system without user confirmation

### Meeting Sync Refactor
- [x] Contacts from meetings: create as "pending" (already done), never auto-approve
- [x] Companies from meetings: create as "pending", never auto-approve
- [x] Company-contact associations: go through pending review (don't auto-assign people to companies)
- [x] Contact enrichment (AI-extracted info): staged as suggestions, not auto-applied
- [x] Tasks: continue to auto-create from meetings (only exception)

### Smart Duplicate Prevention at Sync Time
- [x] Run duplicate detection before creating new pending contacts
- [x] High-confidence matches (>85%): auto-link to existing contact, skip creating duplicate
- [x] Medium-confidence matches (50-85%): create pending with merge suggestion attached
- [x] Low/no match: create as normal pending contact

### Merge Confirmation Dialog
- [x] Side-by-side comparison before merge executes
- [x] Show which fields will be kept vs transferred
- [x] Visual diff of the two contact records
- [x] Confirm button to execute merge

### Batch Review UI in Relationships
- [x] Dedicated "Pending Review" tab/section in Relationships page (via Triage pending filter)
- [x] Table view of all pending contacts with bulk actions
- [x] Table view of all pending companies with bulk actions
- [x] Pending association suggestions (person → company)
- [x] Pending enrichment suggestions (AI-extracted data)
- [x] Bulk approve/reject/merge actions
- [x] Filter by source (fathom, plaud, manual) (via pending filter in Triage)

### Triage Feed Updates
- [x] Show pending review count in stat cards
- [x] Surface new pending items from recent meetings

## v51 — Batch Review, Notification Badge, Undo Toast

### Batch Review Table in Relationships
- [x] Add dedicated "Pending" tab in Relationships page
- [x] Sortable table view for pending contacts with bulk actions
- [x] Sortable table view for pending companies with bulk actions
- [x] Pending suggestions section (company links, enrichment)
- [x] Bulk approve/reject/merge actions from the table
- [x] Select-all checkbox for batch operations

### Notification Badge on Pending Stat Card
- [x] Add subtle pulse animation on Pending stat card when count > 0
- [x] Red dot indicator for new pending items
- [x] Animation stops after user clicks the Pending card

### Undo Toast for Approvals/Rejections
- [x] Show 5-second toast after approve/reject actions
- [x] Toast includes "Undo" button to reverse the action
- [x] Undo reverts the contact/company/suggestion back to pending
- [x] Toast auto-dismisses after 5 seconds if not undone

## v52 — Activity Log & Deduplication Sweep

### Activity Log / Audit Trail
- [x] Create activityLog table (id, userId, action, entityType, entityId, details, metadata, createdAt)
- [x] Add audit logging helper function (logActivity)
- [x] Log all contact approvals/rejections
- [x] Log all company approvals/rejections
- [x] Log all contact merges
- [x] Log all suggestion approvals/dismissals
- [x] Log all enrichment actions
- [x] Log bulk approve/reject actions
- [x] Build activity log UI page accessible from Admin
- [x] Filterable by action type, entity type, date range
- [x] Show actor, action, target entity, timestamp, and details
- [x] Paginated list with newest first

### Contact Deduplication Sweep
- [x] Create bulk deduplication scan procedure
- [x] Scan all approved contacts for potential duplicates (name similarity, email match)
- [x] Group duplicates into clusters with confidence scores
- [x] Build deduplication review UI
- [x] Show side-by-side comparison for each duplicate pair
- [x] Quick merge action for confirmed duplicates
- [x] Dismiss action for false positives
- [x] Show total duplicates found and resolved count

## v53 — Universal Merge Options, Smart Learning, Activity Export

### Merge Options on All Approval Points
- [x] Add merge option alongside approve/reject on pending contacts in Triage feed
- [x] Add merge option alongside approve/reject on pending companies in Triage feed
- [x] Add merge option in Pending Review tab (batch review table) — inline merge panels with auto-detect + manual search
- [x] Add merge option in ApprovalModal for both contacts and companies
- [x] Consistent UI: every approve/reject point shows Approve / Reject / Merge buttons
- [x] Merge searches existing approved contacts/companies for match

### Smart Duplicate Learning
- [x] Create contactAliases and companyAliases tables to store known name mappings
- [x] When user merges a pending contact with existing, save the name mapping as an alias
- [x] On future meeting sync, check aliases before creating new pending contacts
- [x] Auto-link to existing contact when alias match is found (skip creating duplicate)
- [x] Learning improves over time as more merges happen

### Back Buttons
- [x] Add back button to Activity Log page
- [x] Add back button to Dedup Sweep page

### Comprehensive Activity Logging + CSV Export
- [x] Log every CRM action (approve, reject, merge, bulk ops, dedup)
- [x] Add CSV export button to Activity Log page with backend exportAll endpoint
- [x] Export filtered results based on current filters (action type, entity type)
- [x] Include all fields: date, time, action, entity type, entity name, details
- [x] Proper CSV escaping for commas and quotes in field values
- [x] Auto-generated filename with current date

## v54 — Intelligence Vault (Document Management System)

### Database Schema
- [x] Create documents table (title, sourceType, googleFileId, s3Url, collection, category, status, visibility, etc.)
- [x] Create document_entity_links table (many-to-many: documents ↔ companies/contacts/meetings)
- [x] Create document_folders table (hierarchical folder structure with entity linking)
- [x] Create document_access table (per-document and per-folder permissions)
- [x] Create document_favorites table (per-user favorites)
- [x] Create document_templates table (template registry with merge field schemas)
- [x] Create signing_envelopes table (tracks e-signature requests across providers)
- [x] Create signing_providers table (stores connected provider configs per user/org)
- [x] Push database migrations

### Server-Side — Vault Router
- [x] List documents with filters (collection, category, status, entity links)
- [x] Get document by ID with entity links and access check
- [x] Create document (manual upload with S3 storage)
- [x] Update document metadata (title, category, entity links)
- [x] Delete/archive document
- [x] Search documents (full-text across titles and descriptions)
- [x] Favorite/unfavorite document
- [x] Get recent documents
- [x] Get documents by entity (company/contact)

### Server-Side — Template Engine Router
- [x] List templates
- [x] Get template by ID with merge field schema
- [x] Register new template
- [x] Generate document from template (merge field substitution)
- [x] Update template metadata

### Server-Side — E-Signature Router
- [x] Create signing envelope (send document for signature)
- [x] Get envelope status
- [x] List envelopes (pipeline view)
- [x] Webhook handler for provider callbacks
- [x] Download signed document

### E-Signature Provider Adapters (Common Interface)
- [x] Define SigningProvider interface (createEnvelope, getStatus, downloadSigned, parseWebhook)
- [x] Firma.dev adapter ($0.029/envelope)
- [x] SignatureAPI adapter ($0.25/envelope)
- [x] DocuSeal adapter (open source)
- [x] PandaDocs adapter
- [x] DocuSign adapter
- [x] BoldSign adapter
- [x] eSignly adapter
- [x] Provider settings management (connect/disconnect/configure)

### Server-Side — AI Document Analysis
- [x] Analyze uploaded document with LLM (extract title, category, entities, summary)
- [x] Auto-suggest entity links based on document content
- [x] Auto-categorize documents (agreement, compliance, intake, profile, etc.)

### Vault UI
- [x] Vault main page with sidebar (Recents, Favorites, Company Repo, My Workspace, Collections)
- [x] Document list view with filters and search
- [x] Document detail view (metadata, entity links, signing history)
- [x] Manual upload flow with AI-powered prefill (drag & drop, AI analysis, entity tagging)
- [x] Folder navigation (create, rename)
- [x] Favorites management
- [x] Document actions (download, archive, share, view in source)

### Template Engine UI
- [x] Template Library page (list all registered templates with grid view)
- [x] Template registration dialog (name, type, Google Doc ID, merge fields)
- [x] Generation Modal (select template → fill merge fields → generate)

### Document Pipeline UI
- [x] Pipeline view (Kanban-style: Draft, Sent, Viewed, Signed, Declined)
- [x] List view with stage filtering and search
- [x] Signing Providers tab with cost comparison and configuration
- [x] Send for Signature dialog
- [x] Provider configuration dialog

### Entity Integration
- [x] Documents tab on Company Profile page
- [x] Documents tab on Contact Profile page (already existed with upload)
- [x] Link existing documents to entities via entity links

### Navigation
- [x] Add Vault to Intelligence domain tabs
- [x] Add Templates to Intelligence domain tabs
- [x] Add Pipeline to Intelligence domain tabs
- [x] Update sidebar matchPaths for new routes (/vault, /templates, /pipeline)

### Activity Log Extension
- [x] Log document.created, document.uploaded, document.signed events
- [x] Log document.sent_for_signature, document.viewed events

## v55 — Pipeline Fix + Google Drive/Docs/Sheets Integration

### Bug Fixes
- [x] Fix Pipeline page not loading (missing Check import + API response format mismatch)
- [x] Debug and resolve any console errors on Pipeline page

### Google OAuth Integration
- [x] Set up Google OAuth with Drive, Docs, Sheets scopes (expanded existing OAuth flow)
- [x] Store Google tokens per user in database (existing googleTokens table)
- [x] Token refresh flow for expired tokens (existing refresh mechanism)

### Google Drive Integration
- [x] Browse connected Google Drive folders from within portal (Google Drive tab in Vault)
- [x] Sync/index Drive files into Vault (Import to Vault button)
- [x] Create new folders in Drive from portal (createFolder in driveRouter)

### Google Docs Integration
- [x] Create new Google Docs from within the portal (New Doc button in Vault)
- [x] Open/edit Google Docs in new tab (Open in Google Docs link)
- [x] Use Google Docs as template source for Template Engine (generateFromTemplate)

### Google Sheets Integration
- [x] Create new Google Sheets from within the portal (New Sheet button in Vault)
- [x] Open/edit Google Sheets in new tab (Open in Google Sheets link)
- [x] Index Sheets into Vault with metadata (Import to Vault with readSheetData)

### Vault Enhancement
- [x] "New Document" and "New Spreadsheet" creation buttons in Vault
- [x] Google file type icons (Doc, Sheet, Slide) in document lists

## v56 — Vault UX Fixes + Entity Tagging + Shared Drive Import

### Bug Fixes
- [x] Fix document creation not working (diagnose and fix error)
- [x] Debug New Doc / New Sheet creation flow

### Settings Enhancement
- [x] Show "Connected to Google Drive, Google Docs, Google Sheets" status in Settings
- [x] Update re-authenticate button area with connection details

### Document Creation UX
- [x] Add category explanations/descriptions in document creation dialog
- [x] Add entity tagging (people/companies) to document creation flow
- [x] Tagged entities should show document in their profile

### Shared Drive Import
- [x] Import OMNISCOPE shared Google Drive folder into Vault
- [x] Support browsing shared drives (not just My Drive)

### Google APIs Enabled & Verified
- [x] Google Drive API enabled in Cloud Console (project 121903194822)
- [x] Google Docs API enabled in Cloud Console
- [x] Google Sheets API enabled in Cloud Console
- [x] Google Slides API enabled in Cloud Console (for future use)
- [x] Verified My Drive file browsing works (files, folders, sizes, dates)
- [x] Verified OMNISCOPE shared drive browsing works (Kinetix KYB, OTC Transactions, JUNAID, etc.)
- [x] Verified folder navigation within shared drive (breadcrumb trail)
- [x] Verified New Doc dialog with category explanations and entity tagging
- [x] Verified New Sheet dialog with category explanations and entity tagging
- [x] Verified Template registration dialog with Google Doc ID field
- [x] Verified Pipeline Kanban view (Draft/Sent/Viewed/Signed/Declined)
- [x] All 938 tests passing across 37 files

## v57 — Internal Document Viewer + Settings Cards + Smart Drive Import

### Settings Enhancement
- [x] Add Google Drive status card to Settings Integrations page (like Gmail/Calendar/Fathom)
- [x] Add Google Docs status card to Settings Integrations page
- [x] Add Google Sheets status card to Settings Integrations page
- [x] Show Active/Inactive status based on OAuth scopes granted
- [x] Update Scopes display in Permissions & Security section

### Internal Document Viewer
- [x] Build embedded document viewer page (/vault/doc/:id) that opens documents inside the portal
- [x] Render Google Docs as HTML internally (exported via Google Docs API, dark-themed)
- [x] Render Google Sheets as interactive tables internally (via Sheets API data)
- [x] Embed Google Slides via presentation embed iframe
- [x] Build PDF viewer for uploaded PDF documents (iframe)
- [x] Add document viewer toolbar with Info/Notes/Links panels
- [x] Add "Link to Contact/Company" button in viewer toolbar with entity search
- [x] Add "Notes" panel for leaving notes on documents (with Ctrl+Enter submit)
- [x] Add document metadata display (category, collection, visibility, dates, AI summary, signing history)
- [x] Update all document links to open internally instead of redirecting to Google
- [x] Add document_notes table to database schema
- [x] Add getNotes/addNote/deleteNote tRPC procedures
- [x] Add exportDocHtml tRPC procedure for Google Docs HTML export
- [x] Add fullscreen toggle and favorite button to viewer toolbar

### Smart OMNISCOPE Drive Import
- [x] Scan all files in OMNISCOPE shared drive recursively (scanDriveRecursive function)
- [x] Read document contents using Google Docs/Drive API
- [x] Use AI (LLM) to categorize each document (Agreement, Compliance, Intake Form, etc.)
- [x] Match documents to existing contacts/companies based on content
- [x] Create new contacts/companies if referenced entities don't exist
- [x] Import all files into Vault with proper categories and entity links
- [x] Organize into appropriate collections (Company Repository, Counterparty Files, etc.)
- [x] Add "Import All to Vault" button in Drive browser (appears when viewing shared drive)
- [x] Show import progress and results dialog with stats
- [x] Skip already-imported files automatically
- [x] All 938 tests passing across 37 files

## v58 — Rollback & Vault Reset
- [x] Rolled back code to v57 (internal document viewer, settings cards, smart import intact)
- [x] Cleared all documents from Vault (fresh start for NCNDA use going forward)
- [x] Cleared all entity links, notes, favorites, and signing envelopes

## v59 — Custom Folders, Drive Copy/Move, Access Tagging

### Custom Folder System
- [x] Create folders in the Vault with custom names (New Folder dialog)
- [x] Nested subfolders (parent-child hierarchy with parentId)
- [x] Folder navigation with breadcrumbs
- [x] Rename folders (via context menu)
- [x] Delete folders with confirmation (documents moved to root)
- [x] Folder context menu (rename, delete, share)
- [x] Backend: createFolder, updateFolder, deleteFolder, listFolders, getFolderContents procedures
- [x] Backend: moveDocumentToFolder procedure

### Move/Copy from Google Drive
- [x] "Add" dropdown on Drive files with Quick Import and Copy to Folder options
- [x] Copy to Vault Folder dialog with folder picker (CopyToVaultFolderPicker)
- [x] Folder picker with breadcrumb navigation and nested folder browsing
- [x] Quick Import (root level) still available
- [x] Backend: copyToVault procedure in drive router

### Access Tagging (Permissions)
- [x] documentAccess table already exists with view/edit/admin permission levels
- [x] Share/Access dialog for both documents and folders
- [x] Search contacts to grant access with permission level selector
- [x] View and revoke existing access from Share dialog
- [x] Backend: grantAccess, revokeAccess, getAccessList procedures
- [x] All 938 tests passing across 37 files

## v60 — Folder Browsing UX

### Folder Display & Navigation
- [x] Show created folders in the Vault main view ("My Folders" section on home/recents view)
- [x] Click into folders to see their contents (documents + subfolders)
- [x] Breadcrumb navigation when inside a folder (Root → Folder Name)
- [x] Back button to return to parent folder
- [x] Folder context menus (rename, delete, share) on home view folder cards
- [x] Empty folder state with actionable buttons (Upload, New Doc, New Folder)
- [x] rootFolders query enabled on recents view for immediate folder visibility
- [x] Folder mutations (create, rename, delete) all refetch rootFolders for instant updates
- [x] Wider folder cards (4-column grid) to show full folder names
- [x] All 938 tests passing across 37 files
