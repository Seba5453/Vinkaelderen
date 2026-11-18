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
