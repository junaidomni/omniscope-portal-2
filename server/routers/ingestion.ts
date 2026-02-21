import * as fathomIntegration from "../fathomIntegration";
import { TRPCError } from "@trpc/server";
import { processIntelligenceData, validateIntelligenceData } from "../ingestion";
import { processManualTranscript } from "../manualTranscriptProcessor";
import { storagePut } from "../storage";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const ingestionRouter = router({
  webhook: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const data = validateIntelligenceData(input);
      if (!data) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid intelligence data format" });
      const result = await processIntelligenceData(data);
      return result;
    }),

  syncFathom: protectedProcedure
    .mutation(async () => {
      try {
        const result = await fathomIntegration.importFathomMeetings({ limit: 10 });
        return { success: true, imported: result.imported, skipped: result.skipped, errors: result.errors };
      } catch (error: any) {
        console.error("[Fathom Sync] Error:", error.message);
        return { success: false, imported: 0, skipped: 0, errors: 1 };
      }
    }),

  /** Upload a transcript (text, Plaud JSON, or audio URL) and process through LLM pipeline */
  uploadTranscript: protectedProcedure
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
  uploadAudioFile: protectedProcedure
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
});
