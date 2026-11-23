---
description: Harden one module end to end — map, test, fix, de-slop, review. Usage: /harden <module>
argument-hint: <module-name>
---
Harden the `$ARGUMENTS` module. Work autonomously; don't ask me questions unless a decision is irreversible.

1. `echo $ARGUMENTS > .claude/current-module` (this arms the stop gate for this module's E2E).
2. Use the `explorer` agent to map `$ARGUMENTS`. Consult the advisor on the test plan.
3. Use the `test-writer` agent to write and run `e2e/$ARGUMENTS.spec.ts`.
4. Use the `fixer` agent until every test is green.
5. Append orphans from step 2 to `SLOP.md` under `## $ARGUMENTS` (path + why it looks dead). Don't delete them.
6. Use the `reviewer` agent. Fix every BLOCKER, then re-run the module's tests.
7. Commit: `harden($ARGUMENTS): e2e + fixes`.
8. Update `MODULES.md`: status, test count, bugs fixed, open issues.
9. `rm .claude/current-module`.

Final message: tests written, bugs fixed, slop candidates, open issues. Max 15 lines.
