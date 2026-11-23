"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSignIcon,
  BookmarkIcon,
  FileEditIcon,
  MessageSquareIcon,
  NewspaperIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { Count, row } from "./channel-row";

export function SidebarNavLinks({
  mentionTotal,
  extras,
}: {
  mentionTotal: number;
  extras?: {
    threadsUnread?: number;
    dueReminders?: number;
    drafts?: number;
    scheduled?: number;
  };
}) {
  const pathname = usePathname();

  return (
    <>
      {(
        [
          [
            "/chat/threads",
            MessageSquareIcon,
            "Threads",
            extras?.threadsUnread ?? 0,
            true,
          ],
          ["/chat/mentions", AtSignIcon, "Mentions", mentionTotal, true],
          [
            "/chat/saved",
            BookmarkIcon,
            "Saved",
            extras?.dueReminders ?? 0,
            true,
          ],
          [
            "/chat/drafts",
            FileEditIcon,
            "Drafts & scheduled",
            (extras?.drafts ?? 0) + (extras?.scheduled ?? 0),
            false,
          ],
          ["/chat/catch-up", NewspaperIcon, "Catch up", 0, false],
        ] as const
      ).map(([href, Icon, label, count, strong]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            row,
            pathname === href
              ? "bg-selected font-medium"
              : "text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
          <Count value={count} strong={strong} />
        </Link>
      ))}
      <Link
        href="/chat/search"
        aria-current={pathname === "/chat/search" ? "page" : undefined}
        className={cn(
          row,
          pathname === "/chat/search"
            ? "bg-selected font-medium"
            : "text-ink-2 hover:bg-hover hover:text-ink",
        )}
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
        Search messages
        <span className="ml-auto font-mono text-[10px] text-ink-3">⌘⇧F</span>
      </Link>
    </>
  );
}
