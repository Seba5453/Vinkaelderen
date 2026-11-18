import { db } from "../../src/db/db";
import { getSetting } from "../../src/db/repo";
import { exportBackup } from "../../src/db/backup";
import { saveBackupFile } from "../../src/db/saveBackup";

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(() => { vi.unstubAllGlobals(); });

test("FIX-I3 exportBackup alone does not mark a backup as done", async () => {
  await exportBackup();
  expect(await getSetting("lastBackupAt")).toBeUndefined();
});

test("FIX-I3 shares the file when the share sheet supports files, then records lastBackupAt", async () => {
  const shared: any[] = [];
  vi.stubGlobal("navigator", { ...navigator, canShare: () => true, share: async (d: any) => { shared.push(d); } });
  expect(await saveBackupFile(await exportBackup(), "min-vinkaelder-2026-11-18.json")).toBe(true);
  expect(shared[0].files[0].name).toBe("min-vinkaelder-2026-11-18.json");
  expect(await getSetting("lastBackupAt")).toBeTruthy();
});

test("FIX-I3 cancelled share records nothing", async () => {
  vi.stubGlobal("navigator", { ...navigator, canShare: () => true, share: async () => { throw new DOMException("x", "AbortError"); } });
  expect(await saveBackupFile(await exportBackup(), "b.json")).toBe(false);
  expect(await getSetting("lastBackupAt")).toBeUndefined();
});
