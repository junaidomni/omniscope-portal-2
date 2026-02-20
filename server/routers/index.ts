import { getSessionCookieOptions } from "../_core/cookies";
import { systemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";

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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
