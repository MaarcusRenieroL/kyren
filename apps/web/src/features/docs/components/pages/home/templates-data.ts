import {
  SparklesIcon,
  Code2Icon,
  LayersIcon,
  UsersIcon,
  FlameIcon,
  CheckSquareIcon,
  type LucideIcon,
} from "lucide-react";

export type TemplateItem = {
  id: string;
  title: string;
  badge: string;
  icon: LucideIcon;
  accent: string;
  hint: string;
  content: string;
};

export const templates: readonly TemplateItem[] = [
  {
    id: "spec",
    title: "Product Requirement Spec (PRD)",
    badge: "Product",
    icon: SparklesIcon,
    accent: "bg-warning-subtle text-warning-text border-warning/20",
    hint: "Problem, user stories, functional scope & task checklist",
    content: `# Product Requirement Document: [Feature Name]

## Problem Statement
What problem does this solve for our users? Why are we prioritizing it now?

## Goals & Non-Goals
- **Goal:** Primary outcome with clear success metrics.
- **Non-Goal:** Scope intentionally deferred to future iterations.

## User Personas & Stories
- As a developer, I want to compile specs directly into tasks.
- As a lead, I want real-time visibility into spec implementation progress.

## Scope & Action Items
- [ ] Define database schema and migrations
- [ ] Implement backend API endpoints and access rules
- [ ] Build split-canvas editor view
- [ ] Add automated unblocking and notifications

## Open Questions & Risks
- [ ] Edge cases under network partition
`,
  },
  {
    id: "rfc",
    title: "Technical RFC & Architecture",
    badge: "Engineering",
    icon: Code2Icon,
    accent: "bg-signal-subtle text-signal border-signal/20",
    hint: "System design, API contracts, schemas & rollout",
    content: `# Technical RFC: [System / Architecture Title]

## Overview
High-level summary of the proposed architectural change.

## Architecture & Data Flow
\`\`\`
Client -> API Route -> Event Engine -> PostgreSQL
\`\`\`

## Data Models & Schema Migrations
- Schema tables, indexes, and referential constraints
- Migration plan with zero downtime guarantees

## API Contracts & Payloads
- Request and response schemas
- Error codes and validation behaviors

## Security, Scale & Failure Modes
- Permission checks and rate limits
- Rollback plan and disaster recovery
`,
  },
  {
    id: "adr",
    title: "Architecture Decision (ADR)",
    badge: "Architecture",
    icon: LayersIcon,
    accent: "bg-tint-docs text-ink border-hairline-strong",
    hint: "Context, decision, tradeoffs & alternatives",
    content: `# Architecture Decision Record: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What forces, requirements, and constraints are driving this decision?

## Decision
What is the architecture choice we are committing to?

## Alternatives Considered
1. **Option A:** Advantages and trade-offs.
2. **Option B:** Advantages and trade-offs.

## Consequences & Tradeoffs
- Positive impacts on developer velocity and maintainability.
- Operational overhead and known limitations.
`,
  },
  {
    id: "meeting",
    title: "Meeting Notes & Action Items",
    badge: "Team",
    icon: UsersIcon,
    accent: "bg-success-subtle text-success-text border-success/20",
    hint: "Agendas, key decisions, follow-up tickets",
    content: `# Sync & Planning Notes

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Attendees:** Team

## Agenda Topics
- Sprint review and velocity update
- Architectural blockers
- Cross-project dependencies

## Key Decisions
- Agreed on schema migration strategy
- Approved PRD for next milestone

## Action Items
- [ ] Unblock critical path task dependency
- [ ] Review pending pull request
- [ ] Update documentation on knowledge base
`,
  },
  {
    id: "postmortem",
    title: "Incident Postmortem (RCA)",
    badge: "Operations",
    icon: FlameIcon,
    accent: "bg-danger-subtle text-danger-text border-danger/20",
    hint: "Root cause, timeline, preventive fixes",
    content: `# Incident Postmortem: [Incident Name]

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Severity:** P1 / P2  
**Impact:** Total downtime and affected users

## Executive Summary
Brief summary of the incident and impact.

## Timeline (UTC)
- **10:00** - Alert triggered
- **10:15** - Triage and identification
- **10:45** - Patch deployed
- **11:00** - All systems healthy

## Root Cause Analysis
Detailed 5-Whys analysis on why the incident occurred.

## Preventative Action Items
- [ ] Add automated end-to-end regression test
- [ ] Configure alert threshold in Datadog/Sentry
- [ ] Update disaster recovery runbook
`,
  },
  {
    id: "retrospective",
    title: "Sprint Retrospective",
    badge: "Agile",
    icon: CheckSquareIcon,
    accent: "bg-tint-tasks text-ink border-hairline-strong",
    hint: "What went well, what could be improved",
    content: `# Sprint Retrospective

## What Went Well
- Delivered core reactive unblock engine ahead of schedule.
- Zero regression bugs on main branch.

## What Could Be Improved
- Communication on cross-team dependencies.
- Review turnaround time on large PRs.

## Actionable Commitments
- [ ] Set up PR review alerts
- [ ] Document automation rule recipes
`,
  },
] as const;
