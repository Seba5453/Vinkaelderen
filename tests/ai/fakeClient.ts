import type { AiClient } from "../../src/ai/client";

export type FakeClient = AiClient & { calls: any[] };

/** Fake that returns queued responses (or throws queued errors) in order. */
export function fakeClient(...responses: Array<unknown | Error>): FakeClient {
  const queue = [...responses];
  const calls: any[] = [];
  return {
    calls,
    beta: { messages: { create: async (params: any) => {
      calls.push(params);
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    } } },
  };
}

export const okResponse = (body: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(body) }] });
