import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const directoryRouter = router({
  search: orgScopedProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(15) }))
    .query(async ({ input, ctx }) => {
      return await db.directorySearch(input.query, input.limit, ctx.orgId ?? undefined);
    }),

  personCard: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPersonCard(input.contactId);
    }),

  findByEmail: orgScopedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const contact = await db.findContactByEmail(input.email);
      const company = await db.findCompanyByEmailDomain(input.email);
      return { contact, company };
    }),

  quickCreateContact: orgScopedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      organization: z.string().optional(),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check if contact already exists
      const existing = await db.findContactByEmail(input.email);
      if (existing) return { contact: existing, created: false };

      // Auto-detect company from domain
      let companyId = input.companyId ?? null;
      if (!companyId) {
        const company = await db.findCompanyByEmailDomain(input.email);
        if (company) companyId = company.id;
      }

      const contact = await db.getOrCreateContact(
        input.name,
        input.organization,
        input.email,
      );
      // Link to company if found
      if (companyId && contact) {
        await db.updateContact(contact.id, { companyId });
      }
      return { contact, created: true };
    }),
});

// TRIAGE ROUTER — Unified attention feed
