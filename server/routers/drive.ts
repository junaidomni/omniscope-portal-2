import * as db from "../db";
import * as googleDrive from "../googleDrive";
import { TRPCError } from "@trpc/server";
import { getGoogleAuthUrl, isGoogleConnected, syncGoogleCalendarEvents } from "../googleCalendar";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const driveRouter = router({
  // Connection status
  connectionStatus: orgScopedProcedure.query(async ({ ctx }) => {
    const status = await isGoogleConnected(ctx.user.id);
    return {
      connected: status.connected,
      email: status.email,
      hasDriveScopes: status.hasDriveScopes ?? false,
      hasDocsScopes: status.hasDocsScopes ?? false,
      hasSheetsScopes: status.hasSheetsScopes ?? false,
    };
  }),

  // List files in a Drive folder
  listFiles: orgScopedProcedure
    .input(z.object({
      folderId: z.string().optional(),
      pageToken: z.string().optional(),
      pageSize: z.number().min(1).max(100).default(50),
      query: z.string().optional(),
      driveId: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const result = await googleDrive.listDriveFiles(
        ctx.user.id,
        input?.folderId,
        input?.pageToken,
        input?.pageSize,
        input?.query,
        input?.driveId,
      );
      if (!result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected. Please connect your Google account in Settings." });
      return result;
    }),

  // Search files across Drive
  searchFiles: orgScopedProcedure
    .input(z.object({ query: z.string().min(1), pageSize: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const files = await googleDrive.searchDriveFiles(ctx.user.id, input.query, input.pageSize);
      if (!files) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected." });
      return files;
    }),

  // Get file metadata
  getFile: orgScopedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      const file = await googleDrive.getDriveFile(ctx.user.id, input.fileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found or Drive not connected." });
      return file;
    }),

  // Create a new folder in Drive
  createFolder: orgScopedProcedure
    .input(z.object({ name: z.string().min(1), parentFolderId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const folder = await googleDrive.createDriveFolder(ctx.user.id, input.name, input.parentFolderId);
      if (!folder) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create folder." });
      await db.logActivity({
        userId: ctx.user.id,
        action: "drive_folder_created",
        entityType: "document",
        entityId: folder.id,
        entityName: input.name,
      });
      return folder;
    }),

  // Create a new Google Doc
  createDoc: orgScopedProcedure
    .input(z.object({
      title: z.string().min(1),
      folderId: z.string().optional(),
      // Optional: also register in Vault
      registerInVault: z.boolean().default(true),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await googleDrive.createGoogleDoc(ctx.user.id, input.title, input.folderId);
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Google Doc. Ensure Drive is connected." });

      let vaultDoc = null;
      if (input.registerInVault) {
        vaultDoc = await db.createDocument({
          title: input.title,
          sourceType: "google_doc",
          googleFileId: doc.id,
          googleMimeType: "application/vnd.google-apps.document",
          collection: input.collection,
          category: input.category,
          status: "active",
          visibility: "organization",
          ownerId: ctx.user.id,
        });
        if (vaultDoc && input.entityLinks) {
          for (const link of input.entityLinks) {
            await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
          }
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "google_doc_created",
        entityType: "document",
        entityId: doc.id,
        entityName: input.title,
        details: JSON.stringify({ googleFileId: doc.id, webViewLink: doc.webViewLink, vaultDocId: vaultDoc?.id }),
      });

      return { ...doc, vaultDocId: vaultDoc?.id };
    }),

  // Create a new Google Sheet
  createSheet: orgScopedProcedure
    .input(z.object({
      title: z.string().min(1),
      folderId: z.string().optional(),
      registerInVault: z.boolean().default(true),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const sheet = await googleDrive.createGoogleSheet(ctx.user.id, input.title, input.folderId);
      if (!sheet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Google Sheet. Ensure Drive is connected." });

      let vaultDoc = null;
      if (input.registerInVault) {
        vaultDoc = await db.createDocument({
          title: input.title,
          sourceType: "google_sheet",
          googleFileId: sheet.id,
          googleMimeType: "application/vnd.google-apps.spreadsheet",
          collection: input.collection,
          category: input.category,
          status: "active",
          visibility: "organization",
          ownerId: ctx.user.id,
        });
        if (vaultDoc && input.entityLinks) {
          for (const link of input.entityLinks) {
            await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
          }
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "google_sheet_created",
        entityType: "document",
        entityId: sheet.id,
        entityName: input.title,
        details: JSON.stringify({ googleFileId: sheet.id, webViewLink: sheet.webViewLink, vaultDocId: vaultDoc?.id }),
      });

      return { ...sheet, vaultDocId: vaultDoc?.id };
    }),

  // Read Google Doc text (for AI analysis or preview)
  readDocText: orgScopedProcedure
    .input(z.object({ docId: z.string() }))
    .query(async ({ input, ctx }) => {
      const text = await googleDrive.readGoogleDocText(ctx.user.id, input.docId);
      return { text };
    }),

  // Export Google Doc as HTML for internal viewer
  exportDocHtml: orgScopedProcedure
    .input(z.object({ docId: z.string() }))
    .query(async ({ input, ctx }) => {
      const drive = await googleDrive.getDriveClient(ctx.user.id);
      if (!drive) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected." });
      try {
        const response = await drive.files.export(
          { fileId: input.docId, mimeType: "text/html" },
          { responseType: "text" }
        );
        return { html: response.data as string };
      } catch (error: any) {
        console.error("[Google Docs] Export HTML error:", error.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to export document as HTML." });
      }
    }),

  // Read Google Sheet data (for preview)
  readSheetData: orgScopedProcedure
    .input(z.object({ spreadsheetId: z.string(), range: z.string().default("Sheet1!A1:Z100") }))
    .query(async ({ input, ctx }) => {
      return googleDrive.readSheetData(ctx.user.id, input.spreadsheetId, input.range);
    }),

  // List shared drives
  listSharedDrives: orgScopedProcedure
    .query(async ({ ctx }) => {
      return googleDrive.listSharedDrives(ctx.user.id);
    }),

  // Generate document from template (Google Docs-based)
  generateFromTemplate: orgScopedProcedure
    .input(z.object({
      templateDocId: z.string(), // Google Doc ID of the template
      newTitle: z.string(),
      mergeFields: z.record(z.string()), // { "client_name": "Wintermute", ... }
      folderId: z.string().optional(),
      // Vault registration
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("counterparty"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("agreement"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("generated_for"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await googleDrive.generateFromTemplate(
        ctx.user.id,
        input.templateDocId,
        input.newTitle,
        input.mergeFields,
        input.folderId,
      );
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate document from template." });

      // Register in Vault
      const vaultDoc = await db.createDocument({
        title: input.newTitle,
        sourceType: "google_doc",
        googleFileId: result.id,
        googleMimeType: "application/vnd.google-apps.document",
        collection: input.collection,
        category: input.category,
        status: "draft",
        visibility: "organization",
        ownerId: ctx.user.id,
      });

      if (vaultDoc && input.entityLinks) {
        for (const link of input.entityLinks) {
          await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "document_generated_from_template",
        entityType: "document",
        entityId: result.id,
        entityName: input.newTitle,
        details: JSON.stringify({
          templateDocId: input.templateDocId,
          mergeFieldCount: Object.keys(input.mergeFields).length,
          webViewLink: result.webViewLink,
          vaultDocId: vaultDoc?.id,
        }),
      });

      return { ...result, vaultDocId: vaultDoc?.id };
    }),

  // Import a Drive file into the Vault
  importToVault: orgScopedProcedure
    .input(z.object({
      googleFileId: z.string(),
      title: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get file metadata from Drive
      const file = await googleDrive.getDriveFile(ctx.user.id, input.googleFileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found in Google Drive." });

      // Map MIME type to sourceType
      let sourceType: "google_doc" | "google_sheet" | "google_slide" | "pdf" | "uploaded" = "uploaded";
      if (file.mimeType === "application/vnd.google-apps.document") sourceType = "google_doc";
      else if (file.mimeType === "application/vnd.google-apps.spreadsheet") sourceType = "google_sheet";
      else if (file.mimeType === "application/vnd.google-apps.presentation") sourceType = "google_slide";
      else if (file.mimeType === "application/pdf") sourceType = "pdf";

      const vaultDoc = await db.createDocument({
        title: input.title || file.name,
        sourceType,
        googleFileId: file.id,
        googleMimeType: file.mimeType,
        collection: input.collection,
        category: input.category,
        status: "active",
        visibility: "organization",
        ownerId: ctx.user.id,
        fileSize: file.size ? parseInt(file.size) : undefined,
        googleModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      });

      if (vaultDoc && input.entityLinks) {
        for (const link of input.entityLinks) {
          await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "document_imported_from_drive",
        entityType: "document",
        entityId: String(vaultDoc?.id),
        entityName: input.title || file.name,
        details: JSON.stringify({ googleFileId: file.id, mimeType: file.mimeType }),
      });

      return vaultDoc;
    }),

  // Batch scan & import from shared drive
  batchImportSharedDrive: orgScopedProcedure
    .input(z.object({
      driveId: z.string(),
      driveName: z.string().default("OMNISCOPE"),
    }))
    .mutation(async ({ input, ctx }) => {
      const { invokeLLM } = await import("../_core/llm");
      
      // Step 1: Recursively scan all files
      console.log(`[Batch Import] Starting scan of shared drive: ${input.driveName}`);
      const allFiles = await googleDrive.scanDriveRecursive(ctx.user.id, undefined, input.driveId);
      console.log(`[Batch Import] Found ${allFiles.length} files`);

      // Step 2: Get existing contacts and companies for matching
      const existingCompanies = await db.getAllCompanies(ctx.orgId);
      const existingContacts = await db.getAllContacts(ctx.orgId);
      const companyNames = (Array.isArray(existingCompanies) ? existingCompanies : []).map((c: any) => ({ id: c.id, name: c.name }));
      const contactNames = (Array.isArray(existingContacts) ? existingContacts : []).map((c: any) => ({ id: c.id, name: c.name, company: c.organization || "" }));

      // Step 3: Check which files are already imported
      const existingDocs = await db.listDocuments({ limit: 1000, orgId: ctx.orgId ?? undefined });
      const importedGoogleIds = new Set(existingDocs.items.filter((d: any) => d.googleFileId).map((d: any) => d.googleFileId));

      const results: Array<{ fileName: string; status: string; docId?: number; category?: string; entities?: string[] }> = [];
      let imported = 0;
      let skipped = 0;

      for (const file of allFiles) {
        // Skip already imported files
        if (importedGoogleIds.has(file.id)) {
          results.push({ fileName: file.name, status: "already_imported" });
          skipped++;
          continue;
        }

        // Skip non-document types
        const isDoc = file.mimeType === "application/vnd.google-apps.document";
        const isSheet = file.mimeType === "application/vnd.google-apps.spreadsheet";
        const isSlide = file.mimeType === "application/vnd.google-apps.presentation";
        const isPdf = file.mimeType === "application/pdf";
        const isDocx = file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const isXlsx = file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        if (!isDoc && !isSheet && !isSlide && !isPdf && !isDocx && !isXlsx) {
          results.push({ fileName: file.name, status: "skipped_unsupported_type" });
          skipped++;
          continue;
        }

        try {
          // Read content for AI analysis (Google Docs only for now)
          let textContent = "";
          if (isDoc) {
            try {
              textContent = await googleDrive.readGoogleDocText(ctx.user.id, file.id) || "";
            } catch { textContent = ""; }
          }

          // AI categorization
          let category = "other";
          let subcategory = "";
          let collection: "company_repo" | "personal" | "counterparty" | "template" | "transaction" | "signed" = "company_repo";
          let matchedEntities: Array<{ type: "company" | "contact"; id: number; name: string }> = [];
          let aiSummary = "";

          const folderContext = file.folderPath || "root";
          const fileName = file.name;

          try {
            const aiResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a document categorization AI for OmniScope, a private financial infrastructure platform. Analyze the document and return JSON.

Existing companies: ${JSON.stringify(companyNames.slice(0, 50))}
Existing contacts: ${JSON.stringify(contactNames.slice(0, 50))}

Categories: agreement, compliance, intake, profile, strategy, operations, transaction, correspondence, template, other
Collections: company_repo (internal company docs), counterparty (client/partner docs), template (reusable templates), transaction (deal-specific), signed (executed docs), personal

Common document types:
- NCNDA = Non-Circumvention Non-Disclosure Agreement → category: agreement, subcategory: NCNDA
- KYB/KYC = Know Your Business/Customer → category: compliance
- SPPP = Specific Performance Purchase Program → category: agreement, subcategory: SPPP
- LOI = Letter of Intent → category: agreement, subcategory: LOI
- MOU = Memorandum of Understanding → category: agreement, subcategory: MOU
- POF = Proof of Funds → category: compliance, subcategory: POF
- BCL = Bank Comfort Letter → category: compliance, subcategory: BCL
- SOP = Standard Operating Procedure → category: operations, subcategory: SOP
- Invoice/Receipt → category: transaction
- Pitch deck/Presentation → category: strategy

Return JSON with: category, subcategory, collection, summary (2 sentences), matchedCompanies (array of company IDs from the list), matchedContacts (array of contact IDs from the list), newEntities (array of {type, name} for entities not in existing lists that should be created).`,
                },
                {
                  role: "user",
                  content: `File: "${fileName}"
Folder path: ${folderContext}
MIME type: ${file.mimeType}
${textContent ? `Content preview (first 2000 chars):\n${textContent.substring(0, 2000)}` : "No text content available - categorize based on filename and folder."}`,
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "doc_categorization",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      subcategory: { type: "string" },
                      collection: { type: "string" },
                      summary: { type: "string" },
                      matchedCompanies: { type: "array", items: { type: "number" } },
                      matchedContacts: { type: "array", items: { type: "number" } },
                      newEntities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            name: { type: "string" },
                          },
                          required: ["type", "name"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["category", "subcategory", "collection", "summary", "matchedCompanies", "matchedContacts", "newEntities"],
                    additionalProperties: false,
                  },
                },
              },
            });

            const parsed = JSON.parse(aiResponse.choices?.[0]?.message?.content || "{}");
            category = parsed.category || "other";
            subcategory = parsed.subcategory || "";
            collection = (["company_repo", "personal", "counterparty", "template", "transaction", "signed"].includes(parsed.collection) ? parsed.collection : "company_repo") as any;
            aiSummary = parsed.summary || "";

            // Match existing entities
            for (const compId of (parsed.matchedCompanies || [])) {
              const comp = companyNames.find((c: any) => c.id === compId);
              if (comp) matchedEntities.push({ type: "company", id: comp.id, name: comp.name });
            }
            for (const contId of (parsed.matchedContacts || [])) {
              const cont = contactNames.find((c: any) => c.id === contId);
              if (cont) matchedEntities.push({ type: "contact", id: cont.id, name: cont.name });
            }

            // Create new entities if needed
            for (const newEnt of (parsed.newEntities || [])) {
              if (newEnt.type === "company" && newEnt.name) {
                // Check if already exists
                const exists = companyNames.find((c: any) => c.name.toLowerCase() === newEnt.name.toLowerCase());
                if (!exists) {
                  const newComp = await db.createCompany({ name: newEnt.name, status: "prospect" });
                  if (newComp) {
                    companyNames.push({ id: newComp.id!, name: newEnt.name });
                    matchedEntities.push({ type: "company", id: newComp.id!, name: newEnt.name });
                  }
                } else {
                  matchedEntities.push({ type: "company", id: exists.id, name: exists.name });
                }
              } else if (newEnt.type === "contact" && newEnt.name) {
                const exists = contactNames.find((c: any) => c.name.toLowerCase() === newEnt.name.toLowerCase());
                if (!exists) {
                  const newCont = await db.createContact({ name: newEnt.name });
                  if (newCont) {
                    contactNames.push({ id: newCont.id!, name: newEnt.name, company: "" });
                    matchedEntities.push({ type: "contact", id: newCont.id!, name: newEnt.name });
                  }
                } else {
                  matchedEntities.push({ type: "contact", id: exists.id, name: exists.name });
                }
              }
            }
          } catch (aiErr: any) {
            console.error(`[Batch Import] AI categorization failed for ${fileName}:`, aiErr.message);
            // Fallback: use folder name for categorization
            const folderLower = folderContext.toLowerCase();
            if (folderLower.includes("kyb") || folderLower.includes("kyc") || folderLower.includes("compliance")) {
              category = "compliance";
            } else if (folderLower.includes("transaction") || folderLower.includes("otc")) {
              category = "transaction";
              collection = "transaction";
            } else if (folderLower.includes("signed")) {
              category = "agreement";
              collection = "signed";
            }
          }

          // Determine source type
          let sourceType: "google_doc" | "google_sheet" | "google_slide" | "pdf" | "uploaded" = "uploaded";
          if (isDoc) sourceType = "google_doc";
          else if (isSheet) sourceType = "google_sheet";
          else if (isSlide) sourceType = "google_slide";
          else if (isPdf) sourceType = "pdf";

          // Create vault document
          const vaultDoc = await db.createDocument({
            title: fileName,
            sourceType,
            googleFileId: file.id,
            googleMimeType: file.mimeType,
            collection,
            category: category as any,
            subcategory,
            status: "active",
            visibility: "organization",
            ownerId: ctx.user.id,
            aiSummary: aiSummary || undefined,
            fileSize: file.size ? parseInt(file.size) : undefined,
          });

          // Add entity links
          if (vaultDoc) {
            for (const entity of matchedEntities) {
              await db.addDocumentEntityLink({
                documentId: vaultDoc.id!,
                entityType: entity.type,
                entityId: entity.id,
                linkType: "primary",
              });
            }
          }

          imported++;
          results.push({
            fileName,
            status: "imported",
            docId: vaultDoc?.id || undefined,
            category,
            entities: matchedEntities.map(e => `${e.type}:${e.name}`),
          });

          console.log(`[Batch Import] Imported: ${fileName} → ${category} (${matchedEntities.length} entities)`);
        } catch (err: any) {
          console.error(`[Batch Import] Failed to import ${file.name}:`, err.message);
          results.push({ fileName: file.name, status: "error", category: err.message });
        }
      }

      // Log activity
      await db.logActivity({
        userId: ctx.user.id,
        action: "batch_import_shared_drive",
        entityType: "document",
        entityId: input.driveId,
        entityName: input.driveName,
        details: JSON.stringify({ totalFiles: allFiles.length, imported, skipped }),
      });

      console.log(`[Batch Import] Complete: ${imported} imported, ${skipped} skipped out of ${allFiles.length} total`);

       return {
        totalScanned: allFiles.length,
        imported,
        skipped,
        results,
      };
    }),

  // Copy individual files from Drive to a Vault folder
  copyToVault: orgScopedProcedure
    .input(z.object({
      files: z.array(z.object({
        googleFileId: z.string(),
        name: z.string(),
        mimeType: z.string(),
        size: z.number().optional(),
      })),
      folderId: z.number().nullable(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
    }))
    .mutation(async ({ input, ctx }) => {
      const results: Array<{ name: string; success: boolean; documentId?: number; error?: string }> = [];
      for (const file of input.files) {
        try {
          // Check if already imported
          const existing = await db.listDocuments({ search: file.name, limit: 1, orgId: ctx.orgId ?? undefined });
          if (existing.items.some((d: any) => d.googleFileId === file.googleFileId)) {
            results.push({ name: file.name, success: true, error: 'Already exists' });
            continue;
          }
          // Determine source type
          let sourceType: 'google_doc' | 'google_sheet' | 'google_slide' | 'pdf' | 'uploaded' = 'uploaded';
          if (file.mimeType === 'application/vnd.google-apps.document') sourceType = 'google_doc';
          else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') sourceType = 'google_sheet';
          else if (file.mimeType === 'application/vnd.google-apps.presentation') sourceType = 'google_slide';
          else if (file.mimeType === 'application/pdf') sourceType = 'pdf';

          const doc = await db.createDocument({
            title: file.name,
            sourceType,
            googleFileId: file.googleFileId,
            googleMimeType: file.mimeType,
            collection: input.collection,
            category: 'other',
            status: 'active',
            visibility: 'organization',
            folderId: input.folderId,
            ownerId: ctx.user!.id,
            fileSize: file.size ?? null,
          });
          results.push({ name: file.name, success: true, documentId: doc?.id });
        } catch (e: any) {
          results.push({ name: file.name, success: false, error: e.message });
        }
      }
      return { imported: results.filter(r => r.success && !r.error).length, skipped: results.filter(r => r.error === 'Already exists').length, failed: results.filter(r => !r.success).length, results };
    }),
});
