# Plaud + Zapier Integration Setup Guide

## Overview

This guide walks you through setting up automatic ingestion of Plaud meeting transcripts, summaries, and action items into OmniScope Intelligence Portal via Zapier.

**Flow:**
```
Plaud Note Pro (records meeting)
  ↓
Plaud App (processes transcript + summary)
  ↓
Zapier Trigger (detects new transcript)
  ↓
Zapier Action (sends to OmniScope webhook)
  ↓
OmniScope Portal (ingests meeting + creates tasks)
```

---

## Prerequisites

- **Plaud Note Pro** device (or other Plaud device)
- **Plaud account** with transcripts enabled
- **Zapier account** (free tier works)
- **OmniScope Portal** running (with webhook endpoint deployed)

---

## Step 1: Get Your Webhook Secret

The webhook secret is already set in your environment as `PLAUD_WEBHOOK_SECRET`. This secret must be included in every Zapier request to authenticate.

**To view your secret** (ask your admin):
```bash
echo $PLAUD_WEBHOOK_SECRET
```

---

## Step 2: Set Up Zapier Workflow

### 2.1 Create a New Zap

1. Go to **Zapier.com** → **Create** → **New Zap**
2. Choose a name: `Plaud → OmniScope Intelligence`

### 2.2 Configure the Trigger

1. **Search for app:** Type "Plaud"
2. **Select trigger:** "New Transcript Summary" (or "New Transcript")
3. **Connect your Plaud account:**
   - Click "Connect a new account"
   - Log in with your Plaud credentials
   - Authorize Zapier access
4. **Test the trigger:**
   - Click "Test trigger"
   - Zapier will fetch a recent transcript as sample data

### 2.3 Configure the Action

1. **Search for app:** Type "Webhooks by Zapier"
2. **Select action:** "POST"
3. **Configure the webhook:**

| Field | Value |
|-------|-------|
| **URL** | `https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook` |
| **Method** | POST |
| **Payload Type** | JSON |

### 2.4 Map the Payload

In the **Data** section, configure the JSON payload:

```json
{
  "plaudWebhookSecret": "YOUR_WEBHOOK_SECRET_HERE",
  "title": "INSERT_TITLE_HERE",
  "summary": "INSERT_SUMMARY_HERE",
  "createdAt": "INSERT_CREATED_AT_HERE",
  "participants": ["INSERT_PARTICIPANTS_HERE"],
  "actionItems": [
    {
      "item": "INSERT_ACTION_ITEM_HERE",
      "assignee": "INSERT_ASSIGNEE_HERE",
      "dueDate": "INSERT_DUE_DATE_HERE"
    }
  ]
}
```

**Map Plaud fields to the payload:**

Use Zapier's field mapper to insert Plaud data:

| Payload Field | Plaud Field | Example |
|---------------|-------------|---------|
| `title` | Meeting Title | `Redd Carbon Credits - Q1 Review` |
| `summary` | Summary | `Discussed carbon offset pricing...` |
| `createdAt` | Created At (ISO format) | `2026-03-07T14:30:00Z` |
| `participants` | Participants (array) | `["Kyle Jackson", "John Smith"]` |
| `actionItems[].item` | Action Items | `Follow up on proposal` |
| `actionItems[].assignee` | Assignee | `Kyle Jackson` |
| `actionItems[].dueDate` | Due Date | `2026-03-15` |

**Example Zapier mapping:**
```
{
  "plaudWebhookSecret": "YOUR_SECRET",
  "title": {{title}},
  "summary": {{summary}},
  "createdAt": {{created_at}},
  "participants": {{participants}},
  "actionItems": {{action_items}}
}
```

---

## Step 3: Test the Integration

### 3.1 Send a Test Request

1. In Zapier, click **"Test action"**
2. Zapier will send a test payload to your webhook
3. Check the response:
   - **Success:** `{ "success": true, "meetingId": 1110042 }`
   - **Error:** Check the error message and webhook secret

### 3.2 Verify in OmniScope

1. Go to **OmniScope Intelligence Portal**
2. Navigate to **Intelligence** → **Meetings**
3. Look for a new meeting with:
   - Source: **Plaud** (badge)
   - Title: From Plaud transcript
   - Summary: From Plaud summary
   - Participants: From Plaud participants
   - Action Items: Extracted as tasks

---

## Step 4: Deploy the Zap

1. Click **"Publish"** in Zapier
2. Zap is now **LIVE** — Plaud meetings will auto-ingest

---

## Webhook Endpoint Reference

### URL
```
POST https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook
```

### Request Headers
```
Content-Type: application/json
```

### Request Body

```typescript
{
  // Required: Webhook authentication secret
  plaudWebhookSecret: string;
  
  // Required: Meeting title
  title: string;
  
  // Required: AI-generated summary
  summary: string;
  
  // Required: ISO 8601 timestamp (e.g., "2026-03-07T14:30:00Z")
  createdAt: string;
  
  // Optional: Array of participant names
  participants?: string[];
  
  // Optional: Array of action items
  actionItems?: Array<{
    item: string;              // Action item text
    assignee?: string;         // Person responsible (optional)
    dueDate?: string;          // ISO date (optional)
  }>;
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "meetingId": 1110042
}
```

**Error (400):**
```json
{
  "error": "Invalid webhook secret"
}
```

**Error (500):**
```json
{
  "error": "Failed to ingest Plaud meeting"
}
```

---

## Troubleshooting

### Webhook Secret Mismatch
- **Error:** `Invalid webhook secret`
- **Fix:** Verify the `PLAUD_WEBHOOK_SECRET` in your Zapier action matches the environment variable

### Meeting Not Appearing
- **Check:** Is Zapier showing "Task completed successfully"?
- **Check:** Is the webhook returning `{ "success": true }`?
- **Check:** Go to OmniScope **Intelligence** → **Meetings** and search by title

### Duplicate Meetings
- **Cause:** Zapier retry logic or manual re-run
- **Fix:** OmniScope automatically prevents duplicates using `sourceId` (Plaud-generated unique ID)

### Missing Participants or Action Items
- **Cause:** Plaud didn't extract them
- **Fix:** Verify Plaud transcript includes participant names and action items

---

## Advanced: Manual Testing with cURL

Test the webhook locally without Zapier:

```bash
curl -X POST https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "plaudWebhookSecret": "YOUR_SECRET",
    "title": "Test Meeting",
    "summary": "This is a test summary.",
    "createdAt": "2026-03-07T14:30:00Z",
    "participants": ["Kyle Jackson"],
    "actionItems": [
      {
        "item": "Follow up on proposal",
        "assignee": "Kyle Jackson",
        "dueDate": "2026-03-15"
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "meetingId": 1110042
}
```

---

## Security Notes

1. **Webhook Secret:** Keep `PLAUD_WEBHOOK_SECRET` confidential. Only share with trusted Zapier admins.
2. **HTTPS Only:** The webhook endpoint requires HTTPS (Zapier enforces this).
3. **Rate Limiting:** OmniScope allows unlimited webhook calls (no throttling).
4. **Idempotency:** Each Plaud meeting gets a unique `sourceId` — duplicate submissions are rejected.

---

## Support

For issues or questions:
- Check the **Zapier task history** for error logs
- Review **OmniScope server logs** for webhook errors
- Contact: support@omniscopex.ae

---

## Next Steps

1. ✅ Webhook endpoint is live and tested
2. ✅ Zapier workflow is configured
3. ✅ Plaud meetings auto-ingest to OmniScope
4. **Future:** Add UI badge to show "Recorded with Plaud"
5. **Future:** Implement speaker identification from Plaud transcript
