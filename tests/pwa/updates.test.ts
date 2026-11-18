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

import { createUpdateGate } from "../../src/pwa/updates";

describe("createUpdateGate", () => {
  let hash = "#/";
  const isSafe = () => hash === "" || hash === "#/";
  const go = (h: string) => { hash = h; window.dispatchEvent(new Event("hashchange")); };
  beforeEach(() => { hash = "#/"; Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); });

  test("applies a ready update at once when on the cellar screen", () => {
    const apply = vi.fn();
    createUpdateGate({ isSafe, apply, doc: document, win: window }).markPending();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  test("mid-scan or mid-question it waits until the user is back on Min Vinkælder", () => {
    const apply = vi.fn();
    hash = "#/tilfoej";
    const gate = createUpdateGate({ isSafe, apply, doc: document, win: window });
    gate.markPending();
    expect(apply).not.toHaveBeenCalled();
    go("#/spoerg");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(apply).not.toHaveBeenCalled();
    go("#/");
    expect(apply).toHaveBeenCalledTimes(1);
    go("#/spoerg"); go("#/");
    expect(apply).toHaveBeenCalledTimes(1);
  });

  test("does nothing without a pending update", () => {
    const apply = vi.fn();
    createUpdateGate({ isSafe, apply, doc: document, win: window });
    go("#/");
    expect(apply).not.toHaveBeenCalled();
  });
});

import { onCellarScreen } from "../../src/pwa/updates";
test("only the cellar list counts as a safe screen", () => {
  expect(["", "#", "#/"].every(onCellarScreen)).toBe(true);
  expect(["#/tilfoej", "#/spoerg", "#/vin/abc", "#/indstillinger"].some(onCellarScreen)).toBe(false);
});
