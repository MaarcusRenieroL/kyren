---
description: Build a new module from its approved spec, then harden it. Usage: /build <module>
argument-hint: <module-name>
---
Build the `$ARGUMENTS` module autonomously.

1. Confirm `specs/$ARGUMENTS.md` has `STATUS: APPROVED`. If not, stop.
2. `echo $ARGUMENTS > .claude/current-module`.
3. Consult the advisor on the build plan.
4. Use `test-writer` to turn the spec's acceptance criteria into `e2e/$ARGUMENTS.spec.ts` FIRST. They must fail (nothing exists yet).
5. Use `builder` to implement until they pass.
6. Run the full `/harden $ARGUMENTS` flow (all 12 no-mercy layers, fixer, reviewer).
7. Commit `feat($ARGUMENTS): ...`, update `MODULES.md` to `hardened`, `rm .claude/current-module`.

Final report: what was built, test table, open issues, a 5-step manual test script for me. Max 20 lines.
