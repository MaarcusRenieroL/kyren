# Zentro

Multi-tenant work platform. Turborepo: `apps/web` (Next.js) + `packages/*` (tRPC api, Drizzle db, events).
14 modules in the module registry (`packages/modules/src/registry.ts`). Postgres (Neon), Vercel.

## Commands

- `pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright)
- Single module E2E: `pnpm test:e2e --grep @<module>` (tags: @dashboard @settings @projects @tasks @docs @chat @files @calendar @whiteboards @mail @tickets @hr @payroll @admin, plus @auth @security @ui).

## Definition of done (every task)

1. Typecheck, lint, unit tests and the module's E2E specs are green.
2. Every new procedure checks permissions and has a denial test.
3. No dead code, no commented-out code, no TODOs left behind.
4. Run the `reviewer` agent on the diff before declaring done.

## Rules

- One module per session. Do not touch other modules unless a test proves the bug lives there.
- Use the `explorer` agent for codebase questions instead of reading many files here.
- Consult the advisor: before locking a plan, after the same error twice, before declaring done.
- Never weaken, skip or delete a test to make it pass. Fix the code or report why the test is wrong.
- Features with no route, no test and no caller are slop: list them in `SLOP.md`, don't delete them yourself.
- E2E selectors: `getByRole` / `getByLabel` first, `data-testid` only as fallback. No CSS selectors, no fixed sleeps.

## Progress

Module status lives in `MODULES.md`. Update it at the end of every session.
