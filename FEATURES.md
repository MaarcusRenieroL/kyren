# Kyren — what is built today

A self-hosted, multi-tenant work platform: one workspace per organization, 14 modules that share the same
people, roles, search and audit log. Everything below exists in the code with tests. Status as of 2026-11-20.

## Platform (shared by every module)

- **Accounts:** sign-up, email verification, sign-in, password reset, invitations by link, several organizations per
  person with a switcher.
- **Security:** email two-factor sign-in, an organization-wide "require two-factor" policy, recent-sign-in check for
  dangerous actions, IP allow-list per organization, rate limits, strict security headers (CSP), field-level
  encryption for private text (leave reasons, bank details), suspension of tenants.
- **Roles and permissions:** Owner / Admin / Member plus custom roles; roles at organization, team and project level;
  per-person allow/deny overrides; an "access check" that explains why someone can or can't do something; a
  permission change log. Admins can't act on other admins; only the owner can.
- **Modules:** each module can be turned on or off per organization, with dependency checks.
- **Audit log:** every important change recorded, filterable, exportable to CSV.
- **Search:** a command palette (⌘K) across projects, tasks, docs, people and pages, permission-aware.
- **Notifications:** in-app inbox (mentions, assignments, comments, unblocked tasks), per-person preferences, email
  for mentions.
- **AI (optional, with an Anthropic key):** semantic search, story-point suggestions, ticket triage, chat catch-up and
  translation, meeting recaps, ticket summaries, a "living spec" generator. Off unless an admin turns it on.
- **Privacy:** export my data, erase my data, admin export/erase per person (GDPR), data retention policies, legal
  hold.
- **Administration:** API keys, outgoing webhooks with delivery log, usage page, security overview, custom task
  fields, setup checklist.
- **Platform console** (for the operator): tenant directory, suspension, maintenance mode, seat limits,
  announcements banner, health page, operator audit trail, behind its own role and two-factor.
- **Deploy:** one-VM Docker Compose (Postgres, migrations, app, background jobs, Caddy HTTPS), nightly jobs, health
  check, backups documented.
- **UI:** light and dark mode, works on phone, tablet and desktop, keyboard shortcuts, guided tours, onboarding
  checklist.

## 1. Dashboard (Today and Overview)

- **Today:** your focus task with a start / pause / done timer, your day's progress, what's next, recent work, team
  pulse, last 7 days.
- **Overview** (owners and admins): workspace numbers (done, open, overdue, docs edited, active people), tasks done per
  team per day, per-project health, recent activity — scoped to what the viewer may see.

## 2. Settings

- Profile, password, two-factor, notification preferences, appearance, download my data.
- Organization name and address, members (roles, remove, out of office), teams (members, workload balancer),
  invitations (single or many at once, resend, expiry), modules, roles and access (custom roles, assignments, access
  check, permission log), audit log, automations, danger zone (transfer ownership, delete organization).

## 3. Projects

- Projects with a key prefix (ZEN-1, ZEN-2…), team ownership, visibility (everyone / owning team / only added people),
  project roles, favorites, archive (read-only) and delete.
- Project page: summary, brief, contributors, tasks, linked docs, activity, Gantt timeline, critical path, dependency
  graph, linked discussion thread.

## 4. Tasks

- List, board and calendar views; saved views; filters, grouping and sorting; overview and completed tabs.
- Subtasks, priorities, due dates (viewer's time zone), assignees, story points, custom fields, comments, blockers.
- Sprints with start / complete, burndown and velocity.
- Goals (OKRs): objectives, key results from numbers or linked tasks, check-ins with confidence and notes.
- Recurring tasks, task templates, CSV import, trash with restore.
- Timers and timesheets (weekly), time logs per task, "copy branch name".
- Automations: rules on status change, subtasks done, blockers resolved, task created, due date approaching, chat
  message contains — actions to change status, assign, set priority, post to a channel, create a task. SLA
  escalation.

## 5. Docs

- Rich editor with mentions, slash commands, tables, code; autosave with conflict detection.
- Comment threads (reply, edit, delete, resolve), version history with restore, public share links that can be turned
  off, templates, trash with restore, project docs, recent / my docs / search, living specs linked to tasks.

## 6. Chat

- Public and private channels, project channels, discussion threads on tasks/docs/projects, direct messages and group
  DMs.
- Threads with follow, reactions, pins, edits, deletes, forwards, file attachments with previews, link previews,
  polls, code blocks, custom emoji.
- Saved messages with reminders, drafts, scheduled sending, mentions inbox, catch-up digest, unread markers, typing
  indicators, channel status, canvas, bookmarks, per-channel retention, export, search with filters.

## 7. Files

- Library with folders, upload with size limits and type checks (files pretending to be images are downloaded, not
  shown), usage per organization, rename, move, delete, image thumbnails with fallback.

## 8. Calendar

- Month, week and day views; events with colours; repeating events (daily / weekly / monthly, until) on the creator's
  clock across daylight saving; edit or delete one event, or this and following.
- Time off shown on the calendar.
- Meetings: agenda, invitees with Going / Maybe / Not going, shared notes, video link, AI recap, turning action items
  into tasks, reminders, cancel.

## 9. Whiteboards (built in-house, no third-party library)

- Select, hand, rectangle, ellipse, diamond, arrow, line, pen, text, sticky note, frame, comment pins, images.
- Arrows that stay attached to shapes, styles (stroke, fill, width, dash, opacity, rounded, hand-drawn look), text
  sizes and alignment, grouping, locking, layering, align, copy / paste / duplicate, undo / redo.
- Task cards with live status, templates (retro, kanban, flowchart, brainstorm, weekly), present mode by frames,
  export to PNG / SVG, board overview map, keyboard shortcuts.
- Two people can draw at once (changes merge shape by shape), live cursors and who's here, trash with restore.

## 10. Mail (internal)

- Inbox, sent, drafts, starred, trash; compose with To / Cc, reply, reply all, forward; attachments; read / unread;
  delete forever affects only you. **Internal to the organization only** — no outside email addresses yet.

## 11. Tickets (help desk)

- Ticket queue with tabs (mine, unassigned, open, pending, resolved, spam), priorities, categories, assignment,
  internal notes, linking to tasks, delete.
- SLA targets per priority with due times and overdue flags, automatic round-robin assignment (skips people away).
- Email to ticket, customer portal (follow and reply by private link, no account), intake forms on a public link,
  public help centre with articles, article version history, trash and restore, AI summary.

## 12. HR

- People directory with managers, departments, locations, start / end dates; CSV import.
- Time off: requests, approve / reject, annual allowance, monthly accrual, carry-over, balance shown to each person;
  shown on the calendar.

## 13. Payroll

- Salaries with change history, pay runs per period, off-cycle runs, bonuses and deductions, two-person approval,
  mark paid, payslips for each employee, CSV export (audited).

## 14. Admin

- Overview, usage, security, API keys, webhooks, network (IP allow-list), data retention and legal hold, task fields.
