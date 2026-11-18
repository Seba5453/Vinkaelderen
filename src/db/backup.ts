import { z } from "zod";
import { db } from "./db";
import type { DrinkLog, Purchase, Wine } from "../domain/types";
import { WINE_TYPES } from "../domain/types";

export const BACKUP_FORMAT = "winecellar-backup";
export const BACKUP_VERSION = 1;

export class BackupError extends Error {
  kind: "ugyldig-fil" | "forkert-version";
  constructor(kind: "ugyldig-fil" | "forkert-version") {
    super(kind);
    this.kind = kind;
    this.name = "BackupError";
  }
}

const nullableStr = z.string().nullable();
const nullableNum = z.number().nullable();

const WineRow = z.object({
  id: z.string(), name: z.string(), producer: nullableStr, vintage: nullableNum, region: nullableStr, country: nullableStr,
  type: z.enum(WINE_TYPES as [string, ...string[]]), grapes: z.array(z.string()), notes: z.string(), pairings: z.array(z.string()),
  drinkFrom: nullableNum, drinkTo: nullableNum, aiScore: nullableNum, aiConfidence: z.enum(["hoj", "middel", "lav"]).nullable(),
  photoId: nullableStr, quantity: z.number().int().min(0), createdAt: z.string(),
});
const PurchaseRow = z.object({ id: z.string(), wineId: z.string(), date: z.string(), bottles: z.number(), pricePerBottle: nullableNum });
const DrinkRow = z.object({ id: z.string(), wineId: z.string(), date: z.string(), ownRating: nullableNum, note: z.string() });
const PhotoRow = z.object({ id: z.string(), dataUrl: z.string().startsWith("data:") });

const BackupFile = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  wines: z.array(WineRow),
  purchases: z.array(PurchaseRow),
  drinks: z.array(DrinkRow),
  photos: z.array(PhotoRow),
});

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]*);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new BackupError("ugyldig-fil");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

/** Everything except the API key. Does not record lastBackupAt; saveBackupFile does once the file is out. */
export async function exportBackup(): Promise<Blob> {
  const [wines, purchases, drinks, photos] = await Promise.all([
    db.wines.toArray(), db.purchases.toArray(), db.drinks.toArray(), db.photos.toArray(),
  ]);
  const file = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    wines, purchases, drinks,
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, dataUrl: await blobToDataUrl(p.blob) }))),
  };
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

/** Validates the whole file first; only then replaces all cellar data in one transaction. */
export async function importBackup(file: Blob): Promise<{ wines: number }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupError("ugyldig-fil");
  }
  const head = z.object({ format: z.literal(BACKUP_FORMAT), version: z.number() }).safeParse(raw);
  if (!head.success) throw new BackupError("ugyldig-fil");
  if (head.data.version !== BACKUP_VERSION) throw new BackupError("forkert-version");
  const parsed = BackupFile.safeParse(raw);
  if (!parsed.success) throw new BackupError("ugyldig-fil");
  const data = parsed.data;
  const photos = data.photos.map((p) => ({ id: p.id, blob: dataUrlToBlob(p.dataUrl) }));

  await db.transaction("rw", [db.wines, db.purchases, db.drinks, db.photos], async () => {
    await Promise.all([db.wines.clear(), db.purchases.clear(), db.drinks.clear(), db.photos.clear()]);
    await db.wines.bulkAdd(data.wines as Wine[]);
    await db.purchases.bulkAdd(data.purchases as Purchase[]);
    await db.drinks.bulkAdd(data.drinks as DrinkLog[]);
    await db.photos.bulkAdd(photos);
  });
  return { wines: data.wines.length };
}

export function backupFileName(date: Date): string {
  return `min-vinkaelder-${date.toISOString().slice(0, 10)}.json`;
}
