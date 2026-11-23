import { router } from "../trpc";
import { platformTenantsDirectoryProcedures } from "./platform-tenants/directory";
import { platformTenantsInspectProcedures } from "./platform-tenants/inspect";
import { platformTenantsLifecycleProcedures } from "./platform-tenants/lifecycle";

export { DELETION_GRACE_DAYS, DELETION_REASON } from "./platform-tenants/directory";

export const platformTenantsRouter = router({
  ...platformTenantsDirectoryProcedures,
  ...platformTenantsInspectProcedures,
  ...platformTenantsLifecycleProcedures,
});
