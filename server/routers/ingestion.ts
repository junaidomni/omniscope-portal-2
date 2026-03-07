import { TRPCError } from "@trpc/server";
import { processIntelligenceData, validateIntelligenceData } from "../ingestion";
import { processManualTranscript } from "../manualTranscriptProcessor";
import { storagePut } from "../storage";
import { publicProcedure, orgScopedProcedure, planGatedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { users, orgMemberships } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { importFathomMeetings } from "../fathomIntegration";

export const ingestionRouter = router({
  webhook: publicProcedure
    .input(z.any())
    .mutation(async ({ ctx, input }) => {
      const data = validateIntelligenceData(input);
      if (!data) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid intelligence data format" });
      // Webhook ingestion has no user context — orgId stays undefined
      const result = await processIntelligenceData(data);
      return result;
    }),

  syncFathom: planGatedProcedure("integrations")
    .mutation(async ({ ctx }) => {
      // Server-side cooldown: skip if last sync was < 5 minutes ago
      const now = Date.now();
      if ((globalThis as any).__lastFathomSync && now - (globalThis as any).__lastFathomSync < 5 * 60 * 1000) {
        return { success: true, imported: 0, skipped: 0, errors: 0 };
      }
      try {
        (globalThis as any).__lastFathomSync = now;
        const result = await importFathomMeetings({ limit: 10, orgId: ctx.orgId ?? undefined });
        return { success: true, imported: result.imported, skipped: result.skipped, errors: result.errors };
      } catch (error: any) {
        console.error("[Fathom Sync] Error:", error.message);
        return { success: false, imported: 0, skipped: 0, errors: 1 };
      }
    }),

  /** Upload a transcript (text, Plaud JSON, or audio URL) and process through LLM pipeline */
  uploadTranscript: planGatedProcedure("ai_insights")
    .input(z.object({
      content: z.string().min(20, "Content must be at least 20 characters"),
      inputType: z.enum(["text", "plaud_json", "audio"]),
      meetingTitle: z.string().optional(),
      meetingDate: z.string().optional(),
      participants: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await processManualTranscript({
          content: input.content,
          inputType: input.inputType,
          meetingTitle: input.meetingTitle,
          meetingDate: input.meetingDate,
          participants: input.participants,
          createdBy: ctx.user.id,
          orgId: ctx.orgId ?? undefined,
        });
        return result;
      } catch (error: any) {
        console.error("[Upload Transcript] Error:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to process transcript",
        });
      }
    }),

  /** Upload an audio file to S3 and return the URL for transcription */
  uploadAudioFile: planGatedProcedure("ai_insights")
    .input(z.object({
      fileName: z.string(),
      fileData: z.string(), // base64 encoded
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const buffer = Buffer.from(input.fileData, "base64");
        const suffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `transcripts/${ctx.user.id}/${Date.now()}-${suffix}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, fileKey };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload audio file",
        });
      }
    }),

  /** Zapier + Plaud webhook: ingest meeting transcript, summary, and action items */
  plaudWebhook: publicProcedure
    .input(z.any()) // Accept any input format
    .mutation(async ({ input }) => {
      // Parse input: when called via HTTP (like from Zapier), input is the direct JSON
      // When called via tRPC client, input is also the direct JSON (tRPC handles wrapping)
      const parsedInput = input;

      // Extract fields
      const { title, summary, transcript, createdAt, plaudWebhookSecret } = parsedInput;

      // Validate required fields
      if (!parsedInput.title || !parsedInput.summary || !parsedInput.createdAt || !parsedInput.plaudWebhookSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Missing required fields: title, summary, createdAt, plaudWebhookSecret" });
      }

      // Verify webhook secret
      const webhookSecret = process.env.PLAUD_WEBHOOK_SECRET;
      if (!webhookSecret || plaudWebhookSecret !== webhookSecret) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook secret" });
      }

      try {
        // Find Kyle Jackson's user ID (default source for Plaud meetings)
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");
        
        const kyleUser = await database.select().from(users).where(eq(users.email, "kyle@omniscopex.ae")).limit(1);
        const createdBy = kyleUser.length > 0 ? kyleUser[0].id : undefined;

        // Get Kyle's organization
        let orgId: number | null = null;
        if (createdBy) {
          const membership = await database.select().from(orgMemberships).where(eq(orgMemberships.userId, createdBy)).limit(1);
          if (membership.length > 0) {
            orgId = membership[0].orgId;
          }
        }

        // Create intelligence data for ingestion pipeline
        const sourceId = `plaud-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const intelligenceData = {
          meetingTitle: title,
          meetingDate: createdAt,
          primaryLead: "Kyle Jackson",
          participants: [], // Plaud doesn't provide participant list via Zapier
          executiveSummary: summary,
          sourceType: "plaud" as const,
          sourceId,
          actionItems: [], // Plaud doesn't provide action items via Zapier
          fullTranscript: transcript, // Include full transcript if provided
        };

        // Process through standard ingestion pipeline
        const result = await processIntelligenceData(intelligenceData, createdBy, orgId ?? undefined);

        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Ingestion failed: ${result.reason}` });
        }

        console.log(`[Plaud Webhook] Successfully ingested meeting ${result.meetingId}: "${title}"`);
        return { success: true, meetingId: result.meetingId };
      } catch (error: any) {
        console.error("[Plaud Webhook] Error:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to ingest Plaud meeting",
        });
      }
    }),
});


