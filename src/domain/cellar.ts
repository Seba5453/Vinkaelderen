import type { DrinkLog, DrinkStatus, Purchase, Wine, WineInfo, WineType } from "./types";
import { drinkStatus } from "./status";

export type SortKey = "drink-first" | "name" | "vintage" | "score";
export interface CellarQuery {
  search: string; type: WineType | "alle"; sort: SortKey; includeEmpty: boolean;
  /** Only wines with this drinking status in `year` (default: current year). */
  status?: DrinkStatus; year?: number;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Ascending compare with nulls last. */
function nullsLast(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export function queryCellar(wines: Wine[], q: CellarQuery): Wine[] {
  const s = norm(q.search);
  const filtered = wines.filter((w) => {
    if (!q.includeEmpty && w.quantity <= 0) return false;
    if (q.type !== "alle" && w.type !== q.type) return false;
    if (q.status && drinkStatus(w, q.year ?? new Date().getFullYear()) !== q.status) return false;
    if (!s) return true;
    return [w.name, w.producer, w.region, w.country, ...w.grapes].some((f) => norm(f).includes(s));
  });
  const byName = (a: Wine, b: Wine) => a.name.localeCompare(b.name, "da");
  const cmp: Record<SortKey, (a: Wine, b: Wine) => number> = {
    "drink-first": (a, b) => nullsLast(a.drinkTo, b.drinkTo) || byName(a, b),
    name: byName,
    vintage: (a, b) => nullsLast(a.vintage, b.vintage) || byName(a, b),
    score: (a, b) => nullsLast(a.aiScore == null ? null : -a.aiScore, b.aiScore == null ? null : -b.aiScore) || byName(a, b),
  };
  return [...filtered].sort(cmp[q.sort]);
}

export function findDuplicate(wines: Wine[], info: Pick<WineInfo, "name" | "producer" | "vintage">): Wine | undefined {
  return wines.find(
    (w) => norm(w.name) === norm(info.name) && norm(w.producer) === norm(info.producer) && w.vintage === info.vintage,
  );
}

const newestFirst = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date));

export function latestPrice(purchases: Purchase[]): number | null {
  return newestFirst(purchases).find((p) => p.pricePerBottle != null)?.pricePerBottle ?? null;
}

export function latestOwnRating(logs: DrinkLog[]): number | null {
  return newestFirst(logs).find((l) => l.ownRating != null)?.ownRating ?? null;
}
