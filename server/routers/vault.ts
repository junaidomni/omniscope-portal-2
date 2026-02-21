import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const vaultRouter = router({
  // Document CRUD
  listDocuments: orgScopedProcedure
    .input(z.object({
      collection: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      folderId: z.number().nullable().optional(),
      isTemplate: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      return db.listDocuments(input ? { ...input, ownerId: undefined, orgId: ctx.orgId ?? undefined } : { orgId: ctx.orgId ?? undefined });
    }),

  getDocument: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await db.getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return doc;
    }),

  createDocument: orgScopedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      sourceType: z.enum(["google_doc", "google_sheet", "google_slide", "pdf", "uploaded", "generated"]),
      googleFileId: z.string().optional(),
      s3Url: z.string().optional(),
      s3Key: z.string().optional(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      subcategory: z.string().optional(),
      visibility: z.enum(["organization", "team", "private", "restricted"]).default("organization"),
      folderId: z.number().optional(),
      isTemplate: z.boolean().default(false),
      fileSize: z.number().optional(),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entityLinks, ...docData } = input;
      const doc = await db.createDocument({ ...docData, ownerId: ctx.user!.id });
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create document" });
      // Add entity links
      if (entityLinks && entityLinks.length > 0) {
        for (const link of entityLinks) {
          await db.addDocumentEntityLink({ documentId: doc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }
      // Log activity
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_created",
        entityType: "document",
        entityId: String(doc.id),
        entityName: input.title,
        details: JSON.stringify({ sourceType: input.sourceType, collection: input.collection, category: input.category }),
      });
      return doc;
    }),

  updateDocument: orgScopedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).optional(),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).optional(),
      subcategory: z.string().optional(),
      status: z.enum(["draft", "active", "pending_signature", "sent", "viewed", "signed", "voided", "declined", "archived"]).optional(),
      visibility: z.enum(["organization", "team", "private", "restricted"]).optional(),
      folderId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const doc = await db.updateDocument(id, data);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return doc;
    }),

  deleteDocument: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.getDocumentById(input.id);
      await db.deleteDocument(input.id);
      if (doc) {
        await db.logActivity({
          userId: ctx.user!.id,
          action: "document_deleted",
          entityType: "document",
          entityId: String(input.id),
          entityName: doc.title,
        });
      }
      return { success: true };
    }),

  // Entity links
  addEntityLink: orgScopedProcedure
    .input(z.object({
      documentId: z.number(),
      entityType: z.enum(["company", "contact", "meeting"]),
      entityId: z.number(),
      linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.addDocumentEntityLink(input);
    }),

  removeEntityLink: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.removeDocumentEntityLink(input.id);
    }),

  getDocumentsByEntity: orgScopedProcedure
    .input(z.object({
      entityType: z.enum(["company", "contact", "meeting"]),
      entityId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getDocumentsByEntity(input.entityType, input.entityId);
    }),

  // Favorites
  toggleFavorite: orgScopedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const isFavorited = await db.toggleFavorite(ctx.user!.id, input.documentId);
      return { isFavorited };
    }),

  getFavorites: orgScopedProcedure
    .query(async ({ ctx }) => {
      return db.getFavoriteDocuments(ctx.user!.id);
    }),

  getRecent: orgScopedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      return db.getRecentDocuments(ctx.user!.id, input?.limit);
    }),

  // Folders
  listFolders: orgScopedProcedure
    .input(z.object({
      collection: z.string().optional(),
      parentId: z.number().nullable().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.listFolders(input || undefined);
    }),

  createFolder: orgScopedProcedure
    .input(z.object({
      name: z.string().min(1),
      collection: z.enum(["company_repo", "personal", "counterparty", "templates", "signed", "transactions"]),
      parentId: z.number().nullable().optional(),
      entityType: z.enum(["company", "contact"]).optional(),
      entityId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createFolder({ ...input, ownerId: ctx.user!.id });
    }),

  updateFolder: orgScopedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateFolder(id, data);
    }),

  deleteFolder: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteFolder(input.id);
    }),

  // Folder navigation
  getFolderContents: orgScopedProcedure
    .input(z.object({ folderId: z.number().nullable() }))
    .query(async ({ input }) => {
      return db.getFolderWithChildren(input.folderId);
    }),

  getFolderBreadcrumbs: orgScopedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input }) => {
      return db.getFolderBreadcrumbs(input.folderId);
    }),

  getFolderById: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getFolderById(input.id);
    }),

  // Move documents to folder
  moveDocumentToFolder: orgScopedProcedure
    .input(z.object({ documentId: z.number(), folderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.moveDocumentToFolder(input.documentId, input.folderId);
    }),

  moveDocumentsToFolder: orgScopedProcedure
    .input(z.object({ documentIds: z.array(z.number()), folderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.moveDocumentsToFolder(input.documentIds, input.folderId);
    }),

  // Move folder (change parent)
  moveFolder: orgScopedProcedure
    .input(z.object({ folderId: z.number(), newParentId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.updateFolder(input.folderId, { parentId: input.newParentId ?? undefined });
    }),

  // Access management
  getDocumentAccess: orgScopedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentAccessList(input.documentId);
    }),

  getFolderAccess: orgScopedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getFolderAccessList(input.folderId);
    }),

  // Unified access list query (supports both documents and folders)
  getAccessList: orgScopedProcedure
    .input(z.object({
      targetType: z.enum(["document", "folder"]),
      targetId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      if (input.targetType === "folder") {
        return db.getFolderAccessList(input.targetId);
      }
      return db.getDocumentAccessList(input.targetId);
    }),

  grantAccess: orgScopedProcedure
    .input(z.object({
      targetType: z.enum(["document", "folder"]),
      targetId: z.number(),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      userId: z.number().optional(),
      accessLevel: z.enum(["view", "edit", "admin"]).default("view"),
    }))
    .mutation(async ({ input, ctx }) => {
      const base: any = {
        accessLevel: input.accessLevel,
        grantedBy: ctx.user!.id,
      };
      if (input.contactId) base.contactId = input.contactId;
      if (input.companyId) base.companyId = input.companyId;
      if (input.userId) base.userId = input.userId;
      if (input.targetType === "folder") {
        return db.grantFolderAccess({ folderId: input.targetId, ...base });
      }
      return db.grantDocumentAccess({ documentId: input.targetId, ...base });
    }),

  revokeAccess: orgScopedProcedure
    .input(z.object({ accessId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.revokeDocumentAccess(input.accessId);
    }),

  // Move document to a different collection
  moveToCollection: orgScopedProcedure
    .input(z.object({
      documentId: z.number(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.moveDocumentToCollection(input.documentId, input.collection);
      if (doc) {
        await db.logActivity({
          userId: ctx.user!.id,
          action: "document_moved",
          entityType: "document",
          entityId: String(input.documentId),
          entityName: doc.title,
          details: JSON.stringify({ newCollection: input.collection }),
        });
      }
      return doc;
    }),

  // Convert a document to a template
  convertToTemplate: orgScopedProcedure
    .input(z.object({
      documentId: z.number(),
      name: z.string().min(1),
      category: z.enum(["agreement", "compliance", "intake", "profile", "other"]).default("agreement"),
      subcategory: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const template = await db.createTemplate({
        name: input.name,
        category: input.category,
        subcategory: input.subcategory,
        googleFileId: doc.googleFileId,
        s3Url: doc.s3Url,
        createdBy: ctx.user!.id,
      });
      // Also move the document to the template collection
      await db.moveDocumentToCollection(input.documentId, "template");
      await db.updateDocument(input.documentId, { isTemplate: true });
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_converted_to_template",
        entityType: "document",
        entityId: String(input.documentId),
        entityName: doc.title,
        details: JSON.stringify({ templateName: input.name, templateId: template?.id }),
      });
      return template;
    }),

  // AI Document Analysiss
  analyzeDocument: orgScopedProcedure
    .input(z.object({
      title: z.string(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      textContent: z.string().optional(), // extracted text for analysis
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an institutional document analyst for OmniScope, a private financial infrastructure platform. Analyze the document and extract structured metadata. Return JSON only.

Categories: agreement, compliance, intake, profile, strategy, operations, transaction, correspondence, template, other
Subcategories: sppp (Strategic Private Placement Program), ncnda (Non-Circumvention Non-Disclosure Agreement), jva (Joint Venture Agreement), kyc (Know Your Customer), kyb (Know Your Business), cis (Customer Information Sheet), nda, mou, loi, sow, invoice, receipt, report, memo, other
Collections: company_repo, counterparty, transaction, signed

Return JSON with: { "suggestedTitle": string, "category": string, "subcategory": string, "collection": string, "summary": string (2-3 sentences), "detectedEntities": { "companies": string[], "people": string[] }, "tags": string[] }`,
            },
            {
              role: "user",
              content: `Analyze this document:\nTitle: ${input.title}\nFilename: ${input.fileName || "unknown"}\nMIME Type: ${input.mimeType || "unknown"}\n\nContent excerpt:\n${(input.textContent || "").slice(0, 4000)}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestedTitle: { type: "string", description: "Clean, professional title" },
                  category: { type: "string", description: "Document category" },
                  subcategory: { type: "string", description: "Document subcategory" },
                  collection: { type: "string", description: "Vault collection" },
                  summary: { type: "string", description: "2-3 sentence summary" },
                  detectedEntities: {
                    type: "object",
                    properties: {
                      companies: { type: "array", items: { type: "string" } },
                      people: { type: "array", items: { type: "string" } },
                    },
                    required: ["companies", "people"],
                    additionalProperties: false,
                  },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["suggestedTitle", "category", "subcategory", "collection", "summary", "detectedEntities", "tags"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        if (content) return JSON.parse(content);
        return null;
      } catch (error) {
        console.error("[Vault] AI analysis failed:", error);
        return null;
      }
    }),

  // ── Document Notes ──
  getNotes: orgScopedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getDocumentNotes(input.documentId);
    }),

  addNote: orgScopedProcedure
    .input(z.object({ documentId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return db.addDocumentNote(input.documentId, ctx.user.id, input.content);
    }),

  deleteNote: orgScopedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return db.deleteDocumentNote(input.noteId, ctx.user.id);
    }),
});
