import * as recapGenerator from "../recapGenerator";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const recapRouter = router({
  generate: orgScopedProcedure
    .input(z.object({
      meetingId: z.number(),
      recipientName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await recapGenerator.generateMeetingRecap(input.meetingId, input.recipientName);
    }),
});
