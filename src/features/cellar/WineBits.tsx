import { useLiveQuery } from "dexie-react-hooks";
import { da } from "../../i18n/da";
import { getPhoto } from "../../db/repo";
import { drinkStatus } from "../../domain/status";
import type { Wine } from "../../domain/types";
import { useObjectUrl } from "./useObjectUrl";

export const vintageLabel = (v: number | null) => (v == null ? da.common.nv : String(v));

export function StatusBadge({ wine }: { wine: Pick<Wine, "drinkFrom" | "drinkTo"> }) {
  const s = drinkStatus(wine, new Date().getFullYear());
  return <span className={`badge ${s}`}>{da.statusLabels[s]}</span>;
}

export function WineThumb({ photoId }: { photoId: string | null }) {
  const blob = useLiveQuery(() => (photoId ? getPhoto(photoId) : Promise.resolve(undefined)), [photoId]);
  const url = useObjectUrl(blob);
  return url ? <img className="thumb" src={url} alt="" /> : <div className="thumb" aria-hidden>🍷</div>;
}
