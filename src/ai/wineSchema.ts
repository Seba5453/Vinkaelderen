import { z } from "zod";
import { WINE_TYPES, type WineInfo } from "../domain/types";

/** Shape sent to the API as JSON schema: no numeric bounds (structured outputs may reject them). */
const WireSchema = z.strictObject({
  name: z.string().describe("Vinens navn som på etiketten. Tom streng hvis det ikke er en vinflaske."),
  producer: z.string().nullable(),
  vintage: z.number().int().nullable().describe("Årgang, null hvis uden årgang (NV) eller ukendt."),
  region: z.string().nullable(),
  country: z.string().nullable().describe("Land på dansk."),
  type: z.enum(WINE_TYPES as [WineInfo["type"], ...WineInfo["type"][]]).describe(
    "rod=rødvin, hvid=hvidvin, rose=rosé, mousserende, hedvin=portvin/sherry/madeira, dessert=dessertvin, andet",
  ),
  grapes: z.array(z.string()),
  notes: z.string().describe("Smagsnoter på dansk, 1-3 sætninger."),
  pairings: z.array(z.string()).describe("Retter der passer til, på dansk."),
  drinkFrom: z.number().int().nullable(),
  drinkTo: z.number().int().nullable(),
  aiScore: z.number().nullable().describe("Dit eget kvalitetsestimat 0-5. Ikke en anmeldelse."),
  aiConfidence: z.enum(["hoj", "middel", "lav"]).nullable(),
});

/** Validation applied to what comes back, including bounds. */
export const WineInfoSchema = WireSchema.superRefine((w, ctx) => {
  if (w.aiScore != null && (w.aiScore < 0 || w.aiScore > 5)) ctx.addIssue({ code: "custom", message: "aiScore 0-5" });
  if (w.vintage != null && (w.vintage < 1800 || w.vintage > 2100)) ctx.addIssue({ code: "custom", message: "vintage" });
  if (w.drinkFrom != null && w.drinkTo != null && w.drinkFrom > w.drinkTo) ctx.addIssue({ code: "custom", message: "window" });
}) as unknown as z.ZodType<WineInfo>;

/** Removes $schema and numeric bounds, which structured outputs may not accept. */
export function toApiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "minimum" || k === "maximum" || k === "exclusiveMinimum" || k === "exclusiveMaximum") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export const wineInfoJsonSchema: Record<string, unknown> = toApiJsonSchema(WireSchema);
