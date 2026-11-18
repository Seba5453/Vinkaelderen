import type { Wine, WineInfo } from "../src/domain/types";

export function info(overrides: Partial<WineInfo> = {}): WineInfo {
  return {
    name: "Château Musar", producer: "Château Musar", vintage: 2016,
    region: "Bekaa", country: "Libanon", type: "rod",
    grapes: ["Cabernet Sauvignon", "Cinsault", "Carignan"],
    notes: "Tørrede kirsebær, cedertræ", pairings: ["Lam"],
    drinkFrom: 2024, drinkTo: 2038, aiScore: 4.2, aiConfidence: "hoj",
    ...overrides,
  };
}

let n = 0;
export function wine(overrides: Partial<Wine> = {}): Wine {
  n++;
  return { ...info(), id: `w${n}`, photoId: null, quantity: 1, createdAt: "2026-01-01T00:00:00.000Z", ...overrides };
}
