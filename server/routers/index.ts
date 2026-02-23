import { getSessionCookieOptions } from "../_core/cookies";
import { systemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

import { meetingsRouter } from "./meetings";
import { contactsRouter } from "./contacts";
import { employeesRouter } from "./employees";
import { payrollRouter } from "./payroll";
import { hrDocumentsRouter } from "./hr-documents";
import { aiInsightsRouter } from "./ai-insights";
import { tasksRouter } from "./tasks";
import { tagsRouter } from "./tags";
import { usersRouter } from "./users";
import { ingestionRouter } from "./ingestion";
import { exportRouter } from "./export";
import { recapRouter } from "./recap";
import { askRouter } from "./ask";
import { adminRouter } from "./admin";
import { meetingCategoriesRouter } from "./meeting-categories";
import { analyticsRouter } from "./analytics";
import { companiesRouter } from "./companies";
import { interactionsRouter } from "./interactions";
import { searchRouter } from "./search";
import { mailRouter } from "./mail";
import { onboardingRouter } from "./onboarding";
import { profileRouter } from "./profile";
import { directoryRouter } from "./directory";
import { triageRouter } from "./triage";
import { activityLogRouter } from "./activity-log";
import { dedupRouter } from "./dedup";
import { vaultRouter } from "./vault";
import { driveRouter } from "./drive";
import { templateRouter } from "./templates";
import { signingRouter } from "./signing";
import { integrationsRouter } from "./integrations";
import { designRouter } from "./design";
import { organizationsRouter } from "./organizations";
import { adminHubRouter } from "./admin-hub";
import { plansRouter } from "./plans";
import { digestRouter } from "./digest";
import { accountConsoleRouter } from "./account-console";
import { communicationsRouter } from "./communications";
import { fileUploadRouter } from "./fileUpload";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateNotificationPreferences: publicProcedure
      .input(z.object({
        callNotifications: z.boolean(),
        soundVolume: z.number().min(0).max(100),
        deliveryMethod: z.enum(["browser", "in-app", "both"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("Not authenticated");
        }
        
        const db = await getDb();
        await db.update(users)
          .set({ notificationPreferences: JSON.stringify(input) })
          .where(eq(users.id, ctx.user.id));
        
        return { success: true };
      }),
  }),
  meetings: meetingsRouter,
  contacts: contactsRouter,
  tasks: tasksRouter,
  tags: tagsRouter,
  users: usersRouter,
  ingestion: ingestionRouter,
  analytics: analyticsRouter,
  ask: askRouter,
  recap: recapRouter,
  export: exportRouter,
  admin: adminRouter,
  meetingCategories: meetingCategoriesRouter,
  employees: employeesRouter,
  payroll: payrollRouter,
  hrDocuments: hrDocumentsRouter,
  aiInsights: aiInsightsRouter,
  companies: companiesRouter,
  interactions: interactionsRouter,
  search: searchRouter,
  mail: mailRouter,
  onboarding: onboardingRouter,
  profile: profileRouter,
  directory: directoryRouter,
  triage: triageRouter,
  activityLog: activityLogRouter,
  dedup: dedupRouter,
  vault: vaultRouter,
  templates: templateRouter,
  signing: signingRouter,
  drive: driveRouter,
  integrations: integrationsRouter,
  design: designRouter,
  organizations: organizationsRouter,
  adminHub: adminHubRouter,
  plans: plansRouter,
  digest: digestRouter,
  accountConsole: accountConsoleRouter,
  communications: communicationsRouter,
  fileUpload: fileUploadRouter,
});

export type AppRouter = typeof appRouter;
