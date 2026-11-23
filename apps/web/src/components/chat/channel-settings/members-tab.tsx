"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import type { ChannelData } from "../channel-view";
import type { Person } from "../composer";
import { Avatar } from "../message-item";
import { PeoplePicker } from "../pickers";

export function MembersTab({
  channel,
  people,
  canManage,
  busy,
  call,
}: {
  channel: ChannelData;
  people: Person[];
  canManage: boolean;
  busy: boolean;
  call: (action: () => Promise<unknown>, done?: string) => Promise<void>;
}) {
  const trpc = useTrpcClient();
  const [find, setFind] = useState("");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);

  const memberIds = new Set(channel.people.map((person) => person.memberId));
  const visible = channel.people.filter((person) =>
    person.name.toLowerCase().includes(find.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Label className="relative flex-1">
          <span className="sr-only">Find a member</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={find}
            onChange={(event) => setFind(event.target.value)}
            placeholder="Find a member"
            className="pl-9"
          />
        </Label>
        {canManage || channel.visibility === "public" ? (
          <Button
            variant="outline"
            onClick={() => setAdding((value) => !value)}
          >
            <PlusIcon />
            Add people
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
          <PeoplePicker
            people={people.filter((person) => !memberIds.has(person.memberId))}
            selected={toAdd}
            onChange={setToAdd}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!toAdd.length || busy}
              onClick={() =>
                void call(async () => {
                  await trpc.chat.addMembers.mutate({
                    channelId: channel.id,
                    memberIds: toAdd,
                  });
                  setToAdd([]);
                  setAdding(false);
                }, "People added")
              }
            >
              Add {toAdd.length || ""}
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col">
        {visible.map((person) => {
          const mine = person.memberId === people.find((p) => p.isMe)?.memberId;

          return (
            <li
              key={person.memberId}
              className="flex items-center gap-3 border-b border-hairline/60 py-2.5"
            >
              <Avatar name={person.name} presence={person.presence} size={30} />
              <span className="flex-1 text-[15px]">
                {person.name}
                {mine ? (
                  <span className="ml-1.5 text-xs text-ink-3">you</span>
                ) : null}
              </span>
              {canManage ? (
                <NativeSelect
                  aria-label={`Role of ${person.name}`}
                  size="sm"
                  className="w-36 text-sm"
                  value={person.role}
                  disabled={busy}
                  onChange={(event) =>
                    void call(() =>
                      trpc.chat.setRole.mutate({
                        channelId: channel.id,
                        memberId: person.memberId,
                        role: event.target.value as "admin" | "member",
                      }),
                    )
                  }
                >
                  <option value="admin">Channel admin</option>
                  <option value="member">Member</option>
                </NativeSelect>
              ) : (
                <span className="text-sm text-ink-2">
                  {person.role === "admin" ? "Channel admin" : "Member"}
                </span>
              )}
              {canManage || mine ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void call(
                      () =>
                        trpc.chat.removeMember.mutate({
                          channelId: channel.id,
                          memberId: person.memberId,
                        }),
                      mine ? "You left the channel" : "Removed",
                    )
                  }
                >
                  {mine ? "Leave" : "Remove"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
