export const colors = {
  blue: "border-line bg-tint-projects text-ink",
  green: "border-line bg-tint-teams text-ink",
  amber: "border-line bg-tint-sun text-ink",
  red: "border-line bg-danger-subtle text-ink",
  violet: "border-line bg-tint-lilac text-ink",
  gray: "border-line bg-tint-slate text-ink",
} as const;

export type EventColor = keyof typeof colors;

export type CalendarEventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  color: string;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  createdBy: string | null;
  canManage: boolean;
  /** Set for a meeting shown on the grid; it opens the meeting, not the editor. */
  meetingId?: string;
  /** Set for items that live in another module (time off); opening goes there. */
  href?: string;
  /** How a series repeats; each occurrence carries its series' first dates. */
  repeat?: Repeat | null;
  repeatUntil?: string | null;
  seriesStartsAt?: string;
  seriesEndsAt?: string;
};

export type Repeat = "daily" | "weekly" | "monthly";

export type Occurrence = {
  seriesId: string;
  /** The occurrence's start as the server sent it. */
  startsAt: string;
  shownStartsAt: Date;
  shownEndsAt: Date;
};

export type EventDraft = {
  id?: string;
  title: string;
  description: string | null;
  location: string | null;
  color: EventColor;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  repeat: Repeat | null;
  repeatUntil: string | null;
  /** The occurrence that was opened, when it belongs to a series. */
  occurrence?: Occurrence;
  /** Saving makes this one occurrence an event of its own. */
  detachFrom?: Occurrence;
  /** Saving changes this occurrence and every one after it. */
  splitFrom?: Occurrence;
};

export type EventDialogProps = {
  draft: EventDraft | null;
  readOnly: boolean;
  createdBy?: string | null;
  onClose: () => void;
  onSave: (draft: EventDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** Changes only the opened occurrence of a series. */
  onEditOne?: (occurrence: Occurrence) => void;
  onDeleteOne?: (occurrence: Occurrence) => Promise<void>;
  /** Changes the opened occurrence and the ones after it. */
  onEditFollowing?: (occurrence: Occurrence) => void;
  onDeleteFollowing?: (occurrence: Occurrence) => Promise<void>;
};
