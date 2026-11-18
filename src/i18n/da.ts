import type { DrinkStatus, WineType } from "../domain/types";
import type { AiErrorKind } from "../ai/errors";
import type { SortKey } from "../domain/cellar";

export const da = {
  appName: "Min Vinkælder",
  nav: { cellar: "Min Vinkælder", add: "Tilføj vin", ask: "Spørg", settings: "Indstillinger" },

  typeLabels: {
    rod: "Rødvin", hvid: "Hvidvin", rose: "Rosé", mousserende: "Mousserende",
    hedvin: "Hedvin (portvin m.m.)", dessert: "Dessertvin", andet: "Andet",
  } satisfies Record<WineType, string>,
  statusLabels: { gem: "Gem", klar: "Klar", "drik-snart": "Drik snart", ukendt: "Ukendt" } satisfies Record<DrinkStatus, string>,
  sortLabels: { "drink-first": "Drik først", name: "Navn", vintage: "Årgang", score: "AI-vurdering" } satisfies Record<SortKey, string>,

  aiErrors: {
    "ingen-noegle": "Du mangler en API-nøgle. Tilføj den under Indstillinger.",
    "ugyldig-noegle": "API-nøglen virker ikke. Tjek den under Indstillinger.",
    "for-mange": "AI'en er travl lige nu. Prøv igen om lidt.",
    netvaerk: "Ingen forbindelse. Tjek internettet og prøv igen.",
    afvist: "AI'en kunne ikke besvare den forespørgsel.",
    "ugyldigt-svar": "AI'en gav et svar, der ikke kunne bruges. Prøv igen.",
    ukendt: "Noget gik galt. Prøv igen.",
  } satisfies Record<AiErrorKind, string>,

  common: { nv: "NV", kr: "kr.", cancel: "Annullér", save: "Gem", none: "–" },

  cellar: {
    search: "Søg i vinkælderen", all: "Alle", sort: "Sortér", showEmpty: "Vis tomme",
    empty: "Din vinkælder er tom", addFirst: "Tilføj din første vin",
    totals: (bottles: number, wines: number) => `${bottles} flasker · ${wines} vine`,
    backupReminder: "Det er længe siden, du har taget en sikkerhedskopi.",
    backupNow: "Tag sikkerhedskopi",
    plus: "Én flaske mere", minus: "Én flaske mindre",
  },

  detail: {
    window: (from: number | null, to: number | null) => `Drikkes ${from ?? "?"}–${to ?? "?"}`,
    aiScore: "AI-vurdering", ownRating: "Din vurdering", notes: "Smagsnoter", pairings: "Passer til",
    grapes: "Druer", region: "Område", country: "Land", producer: "Producent",
    purchases: "Køb", drinks: "Drukket", drankOne: "Drak en flaske", buyMore: "Køb flere", edit: "Ret oplysninger",
    bottles: "Antal flasker", price: "Pris pr. flaske", addPurchase: "Tilføj køb", notFound: "Vinen findes ikke",
    back: "Tilbage",
  },

  drink: { title: (name: string) => `Drak en flaske ${name}`, rating: "Din vurdering (0–5)", note: "Note", confirm: "Gem", noRating: "Ingen" },

  add: {
    title: "Tilføj vin", takePhoto: "Tag billede", manual: "Indtast manuelt", identifying: "Finder vinen…",
    confirmTitle: "Er det den rigtige vin?", unsure: "AI'en er usikker – tjek oplysningerne",
    relookedUp: "Oplysningerne er opdateret – tjek dem igen", lookingUp: "Henter oplysninger for den rettede vin…",
    saveButton: "Gem i Min Vinkælder", saved: "Gemt!", scanNext: "Scan næste flaske", seeWine: "Se vinen",
    duplicate: (n: number) => `Du har allerede denne vin (${n} flasker). Tilføj som nyt køb?`,
    addToExisting: "Tilføj til eksisterende", saveAsNew: "Gem som ny vin",
    fields: {
      name: "Navn", producer: "Producent", vintage: "Årgang (tom = NV)", region: "Område", country: "Land", type: "Type",
      grapes: "Druer (adskil med komma)", notes: "Smagsnoter", pairings: "Passer til (adskil med komma)",
      drinkFrom: "Drikkes fra (år)", drinkTo: "Drikkes til (år)", quantity: "Antal", price: "Pris pr. flaske (kr.)",
    },
    nameRequired: "Vinen skal have et navn",
  },

  ask: {
    title: "Spørg", placeholder: "Fx: I aften kommer mine forældre til middag – hvilken rødvin skal vi starte med, og hvilken portvin senere?",
    send: "Spørg", thinking: "Tænker…", newChat: "Ny samtale", openThis: "Åbn denne", noKey: "Tilføj en API-nøgle under Indstillinger for at stille spørgsmål.",
    question: "Dit spørgsmål",
  },

  settings: {
    title: "Indstillinger", apiKey: "API-nøgle", saveKey: "Gem nøgle", keySaved: "Nøglen er gemt",
    keyHelp: "Opret en nøgle på console.anthropic.com under API Keys. Sæt en månedlig udgiftsgrænse (fx 5 $), så du aldrig får en overraskelse. Nøglen gemmes kun på denne telefon.",
    backup: "Sikkerhedskopi", backupHelp: "Din vinkælder ligger kun på denne telefon. Gem en sikkerhedskopi i fx iCloud eller Google Drev.",
    exportButton: "Gem sikkerhedskopi", restore: "Gendan fra fil",
    restoreConfirm: (name: string) => `Gendan fra ${name}? Det erstatter alt i din vinkælder.`, restoreYes: "Ja, gendan",
    restored: (n: number) => `Gendannet: ${n} vine`,
    lastBackup: (d: string | null) => `Sidste sikkerhedskopi: ${d ?? "Aldrig"}`,
    backupErrors: {
      "ugyldig-fil": "Filen kunne ikke læses som en sikkerhedskopi fra Min Vinkælder. Intet er ændret.",
      "forkert-version": "Sikkerhedskopien er fra en nyere version af appen. Intet er ændret.",
    },
  },
};

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
export const formatScore = (n: number) => n.toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatKr = (n: number) => `${n.toLocaleString("da-DK")} kr.`;
