import { Kbd } from "@zentro/ui/components/kbd";

export type TaskHit = {
  key: string;
  name: string;
  project: string;
  status: string;
  due: string | null;
};

export type DocHit = { slug: string; title: string; project: string | null };

export type SearchHit = {
  id: string;
  type: "task" | "doc" | "project" | "channel";
  title: string;
  key?: string | null;
  snippet?: string | null;
  href: string;
};

export const itemClass =
  "flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-ink-2 outline-none data-[selected=true]:bg-signal-subtle data-[selected=true]:text-ink data-[selected=true]:ring-1 data-[selected=true]:ring-signal/30 [&_svg]:size-4 [&_svg]:text-ink-3";

export const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase";

/** The go-to shortcuts: `G` then a letter. */
export const goKeys: Record<string, string> = {
  dashboard: "H",
  tasks: "T",
  projects: "P",
  docs: "D",
  team: "M",
  settings: ",",
  overview: "O",
};

export function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="ml-auto flex gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

/** The matching part of a title set in semibold. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;

  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-ink">
        {text.slice(index, index + query.length)}
      </strong>
      {text.slice(index + query.length)}
    </>
  );
}

export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    Boolean(target.closest('[role="textbox"]')) ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
