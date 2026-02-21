import * as db from "../db";
import { getGoogleAuthUrl, isGoogleConnected, syncGoogleCalendarEvents } from "../googleCalendar";
import { orgScopedProcedure, router } from "../_core/trpc";

export const onboardingRouter = router({
  status: orgScopedProcedure.query(async ({ ctx }) => {
    const googleStatus = await isGoogleConnected(ctx.user.id);
    return {
      onboardingCompleted: ctx.user.onboardingCompleted ?? false,
      googleConnected: googleStatus.connected,
      hasGmailScopes: googleStatus.hasGmailScopes ?? false,
      hasCalendarScopes: googleStatus.hasCalendarScopes ?? false,
      googleEmail: googleStatus.email ?? null,
    };
  }),

  complete: orgScopedProcedure.mutation(async ({ ctx }) => {
    await db.completeOnboarding(ctx.user.id);
    return { success: true };
  }),
});

// PROFILE ROUTER (Signature System)
