# Slop candidates

`/harden` adds items here. Mark `[x]` to approve deletion, then run `/desloper`.
Nothing here is deleted without your `[x]`.

<!-- example
## tasks
- [ ] apps/web/src/components/tasks/branch-name-generator.tsx — no route renders it, no test
-->

## ai (cross-cutting assistant, added 2026-11-18)

- [ ] packages/api/src/server/routers/ai.ts `detectDuplicateTickets` — no UI caller; permission-scoped and tested, but
      nothing uses it
- [ ] packages/api/src/server/routers/ai.ts `generateLivingSpec` — no UI caller
- [ ] packages/api/src/server/routers/ai.ts `sprintBriefing` — no UI caller
- [ ] packages/api/src/server/routers/search.ts `searchById` — no UI caller (now permission-scoped and tested)

## dashboard (found 2026-11-18)

- [ ] apps/web/src/lib/dashboard-data.ts `getDashboardData` — no page calls it any more; its `workspaceStats`,
      `activityPills`, `tasks` and `modules` (11 count/list queries) were computed on every Today and Overview load and
      never shown. Tested only for permission scoping (`scoped-access`, `project-visibility`, `activity-feed`). Pages now
      use `getRecentWork` / `getRecentActivity`. Either delete it and move those tests onto the two lean functions, or give
      the stats a screen.
- [ ] apps/web/src/lib/dashboard-data.ts types `DashboardStat`, `DashboardActivityPill`, `DashboardTaskItem` — used
      only by `getDashboardData` above; they go with it (found 2026-11-19 by the dashboard harden pass)
