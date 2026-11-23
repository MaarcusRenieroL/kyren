export type CreateProjectModalProps = {
  onProjectCreated: () => void | Promise<void>;
  /** Control the dialog from outside (the Create menu), with no trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export type TeamOption = {
  id: string;
  name: string;
  color: string;
};

export const box =
  "h-11 rounded-md border-hairline bg-surface text-[15px] shadow-none";

/** The key prefix the server will try first, mirrored for the footer. */
export function keyPrefixFor(slug: string) {
  const parts = slug.split("-").filter(Boolean);

  if (!parts.length) return null;

  const prefix =
    parts.length > 1
      ? parts.map((part) => part[0]).join("")
      : parts[0]!.slice(0, 6);

  return prefix.replace(/[^a-z0-9]/gi, "").toUpperCase() || null;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="flex gap-1.5 text-[13px] text-danger-text">
      <span aria-hidden="true" className="font-mono font-medium">
        !
      </span>
      {message}
    </p>
  );
}
