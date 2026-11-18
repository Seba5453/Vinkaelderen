import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams } from "react-router-dom";
import { da, formatDate, formatKr, formatScore } from "../../i18n/da";
import { addPurchase, getWineDetail, logDrink, updateWineInfo } from "../../db/repo";
import { latestOwnRating } from "../../domain/cellar";
import type { Wine } from "../../domain/types";
import ConfirmForm, { fromForm, toForm, type FormState } from "../add/ConfirmForm";
import DrinkDialog from "./DrinkDialog";
import { StatusBadge, vintageLabel } from "./WineBits";
import { useObjectUrl } from "./useObjectUrl";

const t = da.detail;

export default function WineDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useLiveQuery(() => getWineDetail(id).then((d) => d ?? null), [id]);
  const photoUrl = useObjectUrl(detail?.photo);
  const [drinking, setDrinking] = useState(false);
  const [buying, setBuying] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);

  if (detail === undefined) return <section className="page" />;
  if (detail === null) return <section className="page"><p>{t.notFound}</p></section>;
  const { wine, purchases, drinks } = detail;
  const own = latestOwnRating(drinks);
  const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} style={{ alignSelf: "flex-start" }}>← {t.back}</button>
      {photoUrl && <img className="hero" src={photoUrl} alt="" />}
      <h1>{wine.name} {vintageLabel(wine.vintage)}</h1>
      <div className="row"><StatusBadge wine={wine} /><span>{t.window(wine.drinkFrom, wine.drinkTo)}</span><span className="muted">× {wine.quantity}</span></div>

      <div className="row">
        <div className="card grow"><span className="muted">{t.aiScore}</span><strong>{wine.aiScore != null ? `${formatScore(wine.aiScore)} / 5` : da.common.none}</strong></div>
        <div className="card grow"><span className="muted">{t.ownRating}</span><strong>{own != null ? `${own} / 5` : da.common.none}</strong></div>
      </div>

      <div className="row">
        <button className="primary grow" disabled={wine.quantity <= 0} onClick={() => setDrinking(true)}>{t.drankOne}</button>
        <button className="grow" onClick={() => setBuying(true)}>{t.buyMore}</button>
      </div>
      {buying && <BuyMore wineId={wine.id} onDone={() => setBuying(false)} />}

      {editing ? (
        <EditWine wine={wine} form={editing} setForm={setEditing} />
      ) : (
        <>
          <Facts wine={wine} />
          <button onClick={() => setEditing(toForm(wine))}>{t.edit}</button>
        </>
      )}

      <div className="card">
        <h2>{t.purchases}</h2>
        <ul className="log">{byDate(purchases).map((p) => (
          <li key={p.id}>{formatDate(p.date)}: {p.pricePerBottle != null ? `${p.bottles} × ${formatKr(p.pricePerBottle)}` : `${p.bottles} fl.`}</li>
        ))}</ul>
      </div>
      {drinks.length > 0 && (
        <div className="card">
          <h2>{t.drinks}</h2>
          <ul className="log">{byDate(drinks).map((d) => (
            <li key={d.id}>{formatDate(d.date)}{d.ownRating != null && ` · ★ ${d.ownRating}`}{d.note && ` · ${d.note}`}</li>
          ))}</ul>
        </div>
      )}

      {drinking && (
        <DrinkDialog wineName={wine.name} onCancel={() => setDrinking(false)}
          onConfirm={async (rating, note) => { await logDrink(wine.id, rating, note); setDrinking(false); }} />
      )}
    </section>
  );
}

function EditWine({ wine, form, setForm }: { wine: Wine; form: FormState; setForm(f: FormState | null): void }) {
  return (
    <>
      <ConfirmForm title={t.edit} form={form} onChange={(_, f) => setForm(f)} />
      <div className="row">
        <button className="primary grow" onClick={async () => { await updateWineInfo(wine.id, fromForm(form)); setForm(null); }}>{da.common.save}</button>
        <button onClick={() => setForm(null)}>{da.common.cancel}</button>
      </div>
    </>
  );
}

function Facts({ wine }: { wine: Wine }) {
  const rows: Array<[string, string | null]> = [
    [t.producer, wine.producer], [t.region, wine.region], [t.country, wine.country],
    [t.grapes, wine.grapes.join(", ") || null], [t.notes, wine.notes || null], [t.pairings, wine.pairings.join(", ") || null],
  ];
  return (
    <div className="card">
      <dl className="facts">
        <dt>Type</dt><dd>{da.typeLabels[wine.type]}</dd>
        {rows.filter(([, v]) => v).map(([k, v]) => <FactRow key={k} k={k} v={v!} />)}
      </dl>
    </div>
  );
}

const FactRow = ({ k, v }: { k: string; v: string }) => <><dt>{k}</dt><dd>{v}</dd></>;

function BuyMore({ wineId, onDone }: { wineId: string; onDone(): void }) {
  const [bottles, setBottles] = useState("1");
  const [price, setPrice] = useState("");
  const n = Number.parseInt(bottles, 10);
  const p = Number.parseFloat(price.replace(",", "."));
  return (
    <div className="card">
      <label htmlFor="buy-n">{t.bottles}</label>
      <input id="buy-n" inputMode="numeric" value={bottles} onChange={(e) => setBottles(e.target.value)} />
      <label htmlFor="buy-p">{t.price}</label>
      <input id="buy-p" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="row">
        <button className="primary grow" disabled={!(n > 0)}
          onClick={async () => { await addPurchase(wineId, n, Number.isFinite(p) && p >= 0 ? p : null); onDone(); }}>{t.addPurchase}</button>
        <button onClick={onDone}>{da.common.cancel}</button>
      </div>
    </div>
  );
}
