import { z } from "zod";

export type LinkRelation =
  | "blocks"
  | "blocked_by"
  | "relates"
  | "mentions"
  | "mentioned_in";

export type LinkedItem = {
  linkId: string;
  relation: LinkRelation;
  auto: boolean;
  type: "task" | "doc" | "message";
  id: string;
  title: string;
  key: string | null;
  status: string | null;
  assignee: string | null;
  priority?: string | null;
  estimatePoints?: number | null;
  href: string;
};

export type Ref = { type: "task" | "doc" | "message"; id: string };

export const uuid = z.string().uuid();

export function relationFor(
  link: { kind: string; sourceType: string; sourceId: string },
  self: Ref,
): LinkRelation {
  const outgoing = link.sourceType === self.type && link.sourceId === self.id;

  if (link.kind === "blocks") return outgoing ? "blocks" : "blocked_by";
  if (link.kind === "mentions") return outgoing ? "mentions" : "mentioned_in";
  return "relates";
}
