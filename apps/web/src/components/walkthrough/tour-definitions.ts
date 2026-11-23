import {
  CompassIcon,
  LayersIcon,
  KanbanIcon,
  FileTextIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";

export type TourStep = {
  title: string;
  badge?: string;
  description: string;
  bullets?: string[];
};

export type TourDefinition = {
  id: string;
  moduleName: string;
  icon: typeof CompassIcon;
  steps: TourStep[];
};

export const tours: Record<string, TourDefinition> = {
  general: {
    id: "general",
    moduleName: "Workspace Essentials",
    icon: CompassIcon,
    steps: [
      {
        title: "Unified Command Palette",
        badge: "Keyboard First",
        description:
          "Press ⌘K anywhere in Kyren to search across Tasks, Projects, Docs, and Chat channels with instant debounce.",
        bullets: [
          "Search tasks by key (e.g. ZEN-42) or title",
          "Switch between dark and light themes instantly",
          "Jump straight into customer tickets and HR records",
        ],
      },
      {
        title: "3-Tier AI Copilot",
        badge: "Bottom-Right Dock",
        description:
          "Click the floating Sparkles button or press ⌘J to summon the Kyren AI Copilot for fast context queries and micro-ops.",
        bullets: [
          "Story point estimation using weighted Fibonacci algorithms",
          "Customer sentiment analysis and ticket triage",
          "Autonomous Workspace Custodian background sweeps",
        ],
      },
      {
        title: "Universal Work Embeds",
        badge: "Zero Context Switching",
        description:
          "Work flows naturally. Tasks can be live-embedded into Chat channels, Docs, and Whiteboards with interactive bidirectional status updates.",
        bullets: [
          "Change assignees directly from embedded message cards",
          "Toggle task completion states without leaving your conversation",
          "Cross-module work graph linking",
        ],
      },
    ],
  },
  tasks: {
    id: "tasks",
    moduleName: "Tasks & Sprints",
    icon: KanbanIcon,
    steps: [
      {
        title: "Optimistic Kanban & List Views",
        badge: "Sub-100ms UI",
        description:
          "Drag tasks between columns with zero layout flicker and instant optimistic local state caching.",
        bullets: [
          "Cycle priorities with keyboard shortcuts",
          "Group by project, assignee, or sprint",
          "Save custom filtered views to reuse with your team",
        ],
      },
      {
        title: "Agile Sprints & Burndown",
        badge: "Sprint Engine",
        description:
          "Plan cycles, allocate story points, track velocity, and automatically roll over unfinished deliverables to the backlog.",
        bullets: [
          "Drag tasks from backlog directly into active sprints",
          "Real-time burnup and velocity metrics",
          "Executive sprint briefing synthesis via Tier 3 AI",
        ],
      },
      {
        title: "Custom Fields & Templates",
        badge: "Flexibility",
        description:
          "Define organization-wide custom fields (number, date, dropdowns) and instantiate pre-built recurring task workflows.",
        bullets: [
          "Configurable per-project task templates",
          "Automated recurring tasks with cron-like cadences",
          "Custom field values synced across all task views",
        ],
      },
    ],
  },
  whiteboards: {
    id: "whiteboards",
    moduleName: "Spatial Whiteboards",
    icon: LayersIcon,
    steps: [
      {
        title: "Infinite 60fps Canvas",
        badge: "Spatial Engine",
        description:
          "Fluid pan and zoom with high-performance WebGL/SVG rendering designed for visual architecture and sprint roadmaps.",
        bullets: [
          "Pinch-to-zoom or scroll wheel canvas navigation",
          "Mini-map viewport orientation indicator",
          "Hardware-accelerated sticky note layout",
        ],
      },
      {
        title: "Live Database Tasks",
        badge: "Direct Sync",
        description:
          "Drag actual project tasks onto the board. They render as interactive cards that reflect live database statuses.",
        bullets: [
          "Check off subtasks directly on the canvas",
          "Real-time status badges and assignee avatars",
          "Double-click any node to open full task details",
        ],
      },
      {
        title: "Smart Dependency Anchors",
        badge: "Auto Blockers",
        description:
          "Connecting two task nodes with a bezier arrow automatically creates bidirectional 'Blocks / Blocked By' relations in Postgres.",
        bullets: [
          "4-way magnetic snap anchors (top, bottom, left, right)",
          "Collision-avoiding bezier curve paths",
          "Visual dependency bottleneck highlighting",
        ],
      },
    ],
  },
  docs: {
    id: "docs",
    moduleName: "Docs & Living Specs",
    icon: FileTextIcon,
    steps: [
      {
        title: "Rich Block-Based Typography",
        badge: "Distraction Free",
        description:
          "Enterprise Geist Sans typography with tight spatial rhythm, code blocks, callouts, and multi-column tables.",
        bullets: [
          "Clean distraction-free writing experience",
          "Real-time autosave with revision history snapshots",
          "Multi-tenant document access controls",
        ],
      },
      {
        title: "Living Spec Synthesis",
        badge: "Tier 3 AI",
        description:
          "Turn static documentation into living specs. The system inspects linked tasks and automatically suggests Markdown status updates.",
        bullets: [
          "Mentions of task keys (e.g. ZEN-12) auto-link to the work graph",
          "1-click living spec append generating completed capability diffs",
          "Autonomous Custodian doc auto-categorization",
        ],
      },
    ],
  },
  tickets: {
    id: "tickets",
    moduleName: "Support & SLA Engine",
    icon: TicketIcon,
    steps: [
      {
        title: "Multi-Queue Intake",
        badge: "Omnichannel",
        description:
          "Manage incoming requests through public intake forms, customer portal links, or inbound email ingestion.",
        bullets: [
          "Automated sequential numbering (SUP-1, SUP-2)",
          "Customer portal with passwordless magic links",
          "Public intake form generator with custom field validation",
        ],
      },
      {
        title: "SLA Rules & AI Triage",
        badge: "Automated Escalation",
        description:
          "Real-time countdown badges for first-response and resolution SLA targets, backed by automated background escalation.",
        bullets: [
          "Sentiment analysis and priority categorization (<50ms)",
          "Duplicate ticket detection using n-gram tokenization",
          "Internal agent notes vs. customer-facing replies",
        ],
      },
    ],
  },
  hr: {
    id: "hr",
    moduleName: "People & Enterprise",
    icon: UsersIcon,
    steps: [
      {
        title: "Employee Directory & Roles",
        badge: "RBAC Directory",
        description:
          "Searchable directory tracking reporting structures, job titles, departments, and linked sign-in accounts.",
        bullets: [
          "Bulk CSV people import with duplicate skipping",
          "Linked workspace user accounts and team assignments",
          "Role-based access boundary enforcement",
        ],
      },
      {
        title: "Leave Management & Dual-Control Payroll",
        badge: "Enterprise Guardrails",
        description:
          "Employee leave requests with manager approval, and strict dual-control payroll verification (approver ≠ creator).",
        bullets: [
          "Leave request approval and cancellation workflows",
          "Automated payroll calculation with bonus adjustments",
          "Immutable financial audit trail and pay run CSV exports",
        ],
      },
    ],
  },
};
