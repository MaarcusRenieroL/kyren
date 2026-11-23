import { router } from "../trpc";
import { filesUploadProcedures } from "./files/upload";
import { filesLibraryProcedures } from "./files/library";
import { filesFoldersProcedures } from "./files/folders";

export { canReadFile, MAX_FILE_BYTES } from "./files/access";

export const filesRouterProcedures = {
  ...filesUploadProcedures,
  ...filesLibraryProcedures,
  ...filesFoldersProcedures,
};

export const filesRouter = router(filesRouterProcedures);
