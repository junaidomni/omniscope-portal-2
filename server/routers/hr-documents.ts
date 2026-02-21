import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { z } from "zod";

export const hrDocumentsRouter = router({
  list: orgScopedProcedure
    .input(z.object({ employeeId: z.number(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getDocumentsForEmployee(input.employeeId, input.category);
    }),

  upload: orgScopedProcedure
    .input(z.object({
      employeeId: z.number(),
      title: z.string().min(1),
      category: z.enum(["contract", "id_document", "tax_form", "certification", "onboarding", "performance", "payslip", "invoice", "receipt", "other"]).default("other"),
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      fileSize: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const key = `hr-docs/${input.employeeId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const id = await db.createHrDocument({
        employeeId: input.employeeId,
        title: input.title,
        category: input.category,
        fileUrl: url,
        fileKey: key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? buffer.length,
        notes: input.notes ?? null,
        uploadedBy: ctx.user.id,
        uploadedByName: ctx.user.name ?? "Unknown",
      });
      return { id, url };
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteHrDocument(input.id);
      return { success: true };
    }),
});
