import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5-5";

/** Narrow seam so AI calls can be tested with a fake. */
export interface AiClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beta: { messages: { create(params: any): Promise<any> } };
}

export function createAiClient(apiKey: string): AiClient {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) as unknown as AiClient;
}

/** Shared request fields: model plus server-side refusal fallback. */
export function baseParams(): { model: string; betas: string[]; fallbacks: "default" } {
  return { model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}
