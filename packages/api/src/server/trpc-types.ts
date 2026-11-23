export type ProcedureMeta = {
  /**
   * Permission keys the procedure enforces (any of them is enough). The
   * coverage test requires every procedure to declare keys here or to be on
   * the explicit allowlist.
   */
  permissions?: string[];
  /**
   * Activity event keys a mutation writes (any of them is enough). After the
   * mutation succeeds, the audit guard checks that one was recorded through
   * `ctx.audit`. The sweep test requires every mutation to declare keys.
   */
  audit?: string[];
  /** Set by platformProcedure: the call is for platform operators, outside any organization. */
  platform?: boolean;
};
