import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const companiesRouter = router({
  list: orgScopedProcedure
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getAllCompanies(ctx.orgId ?? undefined);
    }),

  getById: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      return company;
    }),

  getProfile: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      const people = await db.getPeopleForCompany(input.id);
      const companyInteractions = await db.getInteractionsForCompany(input.id, 100);
      const companyTasks = await db.getTasksForCompany(input.id);
      return { ...company, people, interactions: companyInteractions, tasks: companyTasks };
    }),

  create: orgScopedProcedure
    .input(z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      industry: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "partner"]).optional(),
      owner: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createCompany({
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "active",
        owner: input.owner ?? null,
      });
      return { id };
    }),

  update: orgScopedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      domain: z.string().optional(),
      industry: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "partner"]).optional(),
      owner: z.string().optional(),
      aiMemory: z.string().optional(),
      logoUrl: z.string().optional(),
      approvalStatus: z.enum(["approved", "pending", "rejected"]).optional(),
      location: z.string().nullable().optional(),
      internalRating: z.number().min(1).max(5).nullable().optional(),
      jurisdictionRisk: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
      bankingPartner: z.string().nullable().optional(),
      custodian: z.string().nullable().optional(),
      regulatoryExposure: z.string().nullable().optional(),
      entityType: z.enum(["sovereign", "private", "institutional", "family_office", "other"]).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      // If name is being updated, propagate across the system
      if (cleanUpdates.name) {
        const oldCompany = await db.getCompanyById(id);
        if (oldCompany && oldCompany.name !== cleanUpdates.name) {
          await db.propagateCompanyNameChange(id, oldCompany.name, cleanUpdates.name);
        }
      }
      await db.updateCompany(id, cleanUpdates);
      return { success: true };
    }),

  approve: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.id);
      await db.updateCompany(input.id, { approvalStatus: "approved" });
      await db.logActivity({ userId: ctx.user.id, action: "approve_company", entityType: "company", entityId: String(input.id), entityName: company?.name || "Unknown" });
      return { success: true };
    }),

  reject: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.id);
      await db.updateCompany(input.id, { approvalStatus: "rejected" });
      await db.logActivity({ userId: ctx.user.id, action: "reject_company", entityType: "company", entityId: String(input.id), entityName: company?.name || "Unknown" });
      return { success: true };
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCompany(input.id);
      return { success: true };
    }),

  refreshAiMemory: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });
      const people = await db.getPeopleForCompany(input.id);
      const companyInteractions = await db.getInteractionsForCompany(input.id, 50);
      
      const { invokeLLM } = await import("../_core/llm");
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an institutional relationship intelligence analyst for OmniScope, a sovereign-grade financial infrastructure platform. Generate a concise, executive-level company brief." },
          { role: "user", content: `Generate a rolling AI memory brief for this company:\n\nCompany: ${company.name}\nDomain: ${company.domain || "N/A"}\nIndustry: ${company.industry || "N/A"}\nStatus: ${company.status}\n\nAssociated People (${people.length}):\n${people.map(p => `- ${p.name} (${p.title || "No title"}, ${p.email || "No email"})`).join("\n")}\n\nRecent Interactions (${companyInteractions.length}):\n${companyInteractions.slice(0, 20).map(i => `- [${i.type}] ${new Date(i.timestamp).toLocaleDateString()}: ${i.summary || "No summary"}`).join("\n")}\n\nProvide a structured brief with:\n1. Company Overview (who they are, what they do)\n2. Relationship Status (how engaged we are)\n3. Key People & Contacts\n4. Current Workstreams / Active Discussions\n5. Open Loops & Next Steps\n6. Risk Flags (if any)` },
        ],
      });
      const aiMemory = String(response.choices?.[0]?.message?.content || "");
      await db.updateCompany(input.id, { aiMemory });
      return { aiMemory };
    }),
});
