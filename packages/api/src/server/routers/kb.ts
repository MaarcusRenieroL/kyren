import { router } from "../trpc";
import { kbArticlesProcedures } from "./kb/articles";
import { kbRevisionsProcedures } from "./kb/revisions";
import { kbTrashProcedures } from "./kb/trash";

export const kbRouter = router({
  ...kbArticlesProcedures,
  ...kbRevisionsProcedures,
  ...kbTrashProcedures,
});
