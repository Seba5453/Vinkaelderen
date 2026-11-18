import { APIError } from "@anthropic-ai/sdk";
import { identifyFromPhoto, lookupByText, wineInfoJsonSchema } from "../../src/ai/scan";
import { fakeClient, okResponse } from "./fakeClient";
import { info } from "../factories";

const sampleInfo = info();
const img = { base64: "AAA", mediaType: "image/jpeg" as const };

test("sends image + Danish system prompt with model and fallbacks", async () => {
  const client = fakeClient(okResponse(sampleInfo));
  await identifyFromPhoto(client, img);
  const p = client.calls[0];
  expect(p.model).toBe("claude-sonnet-5-5");
  expect(p.fallbacks).toBe("default");
  expect(p.betas).toContain("server-side-fallback-2026-07-01");
  expect(p.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAA" } });
  expect(p.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema" } });
  expect(p.system).toMatch(/dansk/i);
  expect(p.thinking).toBeUndefined();
  expect(p.temperature).toBeUndefined();
});

test("json schema is strict and has no top-level $schema", () => {
  expect(wineInfoJsonSchema).toMatchObject({ type: "object", additionalProperties: false });
  expect(wineInfoJsonSchema).not.toHaveProperty("$schema");
});

test("returns parsed WineInfo", async () => {
  expect(await identifyFromPhoto(fakeClient(okResponse(sampleInfo)), img)).toEqual(sampleInfo);
});

test("NV wine: vintage null accepted", async () => {
  const nv = info({ name: "Vintage Port", vintage: null, type: "hedvin" });
  expect((await identifyFromPhoto(fakeClient(okResponse(nv)), img)).vintage).toBeNull();
});

test("low-confidence result with nulls is returned, not thrown", async () => {
  const unsure = info({ name: "", producer: null, vintage: null, region: null, country: null, grapes: [], notes: "", pairings: [],
    drinkFrom: null, drinkTo: null, aiScore: null, aiConfidence: "lav", type: "andet" });
  expect(await identifyFromPhoto(fakeClient(okResponse(unsure)), img)).toEqual(unsure);
});

test("missing required field -> ugyldigt-svar", async () => {
  const { name: _n, ...noName } = info();
  await expect(identifyFromPhoto(fakeClient(okResponse(noName)), img)).rejects.toMatchObject({ kind: "ugyldigt-svar" });
});

test("lookupByText sends no image and includes name/producer/vintage text", async () => {
  const client = fakeClient(okResponse(sampleInfo));
  await lookupByText(client, { name: "Château Musar", producer: "Château Musar", vintage: 2019 });
  const content = client.calls[0].messages[0].content;
  const text = JSON.stringify(content);
  expect(text).not.toContain('"image"');
  expect(text).toContain("Château Musar");
  expect(text).toContain("2019");
});

test("lookupByText for NV says non-vintage", async () => {
  const client = fakeClient(okResponse(sampleInfo));
  await lookupByText(client, { name: "Vintage Port", producer: null, vintage: null });
  expect(JSON.stringify(client.calls[0].messages)).toMatch(/uden årgang/i);
});

test("SDK error is mapped to AiError", async () => {
  const err = APIError.generate(401, { type: "error", error: { type: "authentication_error", message: "bad" } }, "bad", new Headers());
  await expect(identifyFromPhoto(fakeClient(err), img)).rejects.toMatchObject({ kind: "ugyldig-noegle" });
});

test("refusal -> afvist", async () => {
  await expect(identifyFromPhoto(fakeClient({ stop_reason: "refusal", content: [] }), img)).rejects.toMatchObject({ kind: "afvist" });
});

test("json schema carries no numeric bounds", () => {
  const s = JSON.stringify(wineInfoJsonSchema);
  expect(s).not.toContain("minimum");
  expect(s).not.toContain("maximum");
});

test("FIX-M2 out-of-range fields are nulled instead of rejecting the scan", async () => {
  const r = await identifyFromPhoto(fakeClient(okResponse(info({ aiScore: 7, vintage: 1066, drinkFrom: 2040, drinkTo: 2030 }))), img);
  expect(r.name).toBe("Château Musar");
  expect(r.aiScore).toBeNull();
  expect(r.vintage).toBeNull();
  expect([r.drinkFrom, r.drinkTo]).toEqual([null, null]);
});
