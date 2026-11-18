import { APIConnectionError, APIError } from "@anthropic-ai/sdk";

export type AiErrorKind = "ingen-noegle" | "ugyldig-noegle" | "for-mange" | "netvaerk" | "afvist" | "ugyldigt-svar" | "ukendt";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, cause?: unknown) {
    super(kind, { cause });
    this.name = "AiError";
    this.kind = kind;
  }
}

export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof APIConnectionError) return new AiError("netvaerk", e);
  if (e instanceof APIError) {
    if (e.status === 401 || e.status === 403) return new AiError("ugyldig-noegle", e);
    if (e.status === 429 || e.status === 529) return new AiError("for-mange", e);
    return new AiError("ukendt", e);
  }
  if (e instanceof TypeError) return new AiError("netvaerk", e); // fetch failures in browsers
  return new AiError("ukendt", e);
}

interface ResponseLike { stop_reason?: string | null; content?: Array<{ type: string; text?: string; [k: string]: unknown }> }

/** Returns the parsed JSON body of a structured-output response. Checks refusal first. */
export function extractJson(response: ResponseLike): unknown {
  if (response.stop_reason === "refusal") throw new AiError("afvist");
  const text = response.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new AiError("ugyldigt-svar");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new AiError("ugyldigt-svar", e);
  }
}
