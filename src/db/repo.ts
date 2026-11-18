import { db } from "./db";
import type { DrinkLog, Purchase, Wine, WineInfo } from "../domain/types";

export type SettingKey = "apiKey" | "lastBackupAt";

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

export async function addWine(
  info: WineInfo,
  opts: { photo: Blob | null; bottles: number; pricePerBottle: number | null; date?: string },
): Promise<Wine> {
  const wine: Wine = { ...info, id: uid(), photoId: opts.photo ? uid() : null, quantity: opts.bottles, createdAt: new Date().toISOString() };
  await db.transaction("rw", db.wines, db.purchases, db.photos, async () => {
    if (opts.photo && wine.photoId) await db.photos.add({ id: wine.photoId, blob: opts.photo });
    await db.wines.add(wine);
    await db.purchases.add({ id: uid(), wineId: wine.id, date: opts.date ?? today(), bottles: opts.bottles, pricePerBottle: opts.pricePerBottle });
  });
  return wine;
}

export async function addPurchase(wineId: string, bottles: number, pricePerBottle: number | null, date?: string): Promise<void> {
  await db.transaction("rw", db.wines, db.purchases, async () => {
    const w = await db.wines.get(wineId);
    if (!w) throw new Error(`Unknown wine ${wineId}`);
    await db.purchases.add({ id: uid(), wineId, date: date ?? today(), bottles, pricePerBottle });
    await db.wines.update(wineId, { quantity: w.quantity + bottles });
  });
}

/** Set or clear the price on an existing purchase (e.g. forgotten at scan time). */
export async function updatePurchasePrice(purchaseId: string, pricePerBottle: number | null): Promise<void> {
  const n = await db.purchases.update(purchaseId, { pricePerBottle });
  if (!n && !(await db.purchases.get(purchaseId))) throw new Error(`Unknown purchase ${purchaseId}`);
}

/** Manual correction of the count. Clamped at 0; never creates a purchase. */
export async function adjustQuantity(wineId: string, delta: number): Promise<number> {
  return db.transaction("rw", db.wines, async () => {
    const w = await db.wines.get(wineId);
    if (!w) throw new Error(`Unknown wine ${wineId}`);
    const quantity = Math.max(0, w.quantity + delta);
    await db.wines.update(wineId, { quantity });
    return quantity;
  });
}

/** Records one bottle drunk. Returns false (and records nothing) if none are left. */
export async function logDrink(wineId: string, ownRating: number | null, note: string): Promise<boolean> {
  return db.transaction("rw", db.wines, db.drinks, async () => {
    const w = await db.wines.get(wineId);
    if (!w || w.quantity <= 0) return false;
    await db.wines.update(wineId, { quantity: w.quantity - 1 });
    await db.drinks.add({ id: uid(), wineId, date: today(), ownRating, note });
    return true;
  });
}

export async function updateWineInfo(wineId: string, info: Partial<WineInfo>): Promise<void> {
  await db.wines.update(wineId, info);
}

export const listWines = (): Promise<Wine[]> => db.wines.toArray();
export const listPurchases = (): Promise<Purchase[]> => db.purchases.toArray();
export const listDrinks = (): Promise<DrinkLog[]> => db.drinks.toArray();
export const getPhoto = async (id: string): Promise<Blob | undefined> => (await db.photos.get(id))?.blob;

export async function getWineDetail(
  id: string,
): Promise<{ wine: Wine; purchases: Purchase[]; drinks: DrinkLog[]; photo: Blob | null } | undefined> {
  const wine = await db.wines.get(id);
  if (!wine) return undefined;
  const [purchases, drinks, photo] = await Promise.all([
    db.purchases.where("wineId").equals(id).toArray(),
    db.drinks.where("wineId").equals(id).toArray(),
    wine.photoId ? getPhoto(wine.photoId) : Promise.resolve(undefined),
  ]);
  return { wine, purchases, drinks, photo: photo ?? null };
}

export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}

export async function setSetting<T>(key: SettingKey, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
