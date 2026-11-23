/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RefObject } from "react";

export type SitePageName =
  | "pricing"
  | "modules"
  | "module"
  | "roadmap"
  | "security"
  | "changelog"
  | "legal"
  | "about"
  | "status";

export type SitePageProps = {
  page: SitePageName;
  module?: "tasks" | "docs";
  doc?: "privacy" | "terms" | "cookies" | "dpa" | "subprocessors";
  mobile?: boolean;
  progress?: number;
  menuOpen?: boolean;
  notified?: string;
  filter?: string;
  billing?: string;
  statusState?: string;
  only?: "all" | "nav" | "footer";
};

export type Mode = "dark" | "light" | "system";

export type SiteState = {
  P: number | null;
  vw: number | null;
  on: Record<string, boolean> | null;
  rv: Record<string, boolean> | null;
  billing: string | null;
  planM: number;
  add: Record<string, number>;
  faq: number;
  filt: string | null;
  notify: Record<string, boolean>;
  cl: string;
  menuO: boolean | null;
  toc: number;
  tocOpen: boolean;
  f: { name: string; email: string; topic: string; msg: string };
  touched: Record<string, number>;
  submitted: boolean;
  sent: boolean;
};

export interface SiteBuilderCtx {
  props: SitePageProps;
  state: SiteState;
  setS: (update: any) => void;
  mode: Mode;
  sysLight: boolean;
  rm: boolean;
  router: any;
  rootRef: RefObject<HTMLDivElement | null>;
  lineRef: RefObject<HTMLDivElement | null>;
  chooseMode: (next: Mode) => void;
  go: (k: string, extra?: any) => any;
  gos: Record<string, any>;
  theme: "dark" | "light";
  m: boolean;
  P: number;
  isOn: (k: any) => boolean;
  ndS: (o: any) => Record<string, any>;
  lineS: (o: any, dir: any) => Record<string, any>;
  rv: Record<string, any>;
}
