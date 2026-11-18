import { db } from "../../src/db/db";
import { addWine, addPurchase, logDrink, listWines, getWineDetail, setSetting, getSetting } from "../../src/db/repo";
import { exportBackup, importBackup, backupFileName, BACKUP_FORMAT } from "../../src/db/backup";
import { info } from "../factories";

beforeEach(async () => { await db.delete(); await db.open(); });

const jsonBlob = (o: unknown) => new Blob([JSON.stringify(o)], { type: "application/json" });

test("export then import restores wines, purchases, drinks and photos", async () => {
  const w = await addWine(info(), { photo: new Blob(["img"], { type: "image/jpeg" }), bottles: 3, pricePerBottle: 200 });
  await addPurchase(w.id, 2, 250);
  await logDrink(w.id, 4, "God");
  const backup = await exportBackup();
  await db.delete(); await db.open();
  expect(await listWines()).toHaveLength(0);
  expect(await importBackup(backup)).toEqual({ wines: 1 });
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(4);
  expect(d.purchases).toHaveLength(2);
  expect(d.drinks).toHaveLength(1);
  expect(await d.photo!.text()).toBe("img");
});

test("export excludes apiKey and records lastBackupAt", async () => {
  await setSetting("apiKey", "sk-secret");
  const text = await (await exportBackup()).text();
  expect(text).not.toContain("sk-secret");
  expect(await getSetting("lastBackupAt")).toBeTruthy();
});

test("import keeps the current apiKey", async () => {
  await setSetting("apiKey", "sk-mine");
  const b = await exportBackup();
  await importBackup(b);
  expect(await getSetting("apiKey")).toBe("sk-mine");
});

test("garbage file throws ugyldig-fil and keeps existing data", async () => {
  await addWine(info(), { photo: null, bottles: 2, pricePerBottle: null });
  await expect(importBackup(new Blob(["{not json"]))).rejects.toMatchObject({ kind: "ugyldig-fil" });
  expect(await listWines()).toHaveLength(1);
});

test("valid JSON with wrong format/shape throws ugyldig-fil, data kept", async () => {
  await addWine(info(), { photo: null, bottles: 2, pricePerBottle: null });
  await expect(importBackup(jsonBlob({ hello: "world" }))).rejects.toMatchObject({ kind: "ugyldig-fil" });
  await expect(importBackup(jsonBlob({ format: BACKUP_FORMAT, version: 1, wines: [{ id: 1 }], purchases: [], drinks: [], photos: [] })))
    .rejects.toMatchObject({ kind: "ugyldig-fil" });
  expect(await listWines()).toHaveLength(1);
});

test("newer version throws forkert-version, data kept", async () => {
  await addWine(info(), { photo: null, bottles: 2, pricePerBottle: null });
  await expect(importBackup(jsonBlob({ format: BACKUP_FORMAT, version: 2 }))).rejects.toMatchObject({ kind: "forkert-version" });
  expect(await listWines()).toHaveLength(1);
});

test("backupFileName", () => expect(backupFileName(new Date("2026-11-18"))).toBe("min-vinkaelder-2026-11-18.json"));
