import { useCallback, useRef, type RefObject } from "react";
import {
  live,
  newId,
  topZ,
  touch,
  type El,
} from "../canvas/model";
import { restore } from "../canvas/sync";
import { route } from "../canvas/geometry";
import type { BoardStyle } from "./editor-types";

export function useBoardCrud({
  latest,
  setElements,
  selected,
  setSelected,
  selection,
  dirty,
  setSave,
  remote,
  setStyle,
}: {
  latest: RefObject<El[]>;
  setElements: React.Dispatch<React.SetStateAction<El[]>>;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  selection: El[];
  dirty: RefObject<boolean>;
  setSave: (save: "saved" | "saving" | "dirty" | "error") => void;
  remote: RefObject<Map<string, number>>;
  setStyle: React.Dispatch<React.SetStateAction<BoardStyle>>;
}) {
  const history = useRef<{ past: El[][]; future: El[][] }>({
    past: [],
    future: [],
  });
  const clipboard = useRef<El[]>([]);

  const commit = useCallback(
    (next: El[], record = true) => {
      if (record) {
        history.current.past = [
          ...history.current.past.slice(-99),
          latest.current,
        ];
        history.current.future = [];
      }

      latest.current = next;
      setElements(next);
      dirty.current = true;
      setSave("dirty");
    },
    [dirty, latest, setElements, setSave],
  );

  const replace = useCallback(
    (changed: El[], record = true) => {
      const map = new Map(changed.map((el) => [el.id, el]));
      commit(
        latest.current.map((el) => map.get(el.id) ?? el),
        record,
      );
    },
    [commit, latest],
  );

  const add = useCallback(
    (fresh: El[]) => {
      let z = topZ(latest.current);
      const placed = fresh.map((el) => ({ ...el, z: z++, v: el.v ?? 1 }));
      const map = new Map(placed.map((el) => [el.id, el]));
      const withLinks = placed.map((el) =>
        el.type === "arrow" || el.type === "line"
          ? route(
              el,
              new Map([
                ...latest.current.map((one) => [one.id, one] as const),
                ...map,
              ]),
            )
          : el,
      );

      commit([...latest.current, ...withLinks]);
      setSelected(withLinks.map((el) => el.id));
    },
    [commit, latest, setSelected],
  );

  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(latest.current);
    commit(restore(previous, latest.current, remote.current), false);
    setSelected([]);
  }, [commit, latest, remote, setSelected]);

  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(latest.current);
    commit(restore(next, latest.current, remote.current), false);
  }, [commit, latest, remote]);

  const withGroup = useCallback(
    (el: El) =>
      el.groupId
        ? live(latest.current)
            .filter((one) => one.groupId === el.groupId)
            .map((one) => one.id)
        : [el.id],
    [latest],
  );

  const removeSelected = useCallback(() => {
    if (!selected.length) return;
    const gone = new Set(selected);
    replace(
      latest.current
        .filter((el) => gone.has(el.id) && !el.locked)
        .map((el) => touch(el, { deleted: true })),
    );
    setSelected([]);
  }, [selected, replace, latest, setSelected]);

  const restyle = useCallback(
    (change: Partial<El>) => {
      setStyle((current) => ({ ...current, ...change }) as typeof current);
      if (!selection.length) return;
      replace(selection.map((el) => touch(el, change)));
    },
    [selection, replace, setStyle],
  );

  const copy = useCallback(() => {
    if (!selection.length) return;
    clipboard.current = selection;
  }, [selection]);

  const paste = useCallback(
    (offset = 24) => {
      if (!clipboard.current.length) return;
      const ids = new Map(clipboard.current.map((el) => [el.id, newId()]));
      const groups = new Map<string, string>();

      add(
        clipboard.current.map((el) => ({
          ...el,
          id: ids.get(el.id)!,
          x: el.x + offset,
          y: el.y + offset,
          v: 1,
          locked: false,
          groupId: el.groupId
            ? (groups.get(el.groupId) ??
              (groups.set(el.groupId, newId()), groups.get(el.groupId)!))
            : undefined,
          start:
            el.start && ids.has(el.start.id)
              ? { id: ids.get(el.start.id)! }
              : undefined,
          end:
            el.end && ids.has(el.end.id)
              ? { id: ids.get(el.end.id)! }
              : undefined,
        })),
      );
    },
    [add],
  );

  const restack = useCallback(
    (front: boolean) => {
      if (!selection.length) return;
      const all = live(latest.current);
      let z = front
        ? topZ(all)
        : Math.min(...all.map((el) => el.z ?? 0)) - selection.length;
      replace(selection.map((el) => touch(el, { z: z++ })));
    },
    [selection, replace, latest],
  );

  const group = useCallback(
    (on: boolean) => {
      if (!selection.length) return;
      const groupId = on ? newId() : undefined;
      replace(selection.map((el) => touch(el, { groupId })));
    },
    [selection, replace],
  );

  const lock = useCallback(
    (on: boolean) => replace(selection.map((el) => touch(el, { locked: on }))),
    [selection, replace],
  );

  return {
    commit,
    replace,
    add,
    undo,
    redo,
    withGroup,
    removeSelected,
    restyle,
    copy,
    paste,
    restack,
    group,
    lock,
    history,
  };
}
