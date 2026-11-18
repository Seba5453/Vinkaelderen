/**
 * iOS home-screen apps rarely re-check the service worker on their own, so a
 * new version could stay hidden until the app was killed twice. Ask for an
 * update every time the app comes back to the foreground; with autoUpdate the
 * plugin then activates the new version and reloads.
 */
export function watchForUpdates(reg: { update(): Promise<unknown> }, doc: Document): () => void {
  const onChange = () => {
    if (doc.visibilityState === "visible") reg.update().catch(() => { /* offline: try next time */ });
  };
  doc.addEventListener("visibilitychange", onChange);
  return () => doc.removeEventListener("visibilitychange", onChange);
}

/**
 * A downloaded update reloads the page, which would wipe an unsaved scan, an
 * edit form or the Spørg chat. Hold it until the user is on a screen with
 * nothing to lose (Min Vinkælder) and the app is visible, then apply once.
 */
export function createUpdateGate(o: { isSafe(): boolean; apply(): void; doc: Document; win: Window }): { markPending(): void } {
  let pending = false;
  let applied = false;
  const tryApply = () => {
    if (!pending || applied || o.doc.visibilityState !== "visible" || !o.isSafe()) return;
    applied = true;
    o.apply();
  };
  o.win.addEventListener("hashchange", tryApply);
  o.doc.addEventListener("visibilitychange", tryApply);
  return { markPending() { pending = true; tryApply(); } };
}

/** Min Vinkælder (the list) holds no unsaved input. */
export const onCellarScreen = (hash: string) => hash === "" || hash === "#" || hash === "#/";
