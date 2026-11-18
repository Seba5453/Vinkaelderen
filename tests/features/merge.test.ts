import { mergeLookup, needsRelookup } from "../../src/features/add/merge";
import { info } from "../factories";

const a = info({ name: "Château Musar", producer: "Château Musar", vintage: 2016 });
const id = (w = a) => ({ name: w.name, producer: w.producer, vintage: w.vintage });

test("no relookup when only price/type changed", () => {
  expect(needsRelookup(id(), { ...a, type: "hvid", notes: "x" })).toBe(false);
});
test("no relookup for whitespace/case-only name change", () => {
  expect(needsRelookup(id(), { ...a, name: " château musar " })).toBe(false);
});
test("relookup when vintage changed 2016 -> 2019", () => {
  expect(needsRelookup(id(), { ...a, vintage: 2019 })).toBe(true);
});
test("relookup when vintage cleared to NV", () => {
  expect(needsRelookup(id(), { ...a, vintage: null })).toBe(true);
});
test("relookup when producer changed", () => {
  expect(needsRelookup(id(), { ...a, producer: "Musar Jeune" })).toBe(true);
});
test("never relookup for manual entry (no AI answer)", () => {
  expect(needsRelookup(null, a)).toBe(false);
});
test("mergeLookup keeps touched grapes, refreshes untouched window/score/notes", () => {
  const fresh = info({ vintage: 2019, grapes: ["Cabernet"], drinkTo: 2040, aiScore: 4.5, notes: "Frisk" });
  const merged = mergeLookup({ ...a, vintage: 2019, grapes: ["Syrah"] }, new Set(["vintage", "grapes"]), fresh);
  expect(merged.grapes).toEqual(["Syrah"]);
  expect(merged.vintage).toBe(2019);
  expect(merged.drinkTo).toBe(2040);
  expect(merged.aiScore).toBe(4.5);
  expect(merged.notes).toBe("Frisk");
});
test("mergeLookup keeps touched name even if AI spells it differently", () => {
  const merged = mergeLookup({ ...a, name: "Musar Rouge" }, new Set(["name"]), info({ name: "Château Musar Rouge" }));
  expect(merged.name).toBe("Musar Rouge");
});

test("FIX-I1 mergeLookup always keeps the user's identity fields, even untouched", () => {
  const current = { ...a, vintage: 2019 };
  const merged = mergeLookup(current, new Set(["vintage"]), info({ name: "Château Musar Rouge DOCG", producer: "Musar", vintage: 2018 }));
  expect(merged.name).toBe("Château Musar");
  expect(merged.producer).toBe("Château Musar");
  expect(merged.vintage).toBe(2019);
});
test("FIX-I1 empty AI name never wipes the name", () => {
  const merged = mergeLookup({ ...a, vintage: null }, new Set(["vintage"]), info({ name: "", vintage: 2010 }));
  expect(merged.name).toBe("Château Musar");
  expect(merged.vintage).toBeNull();
});
