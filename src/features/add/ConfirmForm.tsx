import { da, formatScore } from "../../i18n/da";
import { WINE_TYPES, type WineInfo, type WineType } from "../../domain/types";
import type { WineField } from "./merge";

/** Editable text representation of a WineInfo. */
export interface FormState {
  name: string; producer: string; vintage: string; region: string; country: string; type: WineType;
  grapes: string; notes: string; pairings: string; drinkFrom: string; drinkTo: string;
  aiScore: number | null; aiConfidence: WineInfo["aiConfidence"];
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const int = (s: string) => { const n = Number.parseInt(s.trim(), 10); return Number.isFinite(n) ? n : null; };
const text = (s: string) => s.trim() || null;

export function toForm(w: WineInfo): FormState {
  const n = (v: number | null) => (v == null ? "" : String(v));
  return {
    name: w.name, producer: w.producer ?? "", vintage: n(w.vintage), region: w.region ?? "", country: w.country ?? "",
    type: w.type, grapes: w.grapes.join(", "), notes: w.notes, pairings: w.pairings.join(", "),
    drinkFrom: n(w.drinkFrom), drinkTo: n(w.drinkTo), aiScore: w.aiScore, aiConfidence: w.aiConfidence,
  };
}

export function fromForm(f: FormState): WineInfo {
  return {
    name: f.name.trim(), producer: text(f.producer), vintage: int(f.vintage), region: text(f.region), country: text(f.country),
    type: f.type, grapes: list(f.grapes), notes: f.notes.trim(), pairings: list(f.pairings),
    drinkFrom: int(f.drinkFrom), drinkTo: int(f.drinkTo), aiScore: f.aiScore, aiConfidence: f.aiConfidence,
  };
}

export const emptyForm = (): FormState => toForm({
  name: "", producer: null, vintage: null, region: null, country: null, type: "rod", grapes: [], notes: "", pairings: [],
  drinkFrom: null, drinkTo: null, aiScore: null, aiConfidence: null,
});

const f = da.add.fields;
type TextField = Exclude<keyof FormState, "type" | "aiScore" | "aiConfidence">;
const FIELDS: Array<{ key: TextField; label: string; numeric?: boolean; multiline?: boolean }> = [
  { key: "name", label: f.name }, { key: "producer", label: f.producer }, { key: "vintage", label: f.vintage, numeric: true },
  { key: "region", label: f.region }, { key: "country", label: f.country }, { key: "grapes", label: f.grapes },
  { key: "notes", label: f.notes, multiline: true }, { key: "pairings", label: f.pairings },
  { key: "drinkFrom", label: f.drinkFrom, numeric: true }, { key: "drinkTo", label: f.drinkTo, numeric: true },
];

interface Props {
  form: FormState;
  onChange(field: WineField, form: FormState): void;
  title?: string;
  /** Quantity and price are shown only when these handlers are given (not when editing an existing wine). */
  quantity?: number;
  onQuantity?(n: number): void;
  price?: string;
  onPrice?(s: string): void;
}

export default function ConfirmForm({ form, onChange, title = da.add.confirmTitle, quantity = 1, onQuantity, price = "", onPrice }: Props) {
  const set = <K extends keyof FormState>(k: K & WineField, v: FormState[K]) => onChange(k, { ...form, [k]: v });
  return (
    <div className="card">
      <h2>{title}</h2>
      {form.aiConfidence === "lav" && <p className="banner">{da.add.unsure}</p>}
      {form.aiScore != null && <p>{da.detail.aiScore}: {formatScore(form.aiScore)} / 5</p>}
      {FIELDS.slice(0, 5).map(renderField)}
      <label htmlFor="f-type">{f.type}</label>
      <select id="f-type" value={form.type} onChange={(e) => set("type", e.target.value as WineType)}>
        {WINE_TYPES.map((t) => <option key={t} value={t}>{da.typeLabels[t]}</option>)}
      </select>
      {FIELDS.slice(5).map(renderField)}

      {onQuantity && (
        <>
          <span className="muted">{f.quantity}</span>
          <div className="stepper">
            <button type="button" aria-label={da.cellar.minus} onClick={() => onQuantity(Math.max(1, quantity - 1))}>−</button>
            <strong aria-live="polite">{quantity}</strong>
            <button type="button" aria-label={da.cellar.plus} onClick={() => onQuantity(quantity + 1)}>+</button>
          </div>
        </>
      )}
      {onPrice && (
        <>
          <label htmlFor="f-price">{f.price}</label>
          <input id="f-price" inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value)} />
        </>
      )}
    </div>
  );

  function renderField(d: (typeof FIELDS)[number]) {
    const id = `f-${d.key}`;
    return (
      <div key={d.key} style={{ display: "contents" }}>
        <label htmlFor={id}>{d.label}</label>
        {d.multiline
          ? <textarea id={id} value={form[d.key]} onChange={(e) => set(d.key, e.target.value)} />
          : <input id={id} inputMode={d.numeric ? "numeric" : undefined} value={form[d.key]} onChange={(e) => set(d.key, e.target.value)} />}
      </div>
    );
  }
}
