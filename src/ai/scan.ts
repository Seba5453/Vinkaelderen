import { baseParams, type AiClient } from "./client";
import { AiError, extractJson, toAiError } from "./errors";
import { WineInfoSchema, wineInfoJsonSchema } from "./wineSchema";
import type { WineInfo } from "../domain/types";

export { WineInfoSchema, wineInfoJsonSchema };

const SCAN_SYSTEM = `Du er en erfaren sommelier, der hjælper en privatperson med at registrere vine i sin vinkælder.
Svar altid med JSON efter det givne skema. Skriv smagsnoter, madforslag og land på dansk; behold vinens navn og producent som på etiketten.
- Anslå et drikkevindue (drinkFrom-drinkTo, årstal) ud fra producent, område, stil og årgang.
- aiScore er dit eget kvalitetsestimat fra 0 til 5 (én decimal) baseret på producentens omdømme, området, årgangens kvalitet og stilen. Det er ikke en anmeldelse.
- Hvis du er usikker, så sæt aiConfidence til "lav" og lad ukendte felter være null i stedet for at gætte.
- Hvis billedet ikke viser en vinflaske eller etiket, så returnér name "" og aiConfidence "lav".`;

async function call(client: AiClient, content: unknown[]): Promise<WineInfo> {
  let response: unknown;
  try {
    response = await client.beta.messages.create({
      ...baseParams(),
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: wineInfoJsonSchema } },
      system: SCAN_SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    throw toAiError(e);
  }
  const parsed = WineInfoSchema.safeParse(extractJson(response as never));
  if (!parsed.success) throw new AiError("ugyldigt-svar", parsed.error);
  return parsed.data;
}

export function identifyFromPhoto(client: AiClient, image: { base64: string; mediaType: "image/jpeg" }): Promise<WineInfo> {
  return call(client, [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
    { type: "text", text: "Identificér vinen på billedet og udfyld oplysningerne." },
  ]);
}

export function lookupByText(
  client: AiClient,
  q: { name: string; producer: string | null; vintage: number | null },
): Promise<WineInfo> {
  const parts = [`Vin: ${q.name}`];
  if (q.producer) parts.push(`Producent: ${q.producer}`);
  parts.push(q.vintage != null ? `Årgang: ${q.vintage}` : "Uden årgang (NV)");
  return call(client, [{ type: "text", text: `${parts.join("\n")}\n\nUdfyld oplysningerne for præcis denne vin og årgang.` }]);
}
