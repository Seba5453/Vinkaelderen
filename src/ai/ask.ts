import { z } from "zod";
import { baseParams, type AiClient } from "./client";
import { AiError, extractJson, toAiError } from "./errors";
import { toApiJsonSchema } from "./wineSchema";
import { latestOwnRating, latestPrice } from "../domain/cellar";
import type { DrinkLog, Purchase, Wine, WineType } from "../domain/types";

export interface CellarItemForAi {
  id: string; name: string; producer: string | null; vintage: number | null; type: WineType; grapes: string[];
  drinkFrom: number | null; drinkTo: number | null; aiScore: number | null; ownRating: number | null;
  quantity: number; pricePerBottle: number | null;
}
export interface Recommendation { wineId: string; reason: string; }
export interface SommelierAnswer { intro: string; recommendations: Recommendation[]; }
/** Assistant text is the JSON of a SommelierAnswer. */
export interface ChatTurn { role: "user" | "assistant"; text: string; }

const AnswerSchema = z.strictObject({
  intro: z.string().describe("Kort svar på dansk."),
  recommendations: z.array(z.strictObject({
    wineId: z.string().describe("id fra kælderlisten"),
    reason: z.string().describe("Kort begrundelse på dansk."),
  })).describe("I den rækkefølge flaskerne skal drikkes."),
});
const answerJsonSchema = toApiJsonSchema(AnswerSchema);

export function toCellarContext(wines: Wine[], purchases: Purchase[], drinks: DrinkLog[]): CellarItemForAi[] {
  return wines
    .filter((w) => w.quantity > 0)
    .map((w) => ({
      id: w.id, name: w.name, producer: w.producer, vintage: w.vintage, type: w.type, grapes: w.grapes,
      drinkFrom: w.drinkFrom, drinkTo: w.drinkTo, aiScore: w.aiScore,
      ownRating: latestOwnRating(drinks.filter((d) => d.wineId === w.id)),
      quantity: w.quantity,
      pricePerBottle: latestPrice(purchases.filter((p) => p.wineId === w.id)),
    }));
}

function systemPrompt(cellar: CellarItemForAi[], year: number): string {
  return `Du er en venlig og erfaren sommelier for en privatperson. Det er år ${year}.
Anbefal KUN vine fra kælderlisten herunder (brug deres id). Svar på dansk, kort og konkret.
- Tag hensyn til drikkevinduet (drinkFrom-drinkTo), pris pr. flaske (hverdagsvin vs. særlig flaske), aiScore og ejerens egne vurderinger (ownRating 0-5).
- Rækkefølgen i recommendations er rækkefølgen flaskerne skal drikkes i (fx først en rødvin til maden, senere en portvin).
- Hvis intet passer, så sig det i intro og returnér en tom liste.

Kælderliste (JSON):
${JSON.stringify(cellar)}`;
}

export async function askSommelier(
  client: AiClient,
  cellar: CellarItemForAi[],
  history: ChatTurn[],
  question: string,
  year: number,
): Promise<SommelierAnswer> {
  let response: unknown;
  try {
    response = await client.beta.messages.create({
      ...baseParams(),
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: answerJsonSchema } },
      system: systemPrompt(cellar, year),
      messages: [...history.map((t) => ({ role: t.role, content: t.text })), { role: "user", content: question }],
    });
  } catch (e) {
    throw toAiError(e);
  }
  const parsed = AnswerSchema.safeParse(extractJson(response as never));
  if (!parsed.success) throw new AiError("ugyldigt-svar", parsed.error);
  const inStock = new Set(cellar.filter((c) => c.quantity > 0).map((c) => c.id));
  return { intro: parsed.data.intro, recommendations: parsed.data.recommendations.filter((r) => inStock.has(r.wineId)) };
}
