import { touch, type El } from "./model";

/**
 * A board's shapes, merged with the server's copy: the newer version of each
 * wins, and on a tie the server's, which is the copy everyone else has.
 * Every shape taken from the server is noted in `remote` (id → version), so
 * undo can tell other people's changes from this person's own.
 */
export function mergeIn(
  local: El[],
  incoming: El[],
  busy: Set<string>,
  remote: Map<string, number>,
) {
  const byId = new Map(local.map((el) => [el.id, el]));
  let changed = false;

  for (const el of incoming) {
    const mine = byId.get(el.id);

    if (busy.has(el.id)) continue;

    const newer = !mine || (el.v ?? 0) > (mine.v ?? 0);
    const tie =
      mine !== undefined &&
      (el.v ?? 0) === (mine.v ?? 0) &&
      // Two deleted copies are the same shape, however each is stored.
      !(el.deleted && mine.deleted) &&
      JSON.stringify(el) !== JSON.stringify(mine);

    if (newer || tie) {
      byId.set(el.id, el);
      remote.set(el.id, el.v ?? 0);
      changed = true;
    }
  }

  return changed ? [...byId.values()] : local;
}

/**
 * Undo back to an earlier board, for this person's own changes only: a shape
 * whose current copy came from someone else is left alone. Each shape that
 * goes back gets a version newer than now, so the undo saves and syncs like
 * any edit.
 */
export function restore(
  snapshot: El[],
  current: El[],
  remote: Map<string, number>,
) {
  const before = new Map(snapshot.map((el) => [el.id, el]));
  const strip = (el: El) => JSON.stringify({ ...el, v: 0 });

  return current.map((el) => {
    if (remote.get(el.id) === (el.v ?? 0)) return el;

    const old = before.get(el.id);

    if (!old) return el.deleted ? el : touch(el, { deleted: true });

    return strip(old) === strip(el) ? el : { ...old, v: (el.v ?? 0) + 1 };
  });
}
