import { askSommelier, toCellarContext, type CellarItemForAi } from "../../src/ai/ask";
import { fakeClient, okResponse } from "./fakeClient";
import { wine } from "../factories";

const item = (o: Partial<CellarItemForAi> = {}): CellarItemForAi => ({
  id: "a", name: "Château Musar", producer: "Château Musar", vintage: 2016, type: "rod", grapes: ["Cinsault"],
  drinkFrom: 2024, drinkTo: 2038, aiScore: 4.2, ownRating: null, quantity: 2, pricePerBottle: 300, ...o,
});
const answer = (ids: string[]) => okResponse({ intro: "Godt valg", recommendations: ids.map((wineId) => ({ wineId, reason: "fordi" })) });

test("toCellarContext excludes quantity 0 and uses latest price/rating", () => {
  const a = wine({ id: "a", quantity: 2 });
  const b = wine({ id: "b", quantity: 0 });
  const ctx = toCellarContext(
    [a, b],
    [
      { id: "p1", wineId: "a", date: "2025-01-01", bottles: 1, pricePerBottle: 200 },
      { id: "p2", wineId: "a", date: "2026-01-01", bottles: 1, pricePerBottle: 260 },
    ],
    [{ id: "d1", wineId: "a", date: "2026-02-01", ownRating: 5, note: "" }],
  );
  expect(ctx).toHaveLength(1);
  expect(ctx[0]).toMatchObject({ id: "a", pricePerBottle: 260, ownRating: 5, quantity: 2 });
  expect(ctx[0]).not.toHaveProperty("notes");
});

test("cellar and year are in system, question in last user message", async () => {
  const client = fakeClient(answer(["a"]));
  await askSommelier(client, [item()], [], "Hvad skal vi drikke?", 2026);
  const p = client.calls[0];
  expect(p.system).toContain("Château Musar");
  expect(p.system).toContain("2026");
  expect(p.messages.at(-1)).toEqual({ role: "user", content: "Hvad skal vi drikke?" });
  expect(p.model).toBe("claude-sonnet-5-5");
  expect(p.output_config.format.type).toBe("json_schema");
});

test("follow-up resends earlier turns in order", async () => {
  const client = fakeClient(answer(["a"]));
  await askSommelier(client, [item()], [{ role: "user", text: "Q1" }, { role: "assistant", text: "A1" }], "Noget billigere?", 2026);
  expect(client.calls[0].messages).toEqual([
    { role: "user", content: "Q1" }, { role: "assistant", content: "A1" }, { role: "user", content: "Noget billigere?" },
  ]);
});

test("drops recommendations for unknown ids and out-of-stock ids", async () => {
  const client = fakeClient(answer(["a", "ghost", "empty"]));
  const ans = await askSommelier(client, [item({ id: "a" }), item({ id: "empty", quantity: 0 })], [], "Hvad skal vi drikke?", 2026);
  expect(ans.recommendations.map((r) => r.wineId)).toEqual(["a"]);
});

test("preserves recommendation order", async () => {
  const ans = await askSommelier(fakeClient(answer(["b", "a"])), [item({ id: "a" }), item({ id: "b" })], [], "Rødvin først, portvin senere", 2026);
  expect(ans.recommendations.map((r) => r.wineId)).toEqual(["b", "a"]);
});

test("empty cellar still asks and returns AI intro", async () => {
  const ans = await askSommelier(fakeClient(okResponse({ intro: "Din kælder er tom", recommendations: [] })), [], [], "Hvad nu?", 2026);
  expect(ans).toEqual({ intro: "Din kælder er tom", recommendations: [], shoppingList: [] });
});

test("malformed answer -> ugyldigt-svar", async () => {
  await expect(askSommelier(fakeClient(okResponse({ nope: 1 })), [item()], [], "?", 2026)).rejects.toMatchObject({ kind: "ugyldigt-svar" });
});

const shop = (n: number) => Array.from({ length: n }, (_, i) => ({ suggestion: `Forslag ${i + 1}`, reason: "mangler" }));

test("shoppingList is passed through and capped at 5", async () => {
  const client = fakeClient(okResponse({ intro: "Du mangler hvidvin", recommendations: [], shoppingList: shop(7) }));
  const a = await askSommelier(client, [item()], [], "Hvad mangler jeg?", 2026);
  expect(a.shoppingList).toHaveLength(5);
  expect(a.shoppingList[0]).toEqual({ suggestion: "Forslag 1", reason: "mangler" });
});

test("an answer without shoppingList gets an empty one", async () => {
  const a = await askSommelier(fakeClient(answer(["a"])), [item()], [], "Hvad skal vi drikke?", 2026);
  expect(a.shoppingList).toEqual([]);
});

test("the API schema requires shoppingList and the prompt explains it", async () => {
  const client = fakeClient(answer([]));
  await askSommelier(client, [item()], [], "x", 2026);
  const schema = client.calls[0].output_config.format.schema;
  expect(schema.required).toContain("shoppingList");
  expect(client.calls[0].system).toMatch(/shoppingList/);
});
