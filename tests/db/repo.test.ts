import { db } from "../../src/db/db";
import { addWine, addPurchase, adjustQuantity, logDrink, listWines, getWineDetail, getSetting, setSetting, updateWineInfo } from "../../src/db/repo";
import { info } from "../factories";

beforeEach(async () => { await db.delete(); await db.open(); });

test("addWine stores wine, photo and first purchase; quantity = bottles", async () => {
  const w = await addWine(info(), { photo: new Blob(["x"], { type: "image/jpeg" }), bottles: 3, pricePerBottle: 200, date: "2026-11-18" });
  expect(w.quantity).toBe(3);
  expect(w.photoId).not.toBeNull();
  const d = (await getWineDetail(w.id))!;
  expect(d.purchases).toEqual([expect.objectContaining({ bottles: 3, pricePerBottle: 200, date: "2026-11-18" })]);
  expect(await db.photos.count()).toBe(1);
});

test("addPurchase records separate purchase and adds to quantity", async () => {
  const w = await addWine(info(), { photo: null, bottles: 3, pricePerBottle: 200 });
  await addPurchase(w.id, 2, 250);
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(5);
  expect(d.purchases.map((p) => p.pricePerBottle).sort()).toEqual([200, 250]);
});

test("adjustQuantity clamps at 0 and creates no purchase", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  expect(await adjustQuantity(w.id, -3)).toBe(0);
  expect(await adjustQuantity(w.id, 2)).toBe(2);
  expect((await getWineDetail(w.id))!.purchases).toHaveLength(1);
});

test("logDrink decrements and records rating", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  expect(await logDrink(w.id, 4, "Skøn")).toBe(true);
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(0);
  expect(d.drinks).toEqual([expect.objectContaining({ ownRating: 4, note: "Skøn" })]);
});

test("logDrink at 0 returns false and logs nothing", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  await logDrink(w.id, null, "");
  expect(await logDrink(w.id, 5, "")).toBe(false);
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(0);
  expect(d.drinks).toHaveLength(1);
});

test("updateWineInfo and listWines", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  await updateWineInfo(w.id, { notes: "Ny note" });
  expect((await listWines())[0].notes).toBe("Ny note");
});

test("settings round-trip", async () => {
  expect(await getSetting("apiKey")).toBeUndefined();
  await setSetting("apiKey", "sk-test");
  expect(await getSetting<string>("apiKey")).toBe("sk-test");
});
