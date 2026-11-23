import { router } from "../trpc";
import { whiteboardReadProcedures } from "./whiteboard/read";
import { whiteboardMutationsProcedures } from "./whiteboard/mutations";

export { mergeBoard, tombstone, type BoardElement } from "./whiteboard/schema";

export const whiteboardRouter = router({
  ...whiteboardReadProcedures,
  ...whiteboardMutationsProcedures,
});
