"use client";

import { ComposeDialog } from "./compose-dialog";
import { MailConversationView } from "./app/mail-conversation-view";
import { MailListPanel } from "./app/mail-list-panel";
import { MailSidebarNav } from "./app/mail-sidebar-nav";
import { useMailState } from "./app/use-mail-state";

export function MailApp() {
  const {
    folder,
    setFolder,
    search,
    setSearch,
    rows,
    setRows,
    cursor,
    loadingOlder,
    failed,
    load,
    loadOlder,
    openId,
    setOpenId,
    conversation,
    unread,
    people,
    compose,
    setCompose,
    flag,
    purge,
    send,
    keep,
    discard,
    reply,
    forward,
    openRow,
  } = useMailState();

  const current = rows?.find((row) => row.id === openId);

  return (
    <div className="-mx-4 -mt-5 -mb-12 flex h-[calc(100svh-3.5rem)] min-h-[480px] overflow-hidden border-t border-hairline md:-mx-(--gutter) md:-mt-7 md:-mb-16">
      <h1 className="sr-only">Messages</h1>
      <MailSidebarNav
        folder={folder}
        setFolder={(f) => {
          setFolder(f);
          setOpenId(null);
          setRows(null);
        }}
        unread={unread}
        onCompose={() => setCompose({ to: [], cc: [], subject: "", body: "" })}
      />

      <MailListPanel
        folder={folder}
        setFolder={(f) => {
          setFolder(f);
          setRows(null);
        }}
        search={search}
        setSearch={setSearch}
        rows={rows}
        cursor={cursor}
        loadingOlder={loadingOlder}
        failed={failed}
        openId={openId}
        onOpenRow={openRow}
        onLoadOlder={() => void loadOlder()}
        onRetry={() => void load()}
        onCompose={() => setCompose({ to: [], cc: [], subject: "", body: "" })}
      />

      <MailConversationView
        openId={openId}
        conversation={conversation}
        current={current}
        folder={folder}
        onClose={() => setOpenId(null)}
        onFlag={flag}
        onPurge={purge}
        onReply={reply}
        onForward={forward}
      />

      <ComposeDialog
        draft={compose}
        people={people}
        onSend={send}
        onKeep={keep}
        onDiscard={() => void discard()}
      />
    </div>
  );
}
