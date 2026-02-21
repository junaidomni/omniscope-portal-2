import * as db from "../db";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { users } from "../../drizzle/schema";
import { z } from "zod";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getUserProfile(ctx.user.id);
    return {
      userId: ctx.user.id,
      name: ctx.user.name || "",
      email: ctx.user.email || "",
      title: profile?.title || "",
      division: profile?.division || "",
      phone: profile?.phone || "",
      location: profile?.location || "",
      website: profile?.website || "omniscopex.ae",
      tagline: profile?.tagline || "",
      signatureEnabled: profile?.signatureEnabled ?? true,
      profilePhotoUrl: ctx.user.profilePhotoUrl || null,
    };
  }),

  uploadPhoto: protectedProcedure
    .input(z.object({ base64: z.string(), fileName: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `user-photos/${ctx.user.id}/profile-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const database = await db.getDb();
      if (database) {
        await database.update(users).set({ profilePhotoUrl: url }).where(eq(users.id, ctx.user.id));
      }
      return { url };
    }),

  update: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        division: z.string().optional(),
        phone: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        tagline: z.string().optional(),
        signatureEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await db.upsertUserProfile(ctx.user.id, input);
      return profile;
    }),

  getSignatureHtml: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getUserProfile(ctx.user.id);
    const name = ctx.user.name || "";
    const title = profile?.title || "";
    const division = profile?.division || "";
    const phone = profile?.phone || "";
    const location = profile?.location || "";
    const website = profile?.website || "omniscopex.ae";
    const tagline = profile?.tagline || "Private Markets | Digital Assets | Institutional Infrastructure";

    const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 13px; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 2px solid #b8860b;">
  <div style="font-weight: 600; font-size: 14px; color: #111;">${name}</div>
  ${title || division ? `<div style="color: #666; font-size: 12px; margin-top: 2px;">${[title, division].filter(Boolean).join(" | ")}</div>` : ""}
  <div style="margin-top: 8px; font-size: 12px; color: #888;">
    <div style="font-weight: 500; color: #111;">OmniScope</div>
    <div style="color: #999; font-size: 11px;">${tagline}</div>
  </div>
  <div style="margin-top: 6px; font-size: 11px; color: #999;">
    ${[website ? `<a href="https://${website}" style="color: #b8860b; text-decoration: none;">${website}</a>` : "", phone, location].filter(Boolean).join(" &middot; ")}
  </div>
  <div style="margin-top: 10px; font-size: 10px; color: #bbb; font-style: italic;">This message may contain confidential information. If you are not the intended recipient, please notify the sender and delete this message.</div>
</div>`;

    return { html, enabled: profile?.signatureEnabled ?? true };
  }),
});

// DIRECTORY ROUTER — Unified autocomplete & person cards
