import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { da } from "../../i18n/da";
import { db } from "../../db/db";
import { adjustQuantity, listWines } from "../../db/repo";
import { queryCellar, type CellarQuery, type SortKey } from "../../domain/cellar";
import { WINE_TYPES, type DrinkStatus, type Wine } from "../../domain/types";
import { drinkStatus } from "../../domain/status";
import { StatusBadge, WineThumb, vintageLabel } from "./WineBits";

const REMINDER_DAYS = 30;
const t = da.cellar;

function BackupReminder() {
  const show = useLiveQuery(async () => {
    if ((await db.wines.count()) === 0) return false;
    const last = (await db.settings.get("lastBackupAt"))?.value as string | undefined;
    return !last || Date.now() - Date.parse(last) > REMINDER_DAYS * 864e5;
  }, [], false);
  if (!show) return null;
  return (
    <div role="status" className="banner">
      <span>{t.backupReminder}</span> <Link to="/indstillinger">{t.backupNow}</Link>
    </div>
  );
}

function Overview({ inStock, status, onToggle }: { inStock: Wine[]; status?: DrinkStatus; onToggle(s: DrinkStatus): void }) {
  const year = new Date().getFullYear();
  const count = (s: DrinkStatus) => inStock.filter((w) => drinkStatus(w, year) === s).length;
  const items = ([["drik-snart", count("drik-snart"), t.soonCount], ["klar", count("klar"), t.readyCount]] as const).filter(([, n]) => n > 0);
  if (items.length === 0) return null;
  return (
    <div role="group" aria-label={t.overview} className="overview">
      {items.map(([s, n, label]) => (
        <button key={s} className={`overview-item status-${s}`} aria-pressed={status === s} onClick={() => onToggle(s)}>{label(n)}</button>
      ))}
    </div>
  );
}

function WineRow({ wine }: { wine: Wine }) {
  return (
    <li className="wine-row">
      <WineThumb photoId={wine.photoId} />
      <Link to={`/vin/${wine.id}`}>
        <div className="name">{wine.name} {vintageLabel(wine.vintage)}</div>
        <div className="muted">{da.typeLabels[wine.type]} · × {wine.quantity}</div>
        <StatusBadge wine={wine} />
      </Link>
      <div className="stepper">
        <button aria-label={t.minus} disabled={wine.quantity <= 0} onClick={() => adjustQuantity(wine.id, -1)}>−</button>
        <button aria-label={t.plus} onClick={() => adjustQuantity(wine.id, 1)}>+</button>
      </div>
    </li>
  );
}

export default function CellarPage() {
  const [q, setQ] = useState<CellarQuery>({ search: "", type: "alle", sort: "drink-first", includeEmpty: false });
  const wines = useLiveQuery(listWines);
  if (!wines) return <section className="page"><h1>{da.appName}</h1></section>;

  const inStock = wines.filter((w) => w.quantity > 0);
  // A status filter only applies while that status still has in-stock wines;
  // otherwise its button is gone and the list would stay empty with no way back.
  const year = new Date().getFullYear();
  const status = q.status && inStock.some((w) => drinkStatus(w, year) === q.status) ? q.status : undefined;
  const shown = queryCellar(wines, { ...q, status, year });
  const bottles = inStock.reduce((n, w) => n + w.quantity, 0);

  return (
    <section className="page">
      <h1>{da.appName}</h1>
      <BackupReminder />
      {inStock.length > 0 && <p className="muted">{t.totals(bottles, inStock.length)}</p>}
      <Overview inStock={inStock} status={status} onToggle={(s) => setQ({ ...q, status: status === s ? undefined : s })} />

      <input aria-label={t.search} placeholder={t.search} type="search" value={q.search}
        onChange={(e) => setQ({ ...q, search: e.target.value })} />
      <div className="chips">
        {(["alle", ...WINE_TYPES] as const).map((ty) => (
          <button key={ty} className="chip" aria-pressed={q.type === ty} onClick={() => setQ({ ...q, type: ty })}>
            {ty === "alle" ? t.all : da.typeLabels[ty]}
          </button>
        ))}
      </div>
      <div className="row">
        <label htmlFor="sort">{t.sort}</label>
        <select id="sort" className="grow" value={q.sort} onChange={(e) => setQ({ ...q, sort: e.target.value as SortKey })}>
          {(Object.keys(da.sortLabels) as SortKey[]).map((k) => <option key={k} value={k}>{da.sortLabels[k]}</option>)}
        </select>
        <label className="row"><input type="checkbox" style={{ width: "auto" }} checked={q.includeEmpty}
          onChange={(e) => setQ({ ...q, includeEmpty: e.target.checked })} />{t.showEmpty}</label>
      </div>

      {shown.length > 0 ? (
        <ul className="wine-list">{shown.map((w) => <WineRow key={w.id} wine={w} />)}</ul>
      ) : inStock.length === 0 && !q.includeEmpty ? (
        <div className="card">
          <p>{t.empty}</p>
          <Link to="/tilfoej">{t.addFirst}</Link>
        </div>
      ) : (
        <p className="muted">{t.noMatch}</p>
      )}
    </section>
  );
}
