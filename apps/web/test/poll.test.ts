import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { everyWhileVisible } from "../src/lib/poll";

type Listener = () => void;

function fakeDocument() {
  const listeners = new Set<Listener>();
  const doc = {
    visibilityState: "visible" as "visible" | "hidden",
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    show() {
      doc.visibilityState = "visible";
      listeners.forEach((fn) => fn());
    },
    hide() {
      doc.visibilityState = "hidden";
      listeners.forEach((fn) => fn());
    },
    listeners,
  };

  return doc;
}

describe("everyWhileVisible", () => {
  let doc: ReturnType<typeof fakeDocument>;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = fakeDocument();
    vi.stubGlobal("document", doc);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls while visible, stays quiet while hidden, and catches up on return", () => {
    const fn = vi.fn();
    const stop = everyWhileVisible(fn, 1000);

    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(3);

    doc.hide();
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(3);

    doc.show();
    expect(fn).toHaveBeenCalledTimes(4);

    stop();
    vi.advanceTimersByTime(5000);
    doc.show();
    expect(fn).toHaveBeenCalledTimes(4);
    expect(doc.listeners.size).toBe(0);
  });
});
