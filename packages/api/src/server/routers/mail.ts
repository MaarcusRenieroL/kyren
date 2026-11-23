import { router } from "../trpc";
import { mailListProcedures } from "./mail/list";
import { mailReadProcedures } from "./mail/read";
import { mailMutationsProcedures } from "./mail/mutations";

export { canSeeMessage } from "./mail/helpers";

export const mailRouter = router({
  ...mailListProcedures,
  ...mailReadProcedures,
  ...mailMutationsProcedures,
});
