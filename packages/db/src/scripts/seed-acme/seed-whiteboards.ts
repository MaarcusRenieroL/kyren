import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedWhiteboards(ctx: SeedContext) {
  const { orgId, members } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

  // 15. Whiteboards
  console.log("🌱 Seeding Whiteboards with diagram elements...");
  await db
    .delete(schema.whiteboards)
    .where(eq(schema.whiteboards.organizationId, orgId));

  const archElements = [
    {
      id: "b1",
      type: "rect",
      x: 100,
      y: 150,
      w: 220,
      h: 120,
      color: "#3b82f6",
      text: "Next.js Web App\n(Apps/Web)",
    },
    { id: "b2", type: "arrow", x: 320, y: 210, w: 100, h: 0, color: "#9ca3af" },
    {
      id: "b3",
      type: "rect",
      x: 420,
      y: 150,
      w: 220,
      h: 120,
      color: "#10b981",
      text: "tRPC API Router\n(@kyren/api)",
    },
    { id: "b4", type: "arrow", x: 640, y: 210, w: 100, h: 0, color: "#9ca3af" },
    {
      id: "b5",
      type: "rect",
      x: 740,
      y: 150,
      w: 220,
      h: 120,
      color: "#8b5cf6",
      text: "PostgreSQL (Neon)\n(@kyren/db)",
    },
    {
      id: "b6",
      type: "sticky",
      x: 440,
      y: 320,
      w: 180,
      h: 140,
      color: "#fbbf24",
      text: "Note: Enforce permission checks on every tRPC procedure!",
    },
    {
      id: "b7",
      type: "rect",
      x: 420,
      y: 490,
      w: 220,
      h: 100,
      color: "#ef4444",
      text: "Background Workers\n& Cron Automations",
    },
    { id: "b8", type: "arrow", x: 530, y: 270, w: 0, h: 220, color: "#9ca3af" },
  ];

  await db.insert(schema.whiteboards).values([
    {
      organizationId: orgId,
      createdByMemberId: daniel.memberId,
      title: "Acme Group Core System Architecture & Microservices",
      elements: archElements,
      updatedAt: new Date(),
    },
    {
      organizationId: orgId,
      createdByMemberId: meilin.memberId,
      title: "User Onboarding & Activation Journey 2026",
      elements: [
        {
          id: "f1",
          type: "ellipse",
          x: 100,
          y: 200,
          w: 160,
          h: 100,
          color: "#3b82f6",
          text: "Landing Page",
        },
        {
          id: "f2",
          type: "arrow",
          x: 260,
          y: 250,
          w: 80,
          h: 0,
          color: "#9ca3af",
        },
        {
          id: "f3",
          type: "rect",
          x: 340,
          y: 200,
          w: 180,
          h: 100,
          color: "#10b981",
          text: "One-Click SSO / Auth",
        },
        {
          id: "f4",
          type: "arrow",
          x: 520,
          y: 250,
          w: 80,
          h: 0,
          color: "#9ca3af",
        },
        {
          id: "f5",
          type: "rect",
          x: 600,
          y: 200,
          w: 200,
          h: 100,
          color: "#8b5cf6",
          text: "Workspace First Project",
        },
        {
          id: "f6",
          type: "sticky",
          x: 350,
          y: 340,
          w: 160,
          h: 120,
          color: "#f472b6",
          text: "Activation milestone: user creates first task in 3 mins.",
        },
      ],
      updatedAt: new Date(),
    },
    {
      organizationId: orgId,
      createdByMemberId: jamal.memberId,
      title: "Q4 Product Strategy & Release Milestones",
      elements: [
        {
          id: "m1",
          type: "rect",
          x: 120,
          y: 150,
          w: 240,
          h: 160,
          color: "#6366f1",
          text: "Milestone 1: Web App Redesign\nDue: Nov 15\nOwner: Mei Lin & Tomás",
        },
        {
          id: "m2",
          type: "rect",
          x: 400,
          y: 150,
          w: 240,
          h: 160,
          color: "#ec4899",
          text: "Milestone 2: Mobile App Beta\nDue: Nov 30\nOwner: Daniel & Sofia",
        },
        {
          id: "m3",
          type: "rect",
          x: 680,
          y: 150,
          w: 240,
          h: 160,
          color: "#14b8a6",
          text: "Milestone 3: Enterprise SSO & SCIM\nDue: Dec 15\nOwner: Daniel",
        },
      ],
      updatedAt: new Date(),
    },
  ]);
  console.log(
    "✅ Seeded 3 rich Whiteboards with canvas shapes and sticky notes",
  );


}
