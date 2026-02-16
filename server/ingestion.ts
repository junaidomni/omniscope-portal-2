import { z } from "zod";
import * as db from "./db";
import { generateAndUploadBrandedReport } from "./brandedReportGenerator";

/**
 * Schema for the intelligence data JSON sent from the Manus AI processing engine
 */
export const IntelligenceDataSchema = z.object({
  // Metadata
  meetingTitle: z.string().optional(),
  meetingDate: z.string(),
  primaryLead: z.string().optional(),
  primarylead: z.string().optional(),
  participants: z.union([z.array(z.string()), z.string()]).transform(val => 
    typeof val === 'string' ? [val] : val
  ),
  organizations: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  jurisdictions: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  
  // Intelligence Content
  executiveSummary: z.string(),
  strategicHighlights: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  opportunities: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  risks: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  keyQuotes: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  actionItems: z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).optional().transform(val => 
    val === null || val === undefined || val === '' ? [] : typeof val === 'string' ? [val] : val
  ),
  intelligenceData: z.record(z.string(), z.any()).optional(),
  
  // Full transcript (accept both 'transcript' and 'fullTranscript')
  transcript: z.string().optional(),
  fullTranscript: z.string().optional(),
  
  // Source tracking (make sourceType optional and default to 'plaud')
  sourceType: z.enum(["plaud", "fathom", "manual"]).optional().default("plaud"),
  sourceId: z.string().optional(),
  
  // Tags (accept both array and string formats)
  tags: z.union([z.array(z.string()), z.string()]).optional().transform(val => 
    val === undefined ? [] : typeof val === 'string' ? [val] : val
  ),
  sectors: z.union([z.array(z.string()), z.string()]).optional().transform(val => 
    val === undefined ? [] : typeof val === 'string' ? [val] : val
  ),
  jurisdictionTags: z.union([z.array(z.string()), z.string()]).optional().transform(val => 
    val === undefined ? [] : typeof val === 'string' ? [val] : val
  ),
});

export type IntelligenceData = z.infer<typeof IntelligenceDataSchema>;

/**
 * Normalize the data to handle case-insensitive field names from Zapier
 */
function normalizeIntelligenceData(data: IntelligenceData) {
  return {
    ...data,
    primaryLead: data.primaryLead || data.primarylead || "Unknown",
  };
}

/**
 * Process incoming intelligence data and store it in the database
 */
export async function processIntelligenceData(rawData: IntelligenceData, createdBy?: number) {
  // Normalize field names
  const data = normalizeIntelligenceData(rawData);
  
  // Check for duplicate by sourceId
  if (data.sourceId) {
    const existing = await db.getMeetingsBySourceId(data.sourceId);
    if (existing.length > 0) {
      console.log(`[Ingestion] Duplicate meeting detected with sourceId: ${data.sourceId}`);
      return { success: false, reason: "duplicate", meetingId: existing[0]?.id };
    }
  }

  // Create the meeting
  const meetingId = await db.createMeeting({
    meetingTitle: (rawData as any).meetingTitle || null,
    meetingDate: new Date(data.meetingDate),
    primaryLead: data.primaryLead,
    participants: JSON.stringify(data.participants),
    organizations: data.organizations ? JSON.stringify(data.organizations) : null,
    jurisdictions: data.jurisdictions ? JSON.stringify(data.jurisdictions) : null,
    executiveSummary: data.executiveSummary,
    strategicHighlights: data.strategicHighlights ? JSON.stringify(data.strategicHighlights) : null,
    opportunities: data.opportunities ? JSON.stringify(data.opportunities) : null,
    risks: data.risks ? JSON.stringify(data.risks) : null,
    keyQuotes: data.keyQuotes ? JSON.stringify(data.keyQuotes) : null,
    intelligenceData: data.intelligenceData ? JSON.stringify(data.intelligenceData) : null,
    fullTranscript: data.fullTranscript ?? null,
    sourceType: data.sourceType,
    sourceId: data.sourceId ?? null,
    createdBy: createdBy ?? null,
  });

  // Process sector tags
  if (data.sectors && data.sectors.length > 0) {
    for (const sectorName of data.sectors) {
      const tag = await db.getOrCreateTag(sectorName, "sector");
      if (tag) {
        await db.addTagToMeeting(meetingId, tag.id);
      }
    }
  }

  // Process jurisdiction tags
  if (data.jurisdictionTags && data.jurisdictionTags.length > 0) {
    for (const jurisdictionName of data.jurisdictionTags) {
      const tag = await db.getOrCreateTag(jurisdictionName, "jurisdiction");
      if (tag) {
        await db.addTagToMeeting(meetingId, tag.id);
      }
    }
  }

  // Process action items
  if (data.actionItems && data.actionItems.length > 0) {
    for (const item of data.actionItems) {
      // Handle both string and object formats
      let taskTitle: string;
      let taskDescription: string | null = null;
      let taskPriority: "low" | "medium" | "high" = "medium";
      let assignedToName: string | null = null;
      let taskDueDate: Date | null = null;
      
      if (typeof item === 'string') {
        taskTitle = item;
      } else {
        taskTitle = (item as any).title;
        taskDescription = (item as any).description ?? null;
        taskPriority = (item as any).priority ?? "medium";
        assignedToName = (item as any).assignedTo ?? null;
        taskDueDate = (item as any).dueDate ? new Date((item as any).dueDate) : null;
      }
      
      // Try to find user by name if assignedTo is provided
      let assignedUserId: number | null = null;
      if (assignedToName) {
        const users = await db.getAllUsers();
        const user = users.find(u => u.name?.toLowerCase() === assignedToName.toLowerCase());
        if (user) {
          assignedUserId = user.id;
        }
      }

      await db.createTask({
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        assignedTo: assignedUserId,
        meetingId: meetingId,
        dueDate: taskDueDate,
        isAutoGenerated: true,
        createdBy: createdBy ?? null,
      });
    }
  }

  // Generate and upload branded report
  let brandedReportUrl: string | null = null;
  try {
    brandedReportUrl = await generateAndUploadBrandedReport(meetingId);
    // Update meeting with branded report URL
    await db.updateMeeting(meetingId, { brandedReportUrl });
    console.log(`[Ingestion] Generated branded report: ${brandedReportUrl}`);
  } catch (error) {
    console.error(`[Ingestion] Failed to generate branded report:`, error);
  }

  console.log(`[Ingestion] Successfully processed meeting ${meetingId} from ${data.sourceType}`);
  
  return { success: true, meetingId, brandedReportUrl };
}

/**
 * Validate and parse intelligence data from webhook
 */
export function validateIntelligenceData(rawData: unknown): IntelligenceData | null {
  try {
    return IntelligenceDataSchema.parse(rawData);
  } catch (error) {
    console.error("[Ingestion] Validation error:", error);
    return null;
  }
}
