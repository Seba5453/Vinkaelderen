import Dexie, { type Table } from "dexie";
import type { DrinkLog, Photo, Purchase, Wine } from "../domain/types";

export interface SettingRow { key: string; value: unknown; }

export class WineCellarDB extends Dexie {
  wines!: Table<Wine, string>;
  purchases!: Table<Purchase, string>;
  drinks!: Table<DrinkLog, string>;
  photos!: Table<Photo, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("winecellar");
    this.version(1).stores({
      wines: "id",
      purchases: "id, wineId",
      drinks: "id, wineId",
      photos: "id",
      settings: "key",
    });
  }
}

export const db = new WineCellarDB();
