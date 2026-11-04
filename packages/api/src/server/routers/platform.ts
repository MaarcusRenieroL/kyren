import { platformProcedure, router } from "../trpc";

export const platformRouter = router({
  /** Who the console is open to; the guard has already checked the caller. */
  me: platformProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
  })),
});
