import { useState } from "react";
import { da } from "../../i18n/da";

interface Props { wineName: string; onConfirm(rating: number | null, note: string): void; onCancel(): void; }

export default function DrinkDialog({ wineName, onConfirm, onCancel }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const title = da.drink.title(wineName);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <span className="muted">{da.drink.rating}</span>
        <div className="stars">
          <button type="button" aria-pressed={rating === null} onClick={() => setRating(null)}>{da.drink.noRating}</button>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={rating === n} onClick={() => setRating(n)}>{n}</button>
          ))}
        </div>
        <label htmlFor="drink-note">{da.drink.note}</label>
        <textarea id="drink-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row">
          <button className="primary grow" onClick={() => onConfirm(rating, note.trim())}>{da.drink.confirm}</button>
          <button onClick={onCancel}>{da.common.cancel}</button>
        </div>
      </div>
    </div>
  );
}
