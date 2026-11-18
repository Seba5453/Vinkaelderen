import type { DrinkStatus, Wine } from "./types";

export function drinkStatus(w: Pick<Wine, "drinkFrom" | "drinkTo">, year: number): DrinkStatus {
  if (w.drinkTo != null && year >= w.drinkTo) return "drik-snart";
  if (w.drinkFrom != null && year < w.drinkFrom) return "gem";
  if (w.drinkFrom != null || w.drinkTo != null) return "klar";
  return "ukendt";
}
