import type { WineInfo } from "../../domain/types";

export type WineField = keyof WineInfo;
type Identity = Pick<WineInfo, "name" | "producer" | "vintage">;

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

/** True when the user changed which wine this is (name, producer or vintage) since the AI's last answer. */
export function needsRelookup(lastAi: Identity | null, current: WineInfo): boolean {
  if (!lastAi) return false;
  return norm(lastAi.name) !== norm(current.name) || norm(lastAi.producer) !== norm(current.producer) || lastAi.vintage !== current.vintage;
}

const IDENTITY: readonly WineField[] = ["name", "producer", "vintage"];

/** Fields the user edited by hand, and the wine's identity (name, producer, vintage), always win;
 *  everything else takes the fresh AI answer. */
export function mergeLookup(current: WineInfo, touched: ReadonlySet<WineField>, fresh: WineInfo): WineInfo {
  const out = { ...fresh } as Record<WineField, unknown>;
  for (const f of [...touched, ...IDENTITY]) out[f] = current[f];
  return out as unknown as WineInfo;
}
