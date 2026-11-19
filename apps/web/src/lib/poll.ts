/**
 * Calls `fn` every `ms` while the tab is visible, and once right away when a
 * hidden tab comes back, so background tabs don't keep hitting the server.
 * Returns the cleanup.
 */
export function everyWhileVisible(fn: () => unknown, ms: number) {
  const whenVisible = () => {
    if (document.visibilityState === "visible") void fn();
  };
  const id = setInterval(whenVisible, ms);

  document.addEventListener("visibilitychange", whenVisible);

  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", whenVisible);
  };
}
