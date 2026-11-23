import { router } from "../trpc";
import { docQueriesProcedures } from "./doc/queries";
import { docCreateProcedures } from "./doc/create";
import { docEditProcedures } from "./doc/edit";
import { docTrashProcedures } from "./doc/trash";
import { docCommentsProcedures } from "./doc/comments";
import { docVersionsProcedures } from "./doc/versions";

export const docsRouter = router({
  ...docQueriesProcedures,
  ...docCreateProcedures,
  ...docEditProcedures,
  ...docTrashProcedures,
  ...docCommentsProcedures,
  ...docVersionsProcedures,
});
