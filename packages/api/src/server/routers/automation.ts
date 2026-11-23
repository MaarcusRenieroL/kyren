import { router } from "../trpc";
import { automationRulesProcedures } from "./automation/rules";
import { automationActionsProcedures } from "./automation/actions";

export const automationRouter = router({
  ...automationRulesProcedures,
  ...automationActionsProcedures,
});
