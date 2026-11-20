# Zentro roadmap — features to build

Everything here is self-contained: no Google, Microsoft or other third-party sign-in or sync. Outgoing email keeps
using the existing email provider (Resend). Effort is focused working days including tests.

Status: `[ ]` to do · `[~]` in progress · `[x]` done (with the commit).

## Build order

Highest value for the effort first. Each item is committed on its own.

### Phase 1 — quick wins that users notice at once

1. [x] **Authenticator-app two-factor (TOTP)** — already built (setup with QR code, backup codes, sign-in step); a stale
       "coming" note on the Security page was removed.
2. [x] **Tickets: canned replies** — saved answers an agent inserts with one click; per-org, with variables. (0.5 day)
3. [ ] **Tickets: satisfaction rating** — the customer rates a resolved ticket from the portal; score per agent. (0.5 day)
4. [ ] **Projects: milestones** — dated milestones on a project, shown on the Gantt, with tasks linked. (1 day)
5. [ ] **Projects: status updates** — weekly on-track / at-risk / off-track update with a note, history. (0.5 day)
6. [ ] **Files: share links** — expiring, revocable link to one file for people outside. (0.5 day)
7. [ ] **Files: versions** — upload a new version of a file, keep and restore old ones. (1 day)
8. [ ] **Calendar: subscribe feed (.ics)** — a private URL any calendar app can subscribe to. (0.5 day)
9. [ ] **Calendar: event reminders** — remind attendees N minutes before by notification and email. (0.5 day)
10. [ ] **HR: onboarding / offboarding checklists** — templates, assigned to a person on start / leave. (1 day)
11. [ ] **HR: employee documents** — contracts and IDs per person, with expiry reminders. (1 day)
12. [ ] **HR: org chart** — the reporting tree from managers. (0.5 day)
13. [ ] **Whiteboards: voting and timer** — dot-voting on stickies and a shared timer for workshops. (1 day)
14. [ ] **Whiteboards: mind-map mode** — Tab / Enter to add child and sibling nodes, auto layout. (1 day)
15. [ ] **Docs: export to PDF and Markdown** (0.5 day)
16. [ ] **Docs: backlinks** — "pages that link here". (0.5 day)
17. [ ] **Tasks: workload view** — open work per person per week across projects. (1 day)
18. [ ] **Tasks: request forms** — a form that creates a task in a project, for people inside the org. (1 day)

### Phase 2 — the foundation that upgrades four modules

19. [ ] **Real-time server** — a small WebSocket service on the VM (no third party), authenticated per organization.
        Chat messages, typing, notifications and board changes arrive instantly instead of every few seconds. (3–4 days)
20. [ ] **Whiteboards: live co-editing** on the real-time server. (1 day)
21. [ ] **Docs: live co-editing and presence** — several people in one doc at once. (3–4 days)

### Phase 3 — bigger module upgrades

22. [ ] **Mail: real email** — send to outside addresses through the existing email provider, receive at the
        organization's inbound address, threading by message headers, HTML rendering, spam filtering. (4–5 days)
23. [ ] **Mail: shared team inboxes** — a team address with assignment and status. (2 days)
24. [ ] **Calendar: free/busy and booking links** — see colleagues' busy times; a public "book time with me" page.
        (3 days)
25. [ ] **Calendar: rooms and resources** — bookable rooms with clash checks. (1 day)
26. [ ] **Projects: portfolio view** — all projects with status, progress and dates in one table. (1 day)
27. [ ] **Projects: budgets** — budget vs time logged and cost. (1 day)
28. [ ] **Projects: templates** — create a project with its tasks, docs and milestones from a template. (1 day)
29. [ ] **Files: in-browser previews for PDF and video** (1 day)
30. [ ] **Files: storage quota per team** (0.5 day)
31. [ ] **HR: performance reviews and 1:1 notes** (2 days)
32. [ ] **HR: applicant tracking** — job posts, candidates, stages, interview notes. (3 days)
33. [ ] **Payroll: configurable tax and deduction rules** per organization. (2 days)
34. [ ] **Payroll: year-end summary per employee** (1 day)
35. [ ] **Payroll: bank payment file (NACHA / SEPA)** — needs the owner's decision on storing bank details. (2 days)
36. [ ] **Tickets: live chat widget** for a customer's own website. (3 days)
37. [ ] **Tickets: reporting** — volume, first response, resolution time, SLA hit rate. (1 day)
38. [ ] **Tasks: report builder** — pick filters, group-by and a chart; save to the dashboard. (2 days)
39. [ ] **Dashboard: custom widgets** — each person arranges their own Today. (2 days)
40. [ ] **Chat: voice huddles** — browser-to-browser audio (WebRTC) with a self-hosted TURN server. (4–5 days)

### Phase 4 — platform

41. [ ] **Installable app (PWA)** — add to home screen, offline read of recent pages. (1 day)
42. [ ] **Public API documentation page** for the existing API keys. (1 day)
43. [ ] **Email digests** — a daily or weekly summary of what changed. (1 day)
44. [ ] **Import from CSV for projects, people and tickets** (task and people import exist). (1 day)

## Totals

- Phase 1: about 13 days. Phases 1–2: about 22 days. Everything: about 3 months.

## Before any phase ships to outside users

Run Strix (on a throwaway copy, never on real data) and Greptile, fix their findings, and finish the per-module
security pass for the 12 modules that have not had it (see `MODULES.md`).
