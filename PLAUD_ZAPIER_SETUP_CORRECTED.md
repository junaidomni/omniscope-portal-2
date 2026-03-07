# Plaud + Zapier Integration Setup Guide (CORRECTED)

## Overview

This guide walks you through setting up automatic ingestion of Plaud meeting transcripts and summaries into OmniScope Intelligence Portal via Zapier.

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
OmniScope Portal (ingests meeting)
```

---

## Webhook Endpoint

**URL:** `https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook`

**Method:** POST

**Content-Type:** application/json

---

## Payload Format (IMPORTANT)

The payload MUST be wrapped in a `json` key for tRPC compatibility:

```json
{
  "json": {
    "plaudWebhookSecret": "Omniscopex2026!",
    "title": "Meeting Title from Plaud",
    "summary": "Meeting summary from Plaud",
    "transcript": "Full transcript (optional)",
    "createdAt": "2026-03-07T14:30:00Z"
  }
}
```

---

## Zapier Configuration

### Step 1: Create Trigger
- Search for: **Plaud**
- Select trigger: **New Transcript Summary**
- Connect your Plaud account

### Step 2: Create Action
- Search for: **Webhooks by Zapier**
- Select action: **POST**

### Step 3: Configure Webhook
- **URL:** `https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook`
- **Method:** POST
- **Payload Type:** JSON

### Step 4: Map Data
In the **Data** field, enter:

```json
{
  "json": {
    "plaudWebhookSecret": "Omniscopex2026!",
    "title": {{title}},
    "summary": {{summary}},
    "transcript": {{transcript}},
    "createdAt": {{created_at}}
  }
}
```

---

## Testing

### Test with cURL:

```bash
curl -X POST https://omniscope.manus.space/api/trpc/ingestion.plaudWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "json": {
      "plaudWebhookSecret": "Omniscopex2026!",
      "title": "Test Meeting",
      "summary": "Test summary",
      "createdAt": "2026-03-07T14:30:00Z"
    }
  }'
```

### Success Response:

```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "meetingId": 1140002
      }
    }
  }
}
```

---

## Field Mapping

| Payload Field | Plaud Field | Required |
|---|---|---|
| `json.title` | Title | ✅ Yes |
| `json.summary` | Summary | ✅ Yes |
| `json.transcript` | Full Transcript | ❌ No |
| `json.createdAt` | Created At (ISO 8601) | ✅ Yes |
| `json.plaudWebhookSecret` | (Static Value) | ✅ Yes |

---

## Troubleshooting

### Error: "Invalid webhook secret"
- Verify the secret is exactly: `Omniscopex2026!`
- Check for extra spaces or quotes

### Error: "Missing required fields"
- Ensure all required fields are present: title, summary, createdAt, plaudWebhookSecret
- Check field names match exactly (case-sensitive)

### Meeting not appearing in OmniScope
- Verify webhook returned `"success": true`
- Check OmniScope Intelligence → Meetings for the new entry
- Look for meetings with source tag "Plaud"

---

## Support

For issues:
- Check Zapier task history for error details
- Verify webhook secret matches
- Contact: support@omniscopex.ae
