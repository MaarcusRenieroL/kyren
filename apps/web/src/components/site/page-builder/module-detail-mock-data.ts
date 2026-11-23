/* eslint-disable @typescript-eslint/no-explicit-any */
import { PROJ, TL, ic, mono } from "../site-data";
import { av, glyph, pill } from "./builder-helpers";

export const sbFor = (cur: any) =>
  [
    ["today", "Today"],
    ["tasks", "Tasks", "12"],
    ["projects", "Projects"],
    ["docs", "Docs"],
    ["team", "Team"],
  ].map(([k, l, b]: any) => ({
    l,
    b: b || "",
    ic: ic(k, 16, cur === k ? "var(--accent)" : "currentColor"),
    st: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 34,
      padding: "0 10px",
      borderRadius: 10,
      fontSize: 14,
      background: cur === k ? "var(--tile2)" : "transparent",
      color: cur === k ? "var(--ink)" : "var(--ink2)",
    },
  }));

export const buildTl = () =>
  TL.map(([stt, label, rows]: any) => ({
    label,
    count: String(rows.length),
    g: glyph(stt),
    rows: rows.map(([k, t, a, d, od]: any) => ({
      k,
      t,
      a,
      av: av(a),
      due: d,
      g: glyph(stt),
      proj: PROJ[k.split("-")[0]],
      dueSt: {
        fontFamily: mono,
        fontSize: 12,
        color: od ? "var(--rose)" : "var(--ink3)",
        width: 68,
        textAlign: "right" as const,
        flex: "none",
      },
    })),
  }));

export const buildTdProps = () =>
  [
    ["Status", "In progress", "var(--amber)"],
    ["Assignee", "Priya Raman"],
    ["Project", "Kyren Web"],
    ["Due", "Tomorrow"],
    ["Tracked", "01:12:40", 0, 1],
    ["Key", "ZEN-18", 0, 1],
  ].map(([k, v, c, mo]: any) => ({
    k,
    v,
    st: {
      fontSize: 14,
      marginTop: 4,
      color: c || "var(--ink)",
      fontFamily: mo ? mono : "inherit",
    },
  }));

export const tdLinks = [
  ["Project", "Kyren Web", "ZEN · 31 open tasks"],
  ["Blocks", "BIL-7 · Migrate invoices table", "Arjun · overdue Oct 11"],
  ["Related task", "ZEN-14 · Session timeout banner", "Tom · done Oct 8"],
  ["Doc", "Session handling spec", "Edited 1h ago by Priya"],
].map(([k, t, s0]: any) => ({ k, t, s: s0 }));

export const upNext = [
  ["ONB-14", "Invite teammates step", "Overdue", "var(--rose)"],
  ["ZEN-24", "Rate-limit the invite endpoint", "Due today", "var(--amber)"],
  ["ZEN-15", "Empty states for Docs home", "In review", "var(--cyan)"],
].map(([k, t, s0, c]: any) => ({ k, t, s: s0, st: pill(c) }));

export const dh = [
  [
    "Session handling spec",
    "Kyren Web",
    "2 tasks",
    "1h ago · Priya",
    "var(--peach)",
  ],
  [
    "ADR 014: Session storage",
    "Kyren Web",
    "1 task",
    "Oct 12 · Tom",
    "var(--peach)",
  ],
  ["Proration rules", "Billing", "3 tasks", "Oct 11 · Arjun", "var(--sky)"],
  [
    "Welcome email copy",
    "Onboarding",
    "2 tasks",
    "Oct 10 · Meera",
    "var(--mint)",
  ],
  ["Q4 hiring plan", "Company", "—", "Oct 6 · Lena", "var(--lav)"],
].map(([t, p0, l, u, c]: any) => ({
  t,
  p: p0,
  l,
  u,
  ic: {
    width: 26,
    height: 26,
    flex: "none",
    borderRadius: 8,
    background: c,
    border: "1px solid var(--line2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink)",
  },
}));

export const docTasks = [
  ["prog", "ZEN-18", "Fix login redirect loop on expired sessions"],
  ["done", "ZEN-14", "Session timeout banner"],
].map(([g, k, t]: any) => ({ g: glyph(g), k, t }));

export const share = [
  ["EN", "Engineering", "Team · 8 people", "Can edit", "var(--sky)"],
  ["PR", "Priya Raman", "Owner of this doc", "Owner"],
  ["LH", "Lena Hoffmann", "Member", "Can view"],
  [
    "G",
    "Guests",
    "People outside Northwind Labs",
    "No access",
    "var(--tile2)",
  ],
].map(([i, n, s0, r, c]: any) => ({
  i,
  n,
  s: s0,
  r,
  av: { ...av(i, 30), ...(c ? { background: c } : {}) },
}));
