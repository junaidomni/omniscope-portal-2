import * as db from "../db";
import type { ProviderConfig } from "../signingAdapters";
import { TRPCError } from "@trpc/server";
import { getSigningAdapter, getAllAdapters, getAdapterInfo } from "../signingAdapters";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const signingRouter = router({
  // Provider management
  listProviders: orgScopedProcedure
    .query(async ({ ctx }) => {
      const configured = await db.listSigningProviders();
      const allAdapters = getAdapterInfo();
      return { configured, available: allAdapters };
    }),

  configureProvider: orgScopedProcedure
    .input(z.object({
      provider: z.enum(["firma", "signatureapi", "docuseal", "pandadocs", "docusign", "boldsign", "esignly"]),
      displayName: z.string(),
      apiKey: z.string(),
      apiSecret: z.string().optional(),
      baseUrl: z.string().optional(),
      webhookSecret: z.string().optional(),
      config: z.string().optional(), // JSON
      isDefault: z.boolean().default(false),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.upsertSigningProvider({ ...input, createdBy: ctx.user!.id });
    }),

  removeProvider: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteSigningProvider(input.id);
    }),

  // Envelope operations
  listEnvelopes: orgScopedProcedure
    .input(z.object({
      status: z.string().optional(),
      documentId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return db.listSigningEnvelopes(input || undefined);
    }),

  getEnvelope: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND", message: "Envelope not found" });
      return envelope;
    }),

  sendForSignature: orgScopedProcedure
    .input(z.object({
      documentId: z.number(),
      providerId: z.number().optional(), // uses default if not specified
      recipients: z.array(z.object({
        name: z.string(),
        email: z.string(),
        role: z.string().default("signer"),
        order: z.number().optional(),
      })),
      subject: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the document
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Get the signing provider
      let provider;
      if (input.providerId) {
        provider = await db.getSigningProviderById(input.providerId);
      } else {
        provider = await db.getDefaultSigningProvider();
      }
      if (!provider) throw new TRPCError({ code: "BAD_REQUEST", message: "No signing provider configured. Please set up a provider in Settings." });
      if (!provider.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected signing provider is not active." });

      // Get the adapter
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `No adapter found for provider: ${provider.provider}` });

      // Build config
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
        webhookSecret: provider.webhookSecret || undefined,
        extra: provider.config ? JSON.parse(provider.config) : undefined,
      };

      // Get document URL
      const documentUrl = doc.s3Url || "";
      if (!documentUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Document has no accessible URL for signing." });

      // Create envelope via provider
      const result = await adapter.createEnvelope({
        documentUrl,
        documentName: doc.title,
        recipients: input.recipients,
        subject: input.subject,
        message: input.message,
      }, config);

      // Save envelope record
      const envelope = await db.createSigningEnvelope({
        documentId: input.documentId,
        providerId: provider.id,
        providerEnvelopeId: result.providerEnvelopeId,
        status: result.status,
        recipients: JSON.stringify(result.recipients),
        sentAt: new Date(),
        createdBy: ctx.user!.id,
        metadata: JSON.stringify(result.rawResponse),
      });

      // Update document status
      await db.updateDocument(input.documentId, { status: "sent" });

      // Log activity
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_sent_for_signature",
        entityType: "document",
        entityId: String(input.documentId),
        entityName: doc.title,
        details: JSON.stringify({
          provider: provider.provider,
          recipients: input.recipients.map(r => r.email),
          envelopeId: envelope?.id,
        }),
      });

      return envelope;
    }),

  voidEnvelope: orgScopedProcedure
    .input(z.object({ id: z.number(), reason: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND" });
      const provider = await db.getSigningProviderById(envelope.providerId);
      if (!provider) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
      };
      const success = await adapter.voidEnvelope(envelope.providerEnvelopeId || "", input.reason, config);
      if (success) {
        await db.updateSigningEnvelope(input.id, { status: "voided" });
        await db.updateDocument(envelope.documentId, { status: "voided" });
      }
      return { success };
    }),

  refreshStatus: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND" });
      const provider = await db.getSigningProviderById(envelope.providerId);
      if (!provider) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
      };
      const result = await adapter.getStatus(envelope.providerEnvelopeId || "", config);
      await db.updateSigningEnvelope(input.id, {
        status: result.status,
        recipients: JSON.stringify(result.recipients),
        ...(result.status === "completed" ? { completedAt: new Date(), signedDocumentUrl: result.signedDocumentUrl } : {}),
      });
      if (result.status === "completed") {
        await db.updateDocument(envelope.documentId, { status: "signed" });
      }
      return result;
    }),
});
