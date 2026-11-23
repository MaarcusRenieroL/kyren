import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { bounds, clamp, live, union, type El } from "../canvas/model";
import { mergeIn } from "../canvas/sync";
import { POLL_MS, PRESENCE_MS, type Other, type SaveState, type View } from "./editor-types";

export function useBoardSync({
  id,
  elements,
  setElements,
  selected,
  editing,
  drag,
  latest,
  setView,
  svgRef,
}: {
  id: string;
  elements: El[];
  setElements: React.Dispatch<React.SetStateAction<El[]>>;
  selected: string[];
  editing: { id: string; text: string } | null;
  drag: unknown;
  latest: RefObject<El[]>;
  setView: React.Dispatch<React.SetStateAction<View>>;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const trpc = useTrpcClient();
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [canEdit, setCanEdit] = useState(false);
  const [viewerName, setViewerName] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [others, setOthers] = useState<Other[]>([]);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());

  const dirty = useRef(false);
  const inFlight = useRef(false);
  const seen = useRef<string | null>(null);
  const remote = useRef(new Map<string, number>());
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    trpc.whiteboard.get
      .query({ id })
      .then((board) => {
        if (cancelled) return;
        setTitle(board.title);
        setCanEdit(board.canEdit);
        setViewerName(board.viewerName);
        seen.current = board.updatedAt;
        setElements(board.elements as El[]);
        setState("ready");

        const box = union(live(board.elements as El[]).map(bounds));
        const rect = svgRef.current?.getBoundingClientRect();

        if (box && rect) {
          const k = clamp(
            Math.min((rect.width - 120) / box.w, (rect.height - 160) / box.h),
            0.2,
            1,
          );

          setView({
            k,
            x: rect.width / 2 - (box.x + box.w / 2) * k,
            y: rect.height / 2 - (box.y + box.h / 2) * k,
          });
        }
      })
      .catch(() => !cancelled && setState("missing"));

    return () => {
      cancelled = true;
    };
  }, [trpc, id, setElements, setView, svgRef]);

  const busyIds = useRef(() => new Set<string>());
  busyIds.current = () => {
    const ids = new Set<string>(editing ? [editing.id] : []);
    if (drag) selected.forEach((one) => ids.add(one));
    return ids;
  };
  const busy = useCallback(() => busyIds.current(), []);

  const flush = useCallback(async () => {
    if (!dirty.current || inFlight.current) return;

    inFlight.current = true;
    dirty.current = false;
    setSave("saving");

    try {
      const { elements: merged, savedAt } = await trpc.whiteboard.save.mutate({
        id,
        elements: latest.current as never,
      });

      seen.current = savedAt;
      setElements((current) =>
        mergeIn(current, merged as El[], busy(), remote.current),
      );
      setSave(dirty.current ? "dirty" : "saved");
    } catch {
      dirty.current = true;
      setSave("error");
    } finally {
      inFlight.current = false;
    }
  }, [trpc, id, busy, latest, setElements]);

  useEffect(() => {
    if (save !== "dirty" && save !== "error") return;
    const timer = setTimeout(() => void flush(), save === "dirty" ? 600 : 5000);
    return () => clearTimeout(timer);
  }, [save, elements, flush]);

  useEffect(() => {
    if (state !== "ready") return;

    const pull = setInterval(() => {
      if (document.visibilityState !== "visible" || inFlight.current) return;

      void (async () => {
        const { updatedAt } = await trpc.whiteboard.version.query({ id });
        if (updatedAt === seen.current) return;

        const board = await trpc.whiteboard.get.query({ id });
        seen.current = board.updatedAt;
        setElements((current) =>
          mergeIn(current, board.elements as El[], busy(), remote.current),
        );
      })().catch(() => undefined);
    }, POLL_MS);

    const presence = () => {
      if (document.visibilityState !== "visible") return;
      void trpc.whiteboard.presence
        .mutate({ id, cursor: pointer.current })
        .then(setOthers)
        .catch(() => undefined);
    };

    presence();
    const ping = setInterval(presence, PRESENCE_MS);

    return () => {
      clearInterval(pull);
      clearInterval(ping);
    };
  }, [state, trpc, id, busy, setElements]);

  const hasTasks = elements.some((el) => !el.deleted && el.type === "task");

  useEffect(() => {
    if (!hasTasks) return;

    const load = () =>
      document.visibilityState === "visible" &&
      void trpc.task.getTasksByOrgId
        .query({})
        .then((tasks) =>
          setStatuses(new Map(tasks.map((task) => [task.key, task.status]))),
        )
        .catch(() => undefined);

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [hasTasks, trpc]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return {
    title,
    state,
    canEdit,
    viewerName,
    save,
    setSave,
    others,
    statuses,
    flush,
    dirty,
    pointer,
  };
}
