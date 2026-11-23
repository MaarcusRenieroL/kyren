"use client";

import {
  BellRingIcon,
  BookmarkIcon,
  CheckSquareIcon,
  CopyIcon,
  CornerUpRightIcon,
  FileTextIcon,
  LanguagesIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";
import { languages, reminderChoices, type MessageActions, type MessageView } from "./message-item-types";

type MessageActionsMenuProps = {
  message: MessageView;
  canModerate: boolean;
  inThread: boolean;
  actions: MessageActions;
  onOpenChange: (open: boolean) => void;
  onStartEdit: () => void;
  onTranslate: (language: string) => void;
  onCopyLink: () => void;
};

export function MessageActionsMenu({
  message,
  canModerate,
  inThread,
  actions,
  onOpenChange,
  onStartEdit,
  onTranslate,
  onCopyLink,
}: MessageActionsMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="More actions"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.onCreateTask ? (
          <DropdownMenuItem onClick={() => actions.onCreateTask?.(message)}>
            <CheckSquareIcon className="size-4" />
            Create task
          </DropdownMenuItem>
        ) : null}
        {actions.onMakeDoc && !inThread ? (
          <DropdownMenuItem onClick={() => actions.onMakeDoc?.(message)}>
            <FileTextIcon className="size-4" />
            Turn into doc
          </DropdownMenuItem>
        ) : null}
        {actions.onSave ? (
          <DropdownMenuItem
            onClick={() => actions.onSave?.(message, !message.saved)}
          >
            <BookmarkIcon className="size-4" />
            {message.saved ? "Remove from saved" : "Save for later"}
          </DropdownMenuItem>
        ) : null}
        {actions.onRemind ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BellRingIcon className="size-4" />
              Remind me
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {reminderChoices.map(([label, at]) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => actions.onRemind?.(message, at())}
                >
                  {label}
                </DropdownMenuItem>
              ))}
              {message.saved?.remindAt ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => actions.onRemind?.(message, null)}
                  >
                    Clear reminder
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {actions.onMarkUnread ? (
          <DropdownMenuItem
            onClick={() => actions.onMarkUnread?.(message)}
          >
            <MailOpenIcon className="size-4" />
            Mark unread from here
          </DropdownMenuItem>
        ) : null}
        {actions.onForward ? (
          <DropdownMenuItem onClick={() => actions.onForward?.(message)}>
            <CornerUpRightIcon className="size-4" />
            Forward…
          </DropdownMenuItem>
        ) : null}
        {actions.onTranslate && message.body ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LanguagesIcon className="size-4" />
              Translate to…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {languages.map((language) => (
                <DropdownMenuItem
                  key={language}
                  onClick={() => onTranslate(language)}
                >
                  {language}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        {actions.onPin && !inThread ? (
          <DropdownMenuItem onClick={() => actions.onPin?.(message)}>
            <PinIcon className="size-4" />
            {message.pinned ? "Unpin" : "Pin to channel"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onCopyLink}>
          <CopyIcon className="size-4" />
          Copy link
        </DropdownMenuItem>
        {message.mine && actions.onEdit ? (
          <DropdownMenuItem onClick={onStartEdit}>
            <PencilIcon className="size-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {(message.mine || canModerate) && actions.onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.onDelete?.(message)}
            >
              <Trash2Icon className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
