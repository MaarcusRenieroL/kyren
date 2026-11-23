export type Relation =
  | "blocks"
  | "blocked_by"
  | "relates"
  | "mentions"
  | "mentioned_in";

export type Item = {
  linkId: string;
  relation: Relation;
  auto: boolean;
  type: "task" | "doc";
  id: string;
  title: string;
  key: string | null;
  status: string | null;
  href: string;
};

export type Candidate = {
  type: "task" | "doc";
  id: string;
  /** Task key or doc id: what the add call takes. */
  ref: string;
  title: string;
  key: string | null;
  status: string | null;
};

export type Source = { type: "task"; key: string } | { type: "doc"; id: string };

export const groups: Array<{ relation: Relation; label: string }> = [
  { relation: "blocked_by", label: "Blocked by" },
  { relation: "blocks", label: "Blocks" },
  { relation: "relates", label: "Related" },
  { relation: "mentions", label: "Mentions" },
  { relation: "mentioned_in", label: "Mentioned in" },
];

export const kinds: Array<{
  value: "relates" | "blocks" | "blocked_by";
  label: string;
}> = [
  { value: "relates", label: "Related" },
  { value: "blocks", label: "Blocks" },
  { value: "blocked_by", label: "Blocked by" },
];
