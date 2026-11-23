"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WifiOffIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { ChannelInfoBar, TypingLine } from "./channel-extras";
import { useChatSidebar } from "./chat-store";
import { Composer } from "./composer";
import { untilLabel } from "./message-body";
import type { AttachmentView, MessageActions, MessageView } from "./message-item";
import { NoAccessView } from "./states";
import { ChannelHeader } from "./channel-view/channel-header";
import { ChannelMessageList } from "./channel-view/channel-message-list";
import { ChannelDialogs } from "./channel-view/channel-dialogs";
import { useChannelCommands } from "./channel-view/use-channel-commands";
import { useChannelState } from "./channel-view/use-channel-state";
import { useOnline, type ChannelData } from "./channel-view/channel-view-types";
import { usePeople } from "./channel-view/use-people";

export type { ChannelData };
export { usePeople };

/** One conversation: header, messages, composer and its thread. */
export function ChannelView({ name, id }: { name?: string; id?: string }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const search = useSearchParams();
  const sidebar = useChatSidebar();
  const online = useOnline();
  const people = usePeople();
  const canUpload = usePermission("chat.files.upload");
  const anchor = search.get("m");
  const threadParam = search.get("thread");

  const [thread, setThread] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [preview, setPreview] = useState<{ file: AttachmentView; all: AttachmentView[] } | null>(null);
  const [taskFrom, setTaskFrom] = useState<MessageView | null>(null);
  const [highlight, setHighlight] = useState<string | null>(anchor);
  const [forwardOf, setForwardOf] = useState<MessageView | null>(null);
  const [summary, setSummary] = useState(false);
  const [poll, setPoll] = useState<{ question: string; options?: string[] } | null>(null);
  const [emojiManager, setEmojiManager] = useState(false);
  const [newTask, setNewTask] = useState<string | null>(null);

  const cs = useChannelState({ id, name, anchor, online, trpc, sidebar, people });

  useEffect(() => {
    if (cs.full && threadParam) setThread(threadParam);
  }, [cs.full?.id, threadParam]);

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(timer);
  }, [highlight]);

  const cmds = useChannelCommands({
    channelId: cs.channelId,
    full: cs.full,
    trpc,
    router,
    sidebar,
    refresh: cs.refresh,
    setNewTask,
    setPoll,
    setSummary,
  });

  const run = async (action: () => Promise<unknown>, fail: string) => {
    try {
      await action();
      await cs.refresh();
    } catch (caught) {
      toastError(caught, fail);
    }
  };

  const actions: MessageActions = {
    onReply: (message) => setThread(message.id),
    onReact: (message, emoji) =>
      void run(() => trpc.chat.react.mutate({ messageId: message.id, emoji }), "Could not react"),
    onPin: (message) =>
      void run(async () => {
        await trpc.chat.pin.mutate({ messageId: message.id, pinned: !message.pinned });
        await cs.loadChannel();
      }, "Could not pin the message"),
    onEdit: (message, body) =>
      run(() => trpc.chat.edit.mutate({ messageId: message.id, body }), "Could not edit the message"),
    onDelete: (message) =>
      void run(() => trpc.chat.remove.mutate({ messageId: message.id }), "Could not delete the message"),
    onCreateTask: (message) => setTaskFrom(message),
    onOpenFile: (file, all) => setPreview({ file, all }),
    onRetry: (message) => {
      const item = cs.local.find((entry) => entry.view.id === message.id);
      if (item) void cs.deliver(item);
    },
    onDiscard: (message) =>
      cs.setLocal((current) => current.filter((entry) => entry.view.id !== message.id)),
    onSave: (message, saved) =>
      void run(async () => {
        await trpc.chat.saveMessage.mutate({ messageId: message.id, saved });
        toastSuccess(saved ? "Saved for later" : "Removed from saved");
        void sidebar.refresh();
      }, "Could not save the message"),
    onRemind: (message, at) =>
      void run(async () => {
        await trpc.chat.setReminder.mutate({ messageId: message.id, remindAt: at });
        toastSuccess(at ? `I’ll remind you ${untilLabel(at)}` : "Reminder cleared");
        void sidebar.refresh();
      }, "Could not set the reminder"),
    onMarkUnread: (message) =>
      void run(async () => {
        if (!cs.channelId) return;
        await trpc.chat.markUnread.mutate({ channelId: cs.channelId, messageId: message.id });
        cs.setReadMark(new Date(new Date(message.createdAt).getTime() - 1));
        cs.scrolledToUnread.current = true;
        cs.lastCount.current = cs.messages?.length ?? 0;
        void sidebar.refresh();
        toastSuccess("Marked unread from this message");
      }, "Could not mark it unread"),
    onForward: (message) => setForwardOf(message),
    onVote: (pollId, optionIndex) =>
      void run(() => trpc.chat.votePoll.mutate({ pollId, optionIndex }), "Could not record your vote"),
    onClosePoll: (pollId) =>
      void run(() => trpc.chat.closePoll.mutate({ pollId }), "Could not close the poll"),
    onTranslate: async (message, language) =>
      (await trpc.chat.translate.mutate({ messageId: message.id, language })).text,
    onMakeDoc: (message) => void cmds.makeDoc(message),
  };

  const rows = useMemo(() => [
    ...(cs.messages ?? []).map((message) => ({ message })),
    ...cs.local.filter((item) => !item.parentId).map((item) => ({ message: item.view, local: item.state })),
  ], [cs.messages, cs.local]);

  if (cs.error === "missing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-display font-semibold text-xl tracking-tight text-ink">That channel isn’t here.</p>
        <p className="max-w-sm text-[15px] text-ink-2">It may have been renamed or removed.</p>
        <Button asChild variant="outline"><Link href="/chat">Back to Chat</Link></Button>
      </div>
    );
  }

  if (cs.error === "failed" && !cs.channel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-danger text-danger-text">!</span>
        <p className="text-lg font-semibold">We couldn’t load {name ? `#${name}` : "this conversation"}.</p>
        <Button variant="outline" onClick={() => void cs.loadChannel()}>Try again</Button>
      </div>
    );
  }

  if (!cs.channel) {
    return (
      <div className="flex flex-1 flex-col" aria-busy="true">
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-3.5"><Skeleton className="size-9 rounded-md" /><Skeleton className="h-5 w-40" /></div>
        <div className="flex flex-1 flex-col gap-5 px-5 py-6">
          {[70, 45, 80, 55, 62].map((w, i) => (
            <div key={i} className="flex gap-3"><Skeleton className="size-9 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3" style={{ width: `${w}%` }} /></div></div>
          ))}
        </div>
      </div>
    );
  }

  if (cs.channel.access === "none") return <NoAccessView channel={cs.channel} />;

  const data = cs.channel;
  const isDm = data.kind === "dm";
  const me = people.find((p) => p.isMe);
  const meId = me?.memberId ?? "";
  const others = data.people.filter((p) => p.memberId !== meId);
  const firstUnread = cs.readMark && cs.messages ? cs.messages.find((m) => new Date(m.createdAt) > cs.readMark! && !m.mine && m.kind !== "event") : undefined;
  const lastMine = [...(cs.messages ?? [])].reverse().find((m) => m.mine);
  const seenBy = lastMine ? cs.readers.filter((r) => new Date(r.lastReadAt) >= new Date(lastMine.createdAt)).map((r) => r.name) : [];
  const offline = !online;

  return (
    <div className="flex min-h-0 flex-1">
      <section aria-label={isDm ? data.title : `#${data.name}`} className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader
          data={data}
          isDm={isDm}
          canPost={data.canPost}
          others={others}
          onSettings={() => setSettings(true)}
          onHuddle={() => void run(async () => { const { url } = await trpc.chat.startHuddle.mutate({ channelId: data.id }); window.open(url, "_blank", "noopener"); }, "Could not start a huddle")}
          onPoll={() => setPoll({ question: "" })}
          onSummarize={() => setSummary(true)}
          onJumpPin={(msgId) => router.replace(`?m=${msgId}`)}
          onChanged={() => void cs.loadChannel()}
        />

        {!isDm ? <ChannelInfoBar channelId={data.id} canvas={data.canvas} canEdit={data.joined && data.canPost} onChanged={() => void cs.loadChannel()} /> : null}

        {offline || cs.loadError ? (
          <div role="status" className="flex items-center gap-3 border-b border-hairline bg-surface px-5 py-2 text-[13px]">
            <WifiOffIcon className="size-4 text-ink-3" aria-hidden="true" />
            <span className="flex-1"><strong className="font-semibold">{offline ? "You’re offline." : "Can’t reach the server."}</strong> <span className="text-ink-2">Messages stay on this device and go out when you reconnect.</span></span>
            <span className="hidden font-mono text-xs text-ink-3 sm:block">Reconnecting in {cs.retryIn}s</span>
            <Button variant="outline" size="sm" onClick={() => void cs.refresh()}>Retry now</Button>
          </div>
        ) : null}

        <ChannelMessageList
          listRef={cs.list}
          stickToBottom={cs.stickToBottom}
          messages={cs.messages}
          loadError={cs.loadError}
          isDm={isDm}
          data={data}
          refresh={cs.refresh}
          rows={rows}
          hasMore={cs.hasMore}
          loadOlder={cs.loadOlder}
          firstUnread={firstUnread}
          meId={meId}
          highlight={highlight}
          canPost={data.canPost}
          actions={actions}
          lastMine={lastMine}
          seenBy={seenBy}
          onSettings={() => setSettings(true)}
        />

        <div className="px-5 pt-0.5 pb-4">
          <TypingLine names={cs.typers} />
          <Composer
            placeholder={isDm ? `Message ${data.title}` : `Message #${data.name}`}
            people={people}
            canAttach={canUpload && data.canPost}
            disabled={!data.canPost}
            disabledNote={data.archivedAt ? "This channel is archived." : "You can read this channel but not post in it."}
            offline={offline}
            onSend={cs.send}
            onTyped={cs.typed}
            commands={cmds.commands}
            draftScope={{ channelId: data.id, key: data.id }}
            onSchedule={cmds.schedule}
            onManageEmoji={() => setEmojiManager(true)}
            autoFocus
          />
        </div>
      </section>

      <ChannelDialogs
        thread={thread}
        setThread={setThread}
        isDm={isDm}
        data={data}
        meId={meId}
        people={people}
        canPost={data.canPost}
        canUpload={canUpload}
        offline={offline}
        actions={actions}
        refresh={cs.refresh}
        settings={settings}
        setSettings={setSettings}
        loadChannel={cs.loadChannel}
        sidebarRefresh={() => void sidebar.refresh()}
        forwardOf={forwardOf}
        setForwardOf={setForwardOf}
        summary={summary}
        setSummary={setSummary}
        poll={poll}
        setPoll={setPoll}
        emojiManager={emojiManager}
        setEmojiManager={setEmojiManager}
        newTask={newTask}
        setNewTask={setNewTask}
        preview={preview}
        setPreview={setPreview}
        taskFrom={taskFrom}
        setTaskFrom={setTaskFrom}
      />
    </div>
  );
}
