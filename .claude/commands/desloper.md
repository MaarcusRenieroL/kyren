---
description: Remove the slop candidates I approved in SLOP.md. Usage: /desloper
---
Read `SLOP.md`. Only act on lines I marked `[x]`. Leave `[ ]` lines alone.

For each approved item:
1. Use `explorer` to confirm nothing still imports it.
2. Delete it (and its now-unused tests, routes, DB code — but write a migration for tables, never drop data silently).
3. Run typecheck, lint, unit tests and the full E2E suite.

Commit as `chore: remove slop (<n> items)`. Report what was removed and lines deleted.
