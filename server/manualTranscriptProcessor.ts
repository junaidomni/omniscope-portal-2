import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { processIntelligenceData, type IntelligenceData, validateIntelligenceData } from "./ingestion";
import { storagePut } from "./storage";

/**
 * Manual Transcript Upload Processor
 * 
 * Accepts raw transcript text, Plaud JSON, or audio files and feeds them
 * through the same LLM intelligence pipeline as Fathom/Plaud webhooks.
 * 
 * Supported input types:
 * - "text" — raw transcript or meeting notes pasted by user
 * - "plaud_json" — Plaud-formatted JSON (auto-detected or explicit)
 * - "audio" — audio file URL (mp3, wav, webm) → transcribed via Whisper first
 */

interface ManualUploadInput {
  /** The raw content: transcript text, JSON string, or audio URL */
  content: string;
  /** Input type hint */
  inputType: "text" | "plaud_json" | "audio";
  /** Optional meeting title override */
  meetingTitle?: string;
  /** Optional meeting date override (ISO string) */
  meetingDate?: string;
  /** Optional participants list */
  participants?: string[];
  /** User ID who uploaded */
  createdBy?: number;
}

interface ManualUploadResult {
  success: boolean;
  meetingId?: number;
  brandedReportUrl?: string | null;
  reason?: string;
  transcriptLength?: number;
}

/**
 * Try to detect if the content is Plaud JSON format
 */
function isPlaudJson(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    // Plaud JSON typically has these fields
    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      (parsed.executiveSummary || parsed.participants || parsed.meetingDate) &&
      !parsed.recorded_by // Not Fathom format
    );
  } catch {
    return false;
  }
}

/**
 * Use LLM to analyze raw transcript text and extract OmniScope intelligence
 */
async function analyzeTranscriptWithLLM(input: {
  transcript: string;
  meetingTitle?: string;
  meetingDate?: string;
  participants?: string[];
}): Promise<{
  meetingTitle: string;
  meetingDate: string;
  primaryLead: string;
  participants: string[];
  organizations: string[];
  executiveSummary: string;
  strategicHighlights: string[];
  opportunities: string[];
  risks: string[];
  keyQuotes: string[];
  sectors: string[];
  jurisdictions: string[];
  actionItems: Array<{
    title: string;
    description: string;
    assignedTo: string;
    priority: "low" | "medium" | "high";
    dueDate: string | null;
  }>;
  meetingType: string;
}> {
  // Truncate transcript to avoid token limits (keep first ~10000 chars)
  const truncatedTranscript = input.transcript.length > 10000
    ? input.transcript.substring(0, 10000) + "\n\n[Transcript truncated for analysis...]"
    : input.transcript;

  // Calculate default due date (2 days from now)
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 2);
  const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

  const systemPrompt = `You are an intelligence analyst for OmniScope, a sovereign-grade financial infrastructure platform operating across OTC Brokerage, Bitcoin & Digital Asset OTC, Stablecoin Liquidity, Commodities, Real Estate Capital, and Payment Rails.

Your job is to analyze meeting transcripts and extract structured intelligence data. Be precise, institutional, and compliance-aware.

CRITICAL RULES FOR EXTRACTING METADATA:
1. If the transcript contains speaker labels (e.g., "Speaker 1:", "John:", "[John Smith]"), extract all unique speaker names as participants.
2. If no speaker labels exist, try to identify names mentioned in the text.
3. Determine the primary lead (the OmniScope team member who likely led the meeting). If unclear, use the first participant.
4. If a meeting title is not provided, generate a concise, descriptive title from the content.
5. If a meeting date is not provided, use today's date: ${new Date().toISOString().split("T")[0]}.

CRITICAL RULES FOR ACTION ITEMS:
1. SPLIT compound action items into separate, atomic tasks.
2. Each task gets a CLEAN, SHORT title (max 80 chars).
3. Put detailed context in the description field.
4. ASSIGN tasks to the correct person based on WHO should do the work.
5. If a specific date/deadline is mentioned, use that as the due date. Otherwise use "${defaultDueDateStr}".
6. Set priority based on urgency discussed in the meeting.

CRITICAL RULES FOR MEETING TYPE:
- "New Client" = first meeting with a new contact/company
- "Follow-Up" = continuing a previous conversation or deal
- "Internal" = team-only meeting
- "Deal Review" = reviewing terms, contracts, or transaction details
- "Partnership" = exploring or formalizing a partnership
- "General" = doesn't fit other categories

OmniScope's core verticals: OTC Brokerage & Execution, Bitcoin & Digital Assets, Stablecoin Liquidity, Commodities (Gold, Oil, Energy), Real Estate Capital, Payment Rails, Technology, AI, Compliance, General.

Relevant jurisdictions: USA, UAE (Dubai/ADGM), GCC, Europe, Asia, Pakistan, Global.`;

  const userPrompt = `Analyze this meeting transcript and extract intelligence data:

${input.meetingTitle ? `**Meeting Title:** ${input.meetingTitle}` : "**Meeting Title:** [Extract from content]"}
${input.meetingDate ? `**Meeting Date:** ${input.meetingDate}` : "**Meeting Date:** [Extract from content or use today]"}
${input.participants && input.participants.length > 0 ? `**Known Participants:** ${input.participants.join(", ")}` : "**Participants:** [Extract from transcript]"}

**Transcript / Meeting Notes:**
${truncatedTranscript}

Return a JSON object with these fields:
- meetingTitle: A concise title for the meeting (use provided title if available, otherwise generate one)
- meetingDate: ISO date string (YYYY-MM-DD)
- primaryLead: Name of the OmniScope team member who led the meeting
- participants: Array of all participant names
- organizations: Array of organizations/companies mentioned
- executiveSummary: A 2-4 sentence institutional-grade summary
- strategicHighlights: Array of 3-5 key strategic points (empty array if none)
- opportunities: Array of business opportunities identified (empty array if none)
- risks: Array of risks, red flags, or compliance concerns (empty array if none)
- keyQuotes: Array of notable direct quotes from participants (empty array if none)
- sectors: Array of relevant sectors
- jurisdictions: Array of jurisdictions discussed or relevant
- meetingType: One of "New Client", "Follow-Up", "Internal", "Deal Review", "Partnership", "General"
- actionItems: Array of structured action items, each with:
  - title: Short, clean task title (max 80 chars)
  - description: Detailed context about what needs to be done
  - assignedTo: Name of the person who should do this task
  - priority: "low", "medium", or "high"
  - dueDate: ISO date string (YYYY-MM-DD) or null`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "transcript_intelligence",
          strict: true,
          schema: {
            type: "object",
            properties: {
              meetingTitle: { type: "string", description: "Meeting title" },
              meetingDate: { type: "string", description: "ISO date" },
              primaryLead: { type: "string", description: "Primary lead name" },
              participants: { type: "array", items: { type: "string" }, description: "Participant names" },
              organizations: { type: "array", items: { type: "string" }, description: "Organizations mentioned" },
              executiveSummary: { type: "string", description: "2-4 sentence summary" },
              strategicHighlights: { type: "array", items: { type: "string" }, description: "Key strategic points" },
              opportunities: { type: "array", items: { type: "string" }, description: "Business opportunities" },
              risks: { type: "array", items: { type: "string" }, description: "Risks and red flags" },
              keyQuotes: { type: "array", items: { type: "string" }, description: "Notable quotes" },
              sectors: { type: "array", items: { type: "string" }, description: "Relevant sectors" },
              jurisdictions: { type: "array", items: { type: "string" }, description: "Relevant jurisdictions" },
              meetingType: { type: "string", description: "Type of meeting" },
              actionItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short task title" },
                    description: { type: "string", description: "Detailed description" },
                    assignedTo: { type: "string", description: "Person responsible" },
                    priority: { type: "string", description: "low, medium, or high" },
                    dueDate: { type: ["string", "null"], description: "ISO date or null" },
                  },
                  required: ["title", "description", "assignedTo", "priority", "dueDate"],
                  additionalProperties: false,
                },
                description: "Structured action items",
              },
            },
            required: [
              "meetingTitle", "meetingDate", "primaryLead", "participants", "organizations",
              "executiveSummary", "strategicHighlights", "opportunities", "risks", "keyQuotes",
              "sectors", "jurisdictions", "meetingType", "actionItems",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      // Normalize action items
      parsed.actionItems = (parsed.actionItems || []).map((item: any) => ({
        title: (item.title || "").substring(0, 80),
        description: item.description || "",
        assignedTo: item.assignedTo || "Unassigned",
        priority: ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium",
        dueDate: item.dueDate || defaultDueDateStr,
      }));
      return parsed;
    }

    throw new Error("Unexpected LLM response format");
  } catch (error) {
    console.error("[ManualUpload] LLM analysis failed:", error);

    // Fallback: minimal intelligence data
    return {
      meetingTitle: input.meetingTitle || "Uploaded Meeting",
      meetingDate: input.meetingDate || new Date().toISOString().split("T")[0],
      primaryLead: input.participants?.[0] || "Unknown",
      participants: input.participants || ["Unknown"],
      organizations: [],
      executiveSummary: `Meeting transcript uploaded manually. ${input.transcript.substring(0, 200)}...`,
      strategicHighlights: [],
      opportunities: [],
      risks: [],
      keyQuotes: [],
      sectors: ["General"],
      jurisdictions: [],
      actionItems: [],
      meetingType: "General",
    };
  }
}

/**
 * Process a manually uploaded transcript through the full intelligence pipeline
 */
export async function processManualTranscript(input: ManualUploadInput): Promise<ManualUploadResult> {
  let transcriptText: string;
  let detectedPlaud = false;

  console.log(`[ManualUpload] Processing ${input.inputType} upload...`);

  // Step 1: Get transcript text based on input type
  switch (input.inputType) {
    case "audio": {
      // Transcribe audio file via Whisper
      console.log("[ManualUpload] Transcribing audio file via Whisper...");
      try {
        const transcription = await transcribeAudio({
          audioUrl: input.content,
          language: "en",
          prompt: "Transcribe this business meeting recording",
        });
        transcriptText = transcription.text;
        console.log(`[ManualUpload] Audio transcribed: ${transcriptText.length} chars`);
      } catch (error) {
        console.error("[ManualUpload] Audio transcription failed:", error);
        return { success: false, reason: "Audio transcription failed. Please try uploading a text transcript instead." };
      }
      break;
    }

    case "plaud_json": {
      // Parse as Plaud JSON and feed directly into ingestion pipeline
      try {
        const parsed = JSON.parse(input.content);
        const validated = validateIntelligenceData(parsed);
        if (validated) {
          // Override with user-provided metadata
          if (input.meetingTitle) validated.meetingTitle = input.meetingTitle;
          if (input.meetingDate) validated.meetingDate = input.meetingDate;
          validated.sourceType = "manual";
          validated.sourceId = `manual-${Date.now()}`;

          const result = await processIntelligenceData(validated, input.createdBy);
          return {
            success: result.success,
            meetingId: result.meetingId,
            brandedReportUrl: result.brandedReportUrl,
            reason: result.reason,
            transcriptLength: input.content.length,
          };
        }
        // If not valid Plaud format, treat as text
        transcriptText = input.content;
        detectedPlaud = false;
      } catch {
        transcriptText = input.content;
      }
      break;
    }

    case "text":
    default: {
      // Check if the text is actually Plaud JSON
      if (isPlaudJson(input.content)) {
        console.log("[ManualUpload] Auto-detected Plaud JSON format");
        detectedPlaud = true;
        try {
          const parsed = JSON.parse(input.content);
          const validated = validateIntelligenceData(parsed);
          if (validated) {
            if (input.meetingTitle) validated.meetingTitle = input.meetingTitle;
            if (input.meetingDate) validated.meetingDate = input.meetingDate;
            validated.sourceType = "manual";
            validated.sourceId = `manual-${Date.now()}`;

            const result = await processIntelligenceData(validated, input.createdBy);
            return {
              success: result.success,
              meetingId: result.meetingId,
              brandedReportUrl: result.brandedReportUrl,
              reason: result.reason,
              transcriptLength: input.content.length,
            };
          }
        } catch {
          // Fall through to LLM analysis
        }
      }
      transcriptText = input.content;
      break;
    }
  }

  if (!transcriptText || transcriptText.trim().length < 20) {
    return { success: false, reason: "Transcript is too short. Please provide at least 20 characters of content." };
  }

  // Step 2: Run LLM analysis on the transcript
  console.log(`[ManualUpload] Running LLM analysis on ${transcriptText.length} chars of transcript...`);
  const analysis = await analyzeTranscriptWithLLM({
    transcript: transcriptText,
    meetingTitle: input.meetingTitle,
    meetingDate: input.meetingDate,
    participants: input.participants,
  });
  console.log(`[ManualUpload] LLM analysis complete: "${analysis.meetingTitle}"`);

  // Step 3: Build intelligence data and feed into ingestion pipeline
  const intelligenceData: IntelligenceData = {
    meetingTitle: analysis.meetingTitle,
    meetingDate: analysis.meetingDate,
    primaryLead: analysis.primaryLead,
    participants: analysis.participants,
    organizations: analysis.organizations,
    jurisdictions: analysis.jurisdictions,
    executiveSummary: analysis.executiveSummary,
    strategicHighlights: analysis.strategicHighlights,
    opportunities: analysis.opportunities,
    risks: analysis.risks,
    keyQuotes: analysis.keyQuotes,
    actionItems: analysis.actionItems as any,
    intelligenceData: {
      meetingType: analysis.meetingType,
      uploadSource: input.inputType,
      transcriptLength: transcriptText.length,
    },
    fullTranscript: transcriptText,
    sourceType: "manual",
    sourceId: `manual-${Date.now()}`,
    tags: [],
    sectors: analysis.sectors,
    jurisdictionTags: analysis.jurisdictions,
  };

  // Step 4: Process through the standard ingestion pipeline
  const result = await processIntelligenceData(intelligenceData, input.createdBy);

  if (result.success) {
    console.log(`[ManualUpload] Successfully processed meeting ${result.meetingId}: "${analysis.meetingTitle}"`);
  } else {
    console.log(`[ManualUpload] Processing failed (${result.reason})`);
  }

  return {
    success: result.success,
    meetingId: result.meetingId,
    brandedReportUrl: result.brandedReportUrl,
    reason: result.reason,
    transcriptLength: transcriptText.length,
  };
}
