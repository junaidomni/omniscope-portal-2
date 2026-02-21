import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const usersRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllUsers();
  }),
});
