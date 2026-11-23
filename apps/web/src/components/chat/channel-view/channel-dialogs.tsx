import { CreateTaskModal } from "~/src/features/tasks/components/create-task-modal";
import { ChannelSettingsDialog } from "../channel-settings-dialog";
import {
  EmojiManagerDialog,
  ForwardDialog,
  PollDialog,
  SummaryDialog,
} from "../chat-dialogs-extra";
import type { Person } from "../composer";
import { FilePreviewDialog } from "../file-preview";
import type {
  AttachmentView,
  MessageActions,
  MessageView,
} from "../message-item";
import { ThreadPanel } from "../thread-panel";
import type { ChannelData } from "./channel-view-types";

export function ChannelDialogs({
  thread,
  setThread,
  isDm,
  data,
  meId,
  people,
  canPost,
  canUpload,
  offline,
  actions,
  refresh,
  settings,
  setSettings,
  loadChannel,
  sidebarRefresh,
  forwardOf,
  setForwardOf,
  summary,
  setSummary,
  poll,
  setPoll,
  emojiManager,
  setEmojiManager,
  newTask,
  setNewTask,
  preview,
  setPreview,
  taskFrom,
  setTaskFrom,
}: {
  thread: string | null;
  setThread: (id: string | null) => void;
  isDm: boolean;
  data: ChannelData;
  meId: string;
  people: Person[];
  canPost: boolean;
  canUpload: boolean;
  offline: boolean;
  actions: MessageActions;
  refresh: () => Promise<void>;
  settings: boolean;
  setSettings: (open: boolean) => void;
  loadChannel: () => Promise<void>;
  sidebarRefresh: () => void;
  forwardOf: MessageView | null;
  setForwardOf: (m: MessageView | null) => void;
  summary: boolean;
  setSummary: (open: boolean) => void;
  poll: { question: string; options?: string[] } | null;
  setPoll: (p: { question: string; options?: string[] } | null) => void;
  emojiManager: boolean;
  setEmojiManager: (open: boolean) => void;
  newTask: string | null;
  setNewTask: (task: string | null) => void;
  preview: { file: AttachmentView; all: AttachmentView[] } | null;
  setPreview: (p: { file: AttachmentView; all: AttachmentView[] } | null) => void;
  taskFrom: MessageView | null;
  setTaskFrom: (m: MessageView | null) => void;
}) {
  return (
    <>
      {thread ? (
        <div className="hidden w-[380px] shrink-0 lg:block">
          <ThreadPanel
            messageId={thread}
            channelName={isDm ? data.title : data.name}
            meId={meId}
            people={people}
            canPost={canPost}
            canAttach={canUpload && canPost}
            offline={offline}
            actions={actions}
            onClose={() => setThread(null)}
            onChanged={() => void refresh()}
          />
        </div>
      ) : null}

      {thread ? (
        <div className="fixed inset-0 z-40 bg-canvas lg:hidden">
          <ThreadPanel
            messageId={thread}
            channelName={isDm ? data.title : data.name}
            meId={meId}
            people={people}
            canPost={canPost}
            canAttach={canUpload && canPost}
            offline={offline}
            actions={actions}
            onClose={() => setThread(null)}
            onChanged={() => void refresh()}
          />
        </div>
      ) : null}

      {settings ? (
        <ChannelSettingsDialog
          channel={data}
          people={people}
          onClose={() => setSettings(false)}
          onChanged={() => {
            void loadChannel();
            void sidebarRefresh();
          }}
        />
      ) : null}

      {forwardOf ? (
        <ForwardDialog message={forwardOf} onClose={() => setForwardOf(null)} />
      ) : null}

      {summary ? (
        <SummaryDialog
          channelId={data.id}
          title={isDm ? data.title : `#${data.name}`}
          onClose={() => setSummary(false)}
        />
      ) : null}

      {poll ? (
        <PollDialog
          channelId={data.id}
          initialQuestion={poll.question}
          initialOptions={poll.options}
          onClose={() => setPoll(null)}
          onCreated={() => void refresh()}
        />
      ) : null}

      {emojiManager ? (
        <EmojiManagerDialog
          canManage={data.canManage}
          onClose={() => setEmojiManager(false)}
        />
      ) : null}

      {newTask !== null ? (
        <CreateTaskModal
          key="new-task"
          hideTrigger
          open
          onOpenChange={(open) => {
            if (!open) setNewTask(null);
          }}
          defaultName={newTask}
          onTaskCreated={() => setNewTask(null)}
        />
      ) : null}

      {preview ? (
        <FilePreviewDialog
          file={preview.file}
          all={preview.all}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {taskFrom ? (
        <CreateTaskModal
          key={taskFrom.id}
          hideTrigger
          open
          onOpenChange={(open) => {
            if (!open) setTaskFrom(null);
          }}
          defaultName={taskFrom.body
            .replace(/<@[0-9a-f-]{36}>/g, "")
            .replace(/<!(?:channel|here)>/g, "")
            .trim()
            .slice(0, 100)}
          linkMessageId={taskFrom.id}
          onTaskCreated={() => {
            setTaskFrom(null);
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}
