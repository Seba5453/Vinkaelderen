export type WineType = "rod" | "hvid" | "rose" | "mousserende" | "hedvin" | "dessert" | "andet";
export const WINE_TYPES: readonly WineType[] = ["rod", "hvid", "rose", "mousserende", "hedvin", "dessert", "andet"];
export type Confidence = "hoj" | "middel" | "lav";

/** What the AI returns and the user confirms. */
export interface WineInfo {
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  type: WineType;
  grapes: string[];
  notes: string;
  pairings: string[];
  drinkFrom: number | null;
  drinkTo: number | null;
  aiScore: number | null;
  aiConfidence: Confidence | null;
}

export interface Wine extends WineInfo {
  id: string;
  photoId: string | null;
  quantity: number;
  createdAt: string;
}

export interface Purchase { id: string; wineId: string; date: string; bottles: number; pricePerBottle: number | null; }
export interface DrinkLog { id: string; wineId: string; date: string; ownRating: number | null; note: string; }
export interface Photo { id: string; blob: Blob; }
export type DrinkStatus = "gem" | "klar" | "drik-snart" | "ukendt";
