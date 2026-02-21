import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { z } from "zod";

export const employeesRouter = router({
  list: orgScopedProcedure
    .input(z.object({ status: z.string().optional(), department: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getAllEmployees(input ? { ...input, orgId: ctx.orgId ?? undefined } : { orgId: ctx.orgId ?? undefined });
    }),

  getById: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const emp = await db.getEmployeeById(input.id);
      if (!emp) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      // Enrich with payroll and document counts
      const payroll = await db.getPayrollForEmployee(input.id);
      const docs = await db.getDocumentsForEmployee(input.id);
      return { ...emp, payrollCount: payroll.length, documentCount: docs.length };
    }),

  search: orgScopedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input, ctx }) => {
      return await db.searchEmployees(input.query, ctx.orgId ?? undefined);
    }),

  departments: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.getEmployeeDepartments(ctx.orgId ?? undefined);
  }),

  create: orgScopedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      emergencyContactRelation: z.string().optional(),
      hireDate: z.string(),
      department: z.string().optional(),
      jobTitle: z.string().min(1),
      employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).default("full_time"),
      salary: z.string().optional(),
      payFrequency: z.enum(["weekly", "biweekly", "monthly", "per_project"]).optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createEmployee({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        emergencyContactRelation: input.emergencyContactRelation ?? null,
        hireDate: input.hireDate,
        department: input.department ?? null,
        jobTitle: input.jobTitle,
        employmentType: input.employmentType,
        salary: input.salary ?? null,
        payFrequency: input.payFrequency ?? "monthly",
        currency: input.currency ?? "USD",
        notes: input.notes ?? null,
      });
      return { id };
    }),

  update: orgScopedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      dateOfBirth: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      emergencyContactName: z.string().nullable().optional(),
      emergencyContactPhone: z.string().nullable().optional(),
      emergencyContactRelation: z.string().nullable().optional(),
      department: z.string().nullable().optional(),
      jobTitle: z.string().optional(),
      employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
      status: z.enum(["active", "inactive", "terminated", "on_leave"]).optional(),
      salary: z.string().nullable().optional(),
      payFrequency: z.enum(["weekly", "biweekly", "monthly", "per_project"]).nullable().optional(),
      currency: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      await db.updateEmployee(id, cleanUpdates);
      return { success: true };
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteEmployee(input.id);
      return { success: true };
    }),

  uploadPhoto: orgScopedProcedure
    .input(z.object({ id: z.number(), base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const ext = input.mimeType.split('/')[1] || 'jpg';
      const key = `employees/${input.id}/photo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updateEmployee(input.id, { photoUrl: url });
      return { url };
    }),
});
