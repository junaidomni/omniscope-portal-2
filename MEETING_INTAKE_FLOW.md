# Meeting Intake Flow: Fathom & Plaud → OmniScope

## Overview

OmniScope automatically ingests, processes, and extracts intelligence from meetings captured by **Fathom AI** and **Plaud** hardware devices. This document explains the complete end-to-end flow from external meeting sources to task creation and assignment.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL MEETING SOURCES                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                           ┌──────────────┐        │
│  │  Fathom AI   │                           │    Plaud     │        │
│  │              │                           │   Hardware   │        │
│  │ • Records    │                           │              │        │
│  │ • Transcribes│                           │ • Records    │        │
│  │ • Summarizes │                           │ • Uploads    │        │
│  └──────┬───────┘                           └──────┬───────┘        │
│         │                                          │                │
│         │ Webhook                                  │ Zapier         │
│         │ POST /api/webhook/fathom                 │ Webhook        │
│         │                                          │ POST /api/     │
│         │                                          │ webhook/plaud  │
└─────────┼──────────────────────────────────────────┼────────────────┘
          │                                          │
          │                                          │
          ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OMNISCOPE BACKEND                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 1: Webhook Reception & Validation                      │  │
│  │  • server/webhookRoute.ts                                     │  │
│  │  • Validates payload structure                                │  │
│  │  • Routes to appropriate integration handler                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 2A: Fathom Processing                                  │  │
│  │  • server/fathomIntegration.ts                                │  │
│  │  • Extracts participants, organizations, transcript           │  │
│  │  • Calls LLM for deep analysis                                │  │
│  │  • Generates structured action items with assignments         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 2B: Plaud Processing                                   │  │
│  │  • server/webhookRoute.ts (Plaud endpoint)                    │  │
│  │  • Transforms Zapier format to OmniScope format               │  │
│  │  • Passes to ingestion pipeline                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 3: Core Ingestion Pipeline                             │  │
│  │  • server/ingestion.ts → processIntelligenceData()            │  │
│  │  • Checks for duplicates (sourceId)                           │  │
│  │  • Creates meeting record in database                         │  │
│  │  • Processes tags (sectors, jurisdictions)                    │  │
│  │  • Generates branded PDF report                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 4: Task Extraction & Assignment                        │  │
│  │  • server/ingestion.ts lines 143-186                          │  │
│  │  • Loops through actionItems array                            │  │
│  │  • Handles both string and structured object formats          │  │
│  │  • Matches assignedTo names to user IDs                       │  │
│  │  • Creates tasks with priority, due dates, descriptions       │  │
│  │  • Links tasks to meeting via meetingId                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 5: CRM Automation                                      │  │
│  │  • server/ingestion.ts lines 199-296                          │  │
│  │  • Creates/updates contacts for participants                  │  │
│  │  • Creates interaction timeline entries                       │  │
│  │  • Links companies (as pending suggestions)                   │  │
│  │  • Updates lastInteractionAt timestamps                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE STORAGE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • meetings table (core meeting data)                                │
│  • tasks table (action items with assignments)                       │
│  • contacts table (participants become contacts)                     │
│  • companies table (organizations mentioned)                         │
│  • interactions table (meeting timeline entries)                     │
│  • tags table (sectors, jurisdictions)                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow Breakdown

### 1. Fathom Integration

**Connection Method:** Webhook (push-based)

**Setup:**
- Fathom API key stored in `FATHOM_API_KEY` environment variable
- Webhook registered at Fathom pointing to: `https://your-domain.com/api/webhook/fathom`
- Fathom sends POST request after each meeting ends

**Payload Structure:**
```typescript
{
  title: "Client Strategy Call",
  meeting_title: "Client Strategy Call",
  url: "https://fathom.video/xyz123",
  share_url: "https://fathom.video/share/xyz123",
  created_at: "2026-02-23T10:00:00Z",
  recording_start_time: "2026-02-23T10:00:00Z",
  recording_end_time: "2026-02-23T11:00:00Z",
  recorded_by: {
    name: "Junaid Qureshi",
    email: "junaid@omniscopex.ae"
  },
  transcript: [
    {
      speaker: { display_name: "Junaid Qureshi" },
      text: "Let's discuss the Q2 strategy...",
      timestamp: "00:00:15"
    }
  ],
  default_summary: {
    template_name: "Standard",
    markdown_formatted: "## Meeting Summary\n..."
  },
  action_items: [
    {
      description: "Follow up with client on proposal",
      assignee: { name: "Kyle" },
      user_generated: false
    }
  ],
  calendar_invitees: [
    {
      name: "Client Name",
      email: "client@company.com"
    }
  ]
}
```

**Processing Steps:**

1. **Webhook Reception** (`server/webhookRoute.ts:135`)
   - Validates payload structure with `isFathomWebhookPayload()`
   - Routes to `processFathomWebhook()`

2. **LLM Analysis** (`server/fathomIntegration.ts:227`)
   - Extracts participants from transcript speakers + calendar invitees
   - Identifies organizations from email domains
   - Determines primary lead (who recorded the meeting)
   - Sends transcript + Fathom summary to LLM with prompt:
     ```
     Analyze this meeting and extract:
     - Executive summary (2-3 sentences)
     - Strategic highlights (key insights)
     - Action items with:
       * Title (concise task description)
       * Description (context and details)
       * Assigned to (person's name from participants)
       * Priority (low/medium/high)
       * Due date (inferred from urgency)
     ```

3. **Structured Data Extraction** (`server/fathomIntegration.ts:378`)
   - LLM returns JSON with structured action items:
     ```json
     {
       "executiveSummary": "...",
       "strategicHighlights": ["...", "..."],
       "actionItems": [
         {
           "title": "Follow up with client on proposal",
           "description": "Send revised proposal addressing pricing concerns",
           "assignedTo": "Kyle",
           "priority": "high",
           "dueDate": "2026-02-28"
         }
       ]
     }
     ```

4. **Ingestion** (`server/fathomIntegration.ts:451`)
   - Transforms to OmniScope intelligence format
   - Passes to `processIntelligenceData()` for storage

---

### 2. Plaud Integration

**Connection Method:** Zapier Webhook (push-based)

**Setup:**
- Plaud device uploads recordings to Plaud cloud
- Zapier automation triggers on new recording
- Zapier sends POST to: `https://your-domain.com/api/webhook/plaud`

**Payload Structure:**
```typescript
{
  sourceId: "plaud-recording-12345",
  meetingDate: "2026-02-23T14:30:00Z",
  primaryLead: "Junaid",
  participants: "Kyle, Client A, Client B",
  executiveSummary: "Discussed partnership opportunities...",
  transcript: "Full transcript text...",
  tags: ["partnership", "Q2"],
  plaud: {
    title: "Partnership Discussion",
    duration: 3600
  }
}
```

**Processing Steps:**

1. **Webhook Reception** (`server/webhookRoute.ts:72`)
   - Validates required fields (sourceId, meetingDate, executiveSummary)
   - Transforms Zapier format to OmniScope intelligence format

2. **Direct Ingestion** (`server/webhookRoute.ts:92`)
   - No LLM analysis (assumes Zapier already processed)
   - Passes directly to `processIntelligenceData()`

---

### 3. Core Ingestion Pipeline

**File:** `server/ingestion.ts`

**Function:** `processIntelligenceData(rawData, createdBy, orgId)`

**Steps:**

1. **Duplicate Check** (lines 83-89)
   ```typescript
   if (data.sourceId) {
     const existing = await db.getMeetingsBySourceId(data.sourceId);
     if (existing.length > 0) {
       return { success: false, reason: "duplicate" };
     }
   }
   ```

2. **Create Meeting Record** (lines 92-110)
   ```typescript
   const meetingId = await db.createMeeting({
     orgId,
     meetingTitle,
     meetingDate: new Date(data.meetingDate),
     primaryLead,
     participants: JSON.stringify(data.participants),
     organizations: JSON.stringify(data.organizations),
     executiveSummary,
     strategicHighlights: JSON.stringify(data.strategicHighlights),
     fullTranscript,
     sourceType: "fathom" | "plaud" | "manual",
     sourceId,
     createdBy
   });
   ```

3. **Process Tags** (lines 113-130)
   - Creates/links sector tags
   - Creates/links jurisdiction tags
   - Adds meeting type category

4. **Generate Branded Report** (lines 189-197)
   - Calls `generateAndUploadBrandedReport(meetingId)`
   - Creates PDF with OmniScope branding
   - Uploads to S3
   - Stores URL in meeting record

---

### 4. Task Extraction & Assignment

**File:** `server/ingestion.ts` (lines 143-186)

**Logic:**

```typescript
if (data.actionItems && data.actionItems.length > 0) {
  for (const item of data.actionItems) {
    // Handle both string and object formats
    let taskTitle: string;
    let taskDescription: string | null = null;
    let taskPriority: "low" | "medium" | "high" = "medium";
    let assignedToName: string | null = null;
    let taskDueDate: Date | null = null;
    
    if (typeof item === 'string') {
      // Simple string format: "Follow up with client"
      taskTitle = item;
    } else {
      // Structured object format (from Fathom LLM analysis)
      taskTitle = item.title;
      taskDescription = item.description ?? null;
      taskPriority = item.priority ?? "medium";
      assignedToName = item.assignedTo ?? null;
      taskDueDate = item.dueDate ? new Date(item.dueDate) : null;
    }
    
    // Try to find user by name if assignedTo is provided
    let assignedUserId: number | null = null;
    if (assignedToName) {
      const users = await db.getAllUsers();
      const user = users.find(u => 
        u.name?.toLowerCase() === assignedToName.toLowerCase()
      );
      if (user) {
        assignedUserId = user.id;
      }
    }

    // Create task in database
    await db.createTask({
      orgId,
      title: taskTitle,
      description: taskDescription,
      priority: taskPriority,
      assignedTo: assignedUserId,        // User ID (for platform users)
      assignedName: assignedToName,      // Name (for non-users)
      meetingId: meetingId,              // Link to source meeting
      dueDate: taskDueDate,
      isAutoGenerated: true,             // Flag as AI-generated
      createdBy: createdBy
    });
  }
}
```

**Assignment Logic:**

1. **Name Matching:**
   - LLM extracts assignee name from meeting context
   - System searches `users` table for matching name (case-insensitive)
   - If found: sets `assignedTo` (user ID) + `assignedName`
   - If not found: sets only `assignedName` (pending user)

2. **Priority Inference:**
   - LLM analyzes urgency keywords ("urgent", "ASAP", "critical")
   - Assigns priority: low | medium | high
   - Default: medium

3. **Due Date Inference:**
   - LLM looks for time references ("by Friday", "next week", "EOD")
   - Converts to actual date
   - Default: null (no due date)

**Example:**

**Input (from Fathom LLM):**
```json
{
  "actionItems": [
    {
      "title": "Send revised proposal to client",
      "description": "Address pricing concerns raised in meeting",
      "assignedTo": "Kyle",
      "priority": "high",
      "dueDate": "2026-02-25"
    },
    {
      "title": "Schedule follow-up call",
      "assignedTo": "Junaid",
      "priority": "medium",
      "dueDate": "2026-02-28"
    }
  ]
}
```

**Output (tasks table):**
```
┌────┬──────────────────────────────┬────────────┬──────────┬────────────┬────────────┐
│ id │ title                        │ assignedTo │ priority │ dueDate    │ meetingId  │
├────┼──────────────────────────────┼────────────┼──────────┼────────────┼────────────┤
│ 1  │ Send revised proposal...     │ 2 (Kyle)   │ high     │ 2026-02-25 │ 123        │
│ 2  │ Schedule follow-up call      │ 1 (Junaid) │ medium   │ 2026-02-28 │ 123        │
└────┴──────────────────────────────┴────────────┴──────────┴────────────┴────────────┘
```

---

### 5. CRM Automation

**File:** `server/ingestion.ts` (lines 199-296)

**Automatic Actions:**

1. **Contact Creation** (lines 206-230)
   ```typescript
   for (const participantName of participants) {
     // Skip internal team members
     const internalNames = ["junaid", "kyle", "jake", "sania"];
     const isInternal = internalNames.some(n => 
       participantName.toLowerCase().includes(n)
     );
     
     // Get or create contact (with deduplication)
     const contactRecord = await db.getOrCreateContact(
       participantName,
       undefined,
       participantEmails[i],
       createdBy
     );
     
     // Link contact to meeting
     await db.linkContactToMeeting(meetingId, contactId);
     
     // Update source if not set
     if (!contactRecord.source) {
       await db.updateContact(contactId, { 
         source: data.sourceType  // "fathom" or "plaud"
       });
     }
   }
   ```

2. **Interaction Timeline** (lines 238-257)
   ```typescript
   await db.createInteraction({
     type: "meeting",
     timestamp: new Date(data.meetingDate),
     contactId,
     companyId: contactRecord.companyId,
     sourceRecordId: meetingId,
     sourceType: "meeting",
     summary: data.executiveSummary.substring(0, 500),
     details: JSON.stringify({
       meetingTitle,
       participants,
       actionItemCount: data.actionItems?.length || 0
     })
   });
   ```

3. **Company Linking** (lines 259-289)
   - Extracts organizations from meeting data
   - Creates company records (as "pending" approval status)
   - Creates pending suggestions (not auto-linked)
   - User reviews and approves in CRM UI

---

## User Notification Flow

**Current State:** Tasks are created but assignees are NOT automatically notified.

**Notification Triggers (to be implemented):**

1. **Task Assignment Notification:**
   - When `assignedTo` is set (user ID found)
   - Send email/in-app notification to assigned user
   - Include: task title, due date, meeting link, priority

2. **Daily Digest:**
   - Send daily summary of new tasks assigned to user
   - Group by priority and due date
   - Include links to meetings and task details

3. **Due Date Reminders:**
   - Send reminder 24 hours before due date
   - Send reminder on due date morning
   - Escalate if overdue

**Implementation Path:**

```typescript
// In server/ingestion.ts after createTask()
if (assignedUserId) {
  await notifyOwner({
    title: `New Task Assigned: ${taskTitle}`,
    content: `
      Priority: ${taskPriority}
      Due: ${taskDueDate || 'No due date'}
      Meeting: ${meetingTitle}
      
      ${taskDescription}
    `
  });
}
```

---

## Data Flow Summary

```
Fathom/Plaud Meeting
    ↓
Webhook POST to OmniScope
    ↓
Payload Validation
    ↓
LLM Analysis (Fathom only)
    ↓
Extract: summary, highlights, action items, participants, organizations
    ↓
Create Meeting Record (meetings table)
    ↓
Create Tasks (tasks table)
    ├─ Match assignee names to user IDs
    ├─ Set priority (low/medium/high)
    ├─ Set due dates
    └─ Link to meeting via meetingId
    ↓
Create Contacts (contacts table)
    ├─ Deduplicate by name/email
    ├─ Set source (fathom/plaud)
    └─ Link to meeting
    ↓
Create Interactions (interactions table)
    └─ Timeline entry for each contact
    ↓
Create Company Suggestions (pending_suggestions table)
    └─ User reviews and approves
    ↓
Generate Branded PDF Report
    └─ Upload to S3, store URL
    ↓
Return Success Response
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/webhookRoute.ts` | Webhook endpoints for Fathom, Plaud, and universal ingestion |
| `server/fathomIntegration.ts` | Fathom-specific processing, LLM analysis, structured extraction |
| `server/ingestion.ts` | Core ingestion pipeline, task creation, CRM automation |
| `server/db.ts` | Database operations (createMeeting, createTask, getOrCreateContact) |
| `drizzle/schema.ts` | Database schema definitions |
| `server/brandedReportGenerator.ts` | PDF report generation |

---

## Testing & Validation

**Test Files:**
- `server/fathom.test.ts` - Fathom API connectivity tests
- `server/fathomIntegration.test.ts` - Payload validation tests
- `server/intelligence.test.ts` - End-to-end ingestion tests

**Manual Testing:**

1. **Trigger Fathom Webhook:**
   ```bash
   curl -X POST https://your-domain.com/api/webhook/fathom \
     -H "Content-Type: application/json" \
     -d @fathom-sample-payload.json
   ```

2. **Trigger Plaud Webhook:**
   ```bash
   curl -X POST https://your-domain.com/api/webhook/plaud \
     -H "Content-Type: application/json" \
     -d @plaud-sample-payload.json
   ```

3. **Verify in Database:**
   ```sql
   SELECT * FROM meetings ORDER BY id DESC LIMIT 1;
   SELECT * FROM tasks WHERE meetingId = <meeting_id>;
   SELECT * FROM contacts WHERE source IN ('fathom', 'plaud');
   ```

---

## Future Enhancements

1. **Real-time Notifications:**
   - WebSocket push notifications for new task assignments
   - Email digests for daily task summaries
   - Slack/Discord integration for team notifications

2. **Smart Assignment:**
   - ML model to predict best assignee based on:
     * Past meeting participation
     * Expertise area (from contact tags)
     * Current workload (task count)
     * Availability (calendar integration)

3. **Task Dependencies:**
   - Extract task relationships from meeting context
   - Create dependency chains (Task B depends on Task A)
   - Auto-schedule based on dependencies

4. **Meeting Insights Dashboard:**
   - Visualize meeting frequency by contact/company
   - Track action item completion rates
   - Identify bottlenecks (overdue tasks by assignee)

---

## Troubleshooting

**Common Issues:**

1. **Duplicate meetings created:**
   - Check if `sourceId` is unique
   - Verify Fathom webhook isn't firing multiple times

2. **Tasks not assigned to correct user:**
   - Check if user name in database matches LLM-extracted name
   - Add name aliases in users table

3. **Contacts not created:**
   - Check if participant names are being extracted correctly
   - Verify internal name filter isn't blocking external contacts

4. **Webhook not receiving data:**
   - Check Fathom webhook configuration
   - Verify endpoint is publicly accessible (not localhost)
   - Check firewall/CORS settings

---

## Conclusion

The OmniScope meeting intake system provides a fully automated pipeline from external meeting sources (Fathom, Plaud) to actionable intelligence (tasks, contacts, interactions). The LLM-powered analysis ensures high-quality task extraction with proper assignments, priorities, and due dates, while the CRM automation maintains a complete relationship history.
