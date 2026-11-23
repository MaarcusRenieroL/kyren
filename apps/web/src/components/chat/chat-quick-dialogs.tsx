"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HashIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";

import { useChatSidebar } from "./chat-store";
import { usePeople } from "./channel-view";
import { PeoplePicker } from "./pickers";

/** Pick people to message; reuses an existing conversation with them. */
export function NewDmDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const sidebar = useChatSidebar();
  const people = usePeople();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const open = async () => {
    setSaving(true);

    try {
      const dm = await trpc.chat.openDm.mutate({ memberIds: selected });

      await sidebar.refresh();
      onClose();
      router.push(`/chat/dm/${dm.id}`);
    } catch (error) {
      toastError(error, "Could not start that conversation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="gap-5 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">New message</DialogTitle>
        </DialogHeader>
        <PeoplePicker
          people={people}
          selected={selected}
          onChange={setSelected}
          placeholder="Find people…"
        />
        <p className="text-[13px] text-ink-3">
          Pick one person for a direct message, or several for a group.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected.length}
            loading={saving}
            onClick={() => void open()}
          >
            Open conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Public channels you aren't in yet. */
export function BrowseChannelsDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const sidebar = useChatSidebar();
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof trpc.chat.browse.query>
  > | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    void trpc.chat.browse.query().then(setRows);
  }, [trpc]);

  const join = async (id: string, name: string) => {
    setJoining(id);

    try {
      await trpc.chat.join.mutate({ channelId: id });
      await sidebar.refresh();
      onClose();
      router.push(`/chat/${name}`);
    } catch (error) {
      toastError(error, "Could not join");
    } finally {
      setJoining(null);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Browse channels</DialogTitle>
        </DialogHeader>
        {rows === null ? (
          <Skeleton className="h-24" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-ink-2">
            You’re in every public channel.
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 border-b border-hairline/60 py-2.5"
              >
                <HashIcon className="size-4 text-ink-3" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{row.name}</p>
                  <p className="truncate text-[13px] text-ink-2">
                    {row.topic || "No topic yet"} · {row.members}{" "}
                    {row.members === 1 ? "member" : "members"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={joining === row.id}
                  onClick={() => void join(row.id, row.name)}
                >
                  Join
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
