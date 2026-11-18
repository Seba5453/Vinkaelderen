import { queryCellar, findDuplicate, latestPrice, latestOwnRating, type CellarQuery } from "../../src/domain/cellar";
import { wine } from "../factories";

const q = (o: Partial<CellarQuery> = {}): CellarQuery => ({ search: "", type: "alle", sort: "name", includeEmpty: false, ...o });

test("search matches name, producer, region, grapes case-insensitively", () => {
  const a = wine({ name: "Château Musar" });
  const b = wine({ name: "Barolo", producer: "Vietti", region: "Piemonte", grapes: ["Nebbiolo"] });
  expect(queryCellar([a, b], q({ search: "musar" }))).toEqual([a]);
  expect(queryCellar([a, b], q({ search: "VIETTI" }))).toEqual([b]);
  expect(queryCellar([a, b], q({ search: "piemonte" }))).toEqual([b]);
  expect(queryCellar([a, b], q({ search: "nebbi" }))).toEqual([b]);
});

test("type filter", () => {
  const red = wine({ type: "rod" });
  const port = wine({ type: "hedvin", name: "Taylor's" });
  expect(queryCellar([red, port], q({ type: "hedvin" }))).toEqual([port]);
});

test("includeEmpty=false hides quantity 0", () => {
  const empty = wine({ quantity: 0 });
  const full = wine({ quantity: 2 });
  expect(queryCellar([empty, full], q())).toEqual([full]);
  expect(queryCellar([empty, full], q({ includeEmpty: true }))).toHaveLength(2);
});

test("drink-first sorts by drinkTo ascending, null last", () => {
  const a = wine({ drinkTo: 2035 }), b = wine({ drinkTo: null }), c = wine({ drinkTo: 2027 });
  expect(queryCellar([a, b, c], q({ sort: "drink-first" }))).toEqual([c, a, b]);
});

test("score sorts descending, null last", () => {
  const a = wine({ aiScore: 3.5 }), b = wine({ aiScore: null }), c = wine({ aiScore: 4.6 });
  expect(queryCellar([a, b, c], q({ sort: "score" }))).toEqual([c, a, b]);
});

test("vintage sorts oldest first, NV last", () => {
  const a = wine({ vintage: 2019 }), b = wine({ vintage: null }), c = wine({ vintage: 2010 });
  expect(queryCellar([a, b, c], q({ sort: "vintage" }))).toEqual([c, a, b]);
});

test("findDuplicate matches name+producer+vintage ignoring case/whitespace", () => {
  const w = wine({ name: "Château Musar", producer: "Château Musar", vintage: 2016 });
  expect(findDuplicate([w], { name: " château musar", producer: "CHÂTEAU MUSAR ", vintage: 2016 })).toBe(w);
  expect(findDuplicate([w], { name: "Château Musar", producer: "Château Musar", vintage: 2017 })).toBeUndefined();
});

test("findDuplicate: NV only matches NV", () => {
  const nv = wine({ name: "Vintage Port", producer: "Taylor's", vintage: null });
  expect(findDuplicate([nv], { name: "Vintage Port", producer: "Taylor's", vintage: 2017 })).toBeUndefined();
  expect(findDuplicate([nv], { name: "vintage port ", producer: "taylor's", vintage: null })).toBe(nv);
});

test("latestPrice takes most recent purchase with a price", () => {
  expect(latestPrice([
    { id: "1", wineId: "w", date: "2025-01-10", bottles: 3, pricePerBottle: 200 },
    { id: "3", wineId: "w", date: "2026-05-01", bottles: 1, pricePerBottle: null },
    { id: "2", wineId: "w", date: "2026-03-02", bottles: 2, pricePerBottle: 250 },
  ])).toBe(250);
  expect(latestPrice([])).toBeNull();
});

test("latestOwnRating takes most recent rated log", () => {
  expect(latestOwnRating([
    { id: "1", wineId: "w", date: "2025-01-10", ownRating: 3, note: "" },
    { id: "2", wineId: "w", date: "2026-02-01", ownRating: 5, note: "" },
    { id: "3", wineId: "w", date: "2026-06-01", ownRating: null, note: "" },
  ])).toBe(5);
  expect(latestOwnRating([])).toBeNull();
});

test("status filter keeps only wines with that drinking status in the given year", () => {
  const ws = [
    wine({ id: "a", drinkFrom: 2030, drinkTo: 2040 }),
    wine({ id: "b", drinkFrom: 2020, drinkTo: 2030 }),
    wine({ id: "c", drinkFrom: 2018, drinkTo: 2026 }),
  ];
  const base: CellarQuery = { search: "", type: "alle", sort: "name", includeEmpty: false };
  expect(queryCellar(ws, { ...base, status: "drik-snart", year: 2026 }).map((w) => w.id)).toEqual(["c"]);
  expect(queryCellar(ws, { ...base, status: "klar", year: 2026 }).map((w) => w.id)).toEqual(["b"]);
  expect(queryCellar(ws, { ...base, year: 2026 })).toHaveLength(3);
});
