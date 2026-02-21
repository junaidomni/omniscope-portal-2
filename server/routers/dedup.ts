import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const dedupRouter = router({
  scan: orgScopedProcedure.mutation(async ({ ctx }) => {
    const allContacts = await db.getAllContacts(ctx.orgId);
    const approved = allContacts.filter((c: any) => c.approvalStatus === "approved");
    const clusters: Array<{ contacts: typeof approved; confidence: number; reason: string }> = [];

    for (let i = 0; i < approved.length; i++) {
      for (let j = i + 1; j < approved.length; j++) {
        const a = approved[i];
        const b = approved[j];
        if (!a.name || !b.name) continue;

        // Exact email match
        if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
          clusters.push({ contacts: [a, b], confidence: 95, reason: "Same email address" });
          continue;
        }

        // Name similarity
        const nameA = a.name.toLowerCase().trim();
        const nameB = b.name.toLowerCase().trim();
        if (nameA === nameB) {
          clusters.push({ contacts: [a, b], confidence: 90, reason: "Exact name match" });
          continue;
        }

        // Name parts swap ("Jake Ryan" vs "Ryan Jake")
        const partsA = nameA.split(/\s+/).sort();
        const partsB = nameB.split(/\s+/).sort();
        if (partsA.length > 1 && partsB.length > 1 && partsA.join(" ") === partsB.join(" ")) {
          clusters.push({ contacts: [a, b], confidence: 85, reason: "Name parts match (reordered)" });
          continue;
        }

        // First name + same org
        if (partsA[0] === partsB[0] && a.organization && b.organization &&
            a.organization.toLowerCase() === b.organization.toLowerCase()) {
          clusters.push({ contacts: [a, b], confidence: 70, reason: "Same first name + same organization" });
          continue;
        }

        // Levenshtein-like similarity for short names
        if (nameA.length > 3 && nameB.length > 3) {
          const maxLen = Math.max(nameA.length, nameB.length);
          let matches = 0;
          const shorter = nameA.length <= nameB.length ? nameA : nameB;
          const longer = nameA.length <= nameB.length ? nameB : nameA;
          for (let k = 0; k < shorter.length; k++) {
            if (longer.includes(shorter[k])) matches++;
          }
          const similarity = matches / maxLen;
          if (similarity > 0.85 && Math.abs(nameA.length - nameB.length) <= 2) {
            clusters.push({ contacts: [a, b], confidence: 60, reason: "High name similarity" });
          }
        }
      }
    }

    // Sort by confidence descending
    clusters.sort((a, b) => b.confidence - a.confidence);
    return { clusters: clusters.slice(0, 50), totalScanned: approved.length };
  }),

  merge: orgScopedProcedure
    .input(z.object({ keepId: z.number(), mergeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const keep = await db.getContactById(input.keepId);
      const merge = await db.getContactById(input.mergeId);
      if (!keep || !merge) throw new TRPCError({ code: "NOT_FOUND" });

      const mergeMeetings = await db.getMeetingsForContact(input.mergeId);
      for (const mm of mergeMeetings) {
        try { await db.linkContactToMeeting(mm.meeting.id, input.keepId); } catch {}
      }
      const updates: any = {};
      if (!keep.email && merge.email) updates.email = merge.email;
      if (!keep.phone && merge.phone) updates.phone = merge.phone;
      if (!keep.organization && merge.organization) updates.organization = merge.organization;
      if (!keep.title && merge.title) updates.title = merge.title;
      if (!keep.dateOfBirth && merge.dateOfBirth) updates.dateOfBirth = merge.dateOfBirth;
      if (!keep.address && merge.address) updates.address = merge.address;
      if (!keep.website && merge.website) updates.website = merge.website;
      if (!keep.linkedin && merge.linkedin) updates.linkedin = merge.linkedin;
      if (Object.keys(updates).length > 0) await db.updateContact(input.keepId, updates);
      await db.deleteContact(input.mergeId);

      await db.logActivity({
        userId: ctx.user.id,
        action: "dedup_merge",
        entityType: "contact",
        entityId: String(input.keepId),
        entityName: keep.name,
        details: `Dedup merged "${merge.name}" into "${keep.name}"`,
        metadata: JSON.stringify({ keepId: input.keepId, mergeId: input.mergeId, mergeName: merge.name }),
      });
      return { success: true };
    }),

  dismiss: orgScopedProcedure
    .input(z.object({ contactAId: z.number(), contactBId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.logActivity({
        userId: ctx.user.id,
        action: "dedup_dismiss",
        entityType: "contact",
        entityId: `${input.contactAId},${input.contactBId}`,
        details: "Dismissed duplicate suggestion as false positive",
      });
      return { success: true };
    }),
});
