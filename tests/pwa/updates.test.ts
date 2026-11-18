import { watchForUpdates } from "../../src/pwa/updates";

function setVisibility(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
  document.dispatchEvent(new Event("visibilitychange"));
}

test("checks for an update when the app becomes visible again", () => {
  const reg = { update: vi.fn().mockResolvedValue(undefined) };
  const stop = watchForUpdates(reg, document);
  setVisibility("hidden");
  expect(reg.update).not.toHaveBeenCalled();
  setVisibility("visible");
  expect(reg.update).toHaveBeenCalledTimes(1);
  stop();
});

test("a failed check (offline) does not throw", async () => {
  const reg = { update: vi.fn().mockRejectedValue(new Error("offline")) };
  const stop = watchForUpdates(reg, document);
  expect(() => setVisibility("visible")).not.toThrow();
  await Promise.resolve();
  stop();
});

test("stops watching after unsubscribe", () => {
  const reg = { update: vi.fn().mockResolvedValue(undefined) };
  watchForUpdates(reg, document)();
  setVisibility("visible");
  expect(reg.update).not.toHaveBeenCalled();
});
