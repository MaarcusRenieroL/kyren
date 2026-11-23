"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  FramedContext,
  FrameActionContext,
  FrameActionButton,
  type FrameAction,
} from "./frame-context";
import {
  AdminTabs,
  RoleTabs,
  adminTitles,
  inArea,
  roleTabs,
} from "./frame-tabs";

/** Roles, Modules and the Audit log, titled as part of Overview. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [action, setAction] = useState<FrameAction>(null);
  const title =
    adminTitles.find(([href]) => inArea(pathname, [href]))?.[1] ?? "Overview";
  const onRolePage = roleTabs.some((tab) => tab.href === pathname);

  return (
    <FramedContext.Provider value>
      <FrameActionContext.Provider value={setAction}>
        <div className="flex w-full flex-col">
          <div className="flex min-h-10 flex-wrap items-center gap-3">
            <h1 className="font-display text-[1.75rem] leading-8 sm:text-[length:var(--title-size)] sm:leading-9">
              {title}
            </h1>
            <span className="rounded-sm border border-hairline px-1.5 py-px font-mono text-[10px] tracking-[0.06em] text-ink-3 uppercase">
              Owners and admins
            </span>
            <span className="flex-1" />
            <FrameActionButton action={action} />
          </div>
          <div className="mt-4">
            <AdminTabs />
          </div>
          {onRolePage ? (
            <div className="mt-4">
              <RoleTabs />
            </div>
          ) : null}
          <div className="mt-5 min-w-0">{children}</div>
        </div>
      </FrameActionContext.Provider>
    </FramedContext.Provider>
  );
}
