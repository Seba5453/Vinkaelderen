import { APIError, APIConnectionError } from "@anthropic-ai/sdk";
import { toAiError, extractJson, AiError } from "../../src/ai/errors";

const apiErr = (status: number) => APIError.generate(status, { type: "error", error: { type: "x", message: "m" } }, "m", new Headers());

test("401 -> ugyldig-noegle", () => expect(toAiError(apiErr(401)).kind).toBe("ugyldig-noegle"));
test("403 -> ugyldig-noegle", () => expect(toAiError(apiErr(403)).kind).toBe("ugyldig-noegle"));
test("429 -> for-mange", () => expect(toAiError(apiErr(429)).kind).toBe("for-mange"));
test("529 overloaded -> for-mange", () => expect(toAiError(apiErr(529)).kind).toBe("for-mange"));
test("connection error -> netvaerk", () => expect(toAiError(new APIConnectionError({ message: "down" })).kind).toBe("netvaerk"));
test("AiError passes through", () => { const e = new AiError("afvist"); expect(toAiError(e)).toBe(e); });
test("unknown -> ukendt", () => expect(toAiError(new Error("?")).kind).toBe("ukendt"));

test("refusal stop_reason -> afvist", () =>
  expect(() => extractJson({ stop_reason: "refusal", content: [] })).toThrow(expect.objectContaining({ kind: "afvist" })));
test("extracts JSON from first text block", () =>
  expect(extractJson({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"a":1}' }] })).toEqual({ a: 1 }));
test("non-JSON text -> ugyldigt-svar", () =>
  expect(() => extractJson({ stop_reason: "end_turn", content: [{ type: "text", text: "hej" }] })).toThrow(expect.objectContaining({ kind: "ugyldigt-svar" })));
test("max_tokens cut-off -> ugyldigt-svar", () =>
  expect(() => extractJson({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"a":' }] })).toThrow(expect.objectContaining({ kind: "ugyldigt-svar" })));
