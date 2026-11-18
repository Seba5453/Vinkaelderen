import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { da } from "../../i18n/da";
import { createAiClient, type AiClient } from "../../ai/client";
import { useApiKey } from "../../ai/useApiKey";
import { askSommelier, toCellarContext, type ChatTurn, type SommelierAnswer } from "../../ai/ask";
import { toAiError } from "../../ai/errors";
import { listDrinks, listPurchases, listWines, logDrink } from "../../db/repo";
import type { Wine } from "../../domain/types";
import DrinkDialog from "../cellar/DrinkDialog";
import { StatusBadge, WineThumb, vintageLabel } from "../cellar/WineBits";

const t = da.ask;
interface Exchange { question: string; answer: SommelierAnswer; }

export default function AskPage({ client: injected }: { client?: AiClient }) {
  const apiKey = useApiKey();
  const client = useMemo(() => injected ?? (apiKey ? createAiClient(apiKey) : null), [injected, apiKey]);
  const wines = useLiveQuery(listWines, [], [] as Wine[]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<Wine | null>(null);

  async function send(text: string = question, keepTyped = false) {
    const q = text.trim();
    if (!q || !client) return;
    setBusy(true);
    setError(null);
    try {
      const [all, purchases, drinks] = await Promise.all([listWines(), listPurchases(), listDrinks()]);
      const history: ChatTurn[] = exchanges.flatMap((x) => [
        { role: "user" as const, text: x.question },
        { role: "assistant" as const, text: JSON.stringify(x.answer) },
      ]);
      const answer = await askSommelier(client, toCellarContext(all, purchases, drinks), history, q, new Date().getFullYear());
      setExchanges((xs) => [...xs, { question: q, answer }]);
      if (!keepTyped) setQuestion("");
    } catch (e) {
      setError(da.aiErrors[toAiError(e).kind]);
    } finally {
      setBusy(false);
    }
  }

  const byId = new Map(wines.map((w) => [w.id, w]));

  return (
    <section className="page">
      <div className="row">
        <h1 className="grow">{t.title}</h1>
        {exchanges.length > 0 && <button onClick={() => { setExchanges([]); setError(null); }}>{t.newChat}</button>}
      </div>

      {exchanges.map((x, i) => (
        <div key={i} className="page">
          <p className="chat-q">{x.question}</p>
          <div className="card">
            <p style={{ margin: 0 }}>{x.answer.intro}</p>
          </div>
          {x.answer.recommendations.map((r, n) => {
            const w = byId.get(r.wineId);
            if (!w) return null;
            return (
              <article key={r.wineId + n} className="card rec">
                <span className="num">{n + 1}</span>
                <div className="page" style={{ gap: 6 }}>
                  <div className="row">
                    <WineThumb photoId={w.photoId} />
                    <Link to={`/vin/${w.id}`} className="grow"><strong>{w.name} {vintageLabel(w.vintage)}</strong></Link>
                    <StatusBadge wine={w} />
                  </div>
                  <p style={{ margin: 0 }}>{r.reason}</p>
                  <button disabled={w.quantity <= 0} onClick={() => setOpening(w)}>{t.openThis}</button>
                </div>
              </article>
            );
          })}
          {x.answer.shoppingList.length > 0 && (
            <section aria-label={t.shoppingTitle} className="card">
              <h2>{t.shoppingTitle}</h2>
              <ul className="log">{x.answer.shoppingList.map((s, n) => (
                <li key={n}><strong>{s.suggestion}</strong><br /><span className="muted">{s.reason}</span></li>
              ))}</ul>
            </section>
          )}
        </div>
      ))}

      {!client && apiKey !== undefined && <p className="banner"><Link to="/indstillinger">{t.noKey}</Link></p>}
      {error && <p role="alert">{error}</p>}
      {busy && <p className="muted" aria-busy="true">{t.thinking}</p>}

      <div className="card">
        <label htmlFor="ask-q">{t.question}</label>
        <textarea id="ask-q" placeholder={t.placeholder} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button className="primary" disabled={busy || !question.trim() || !client} onClick={() => send()}>{t.send}</button>
        <button disabled={busy || !client || !wines.some((w) => w.quantity > 0)} onClick={() => send(t.missingQuestion, true)}>{t.missing}</button>
      </div>

      {opening && (
        <DrinkDialog wineName={opening.name} onCancel={() => setOpening(null)}
          onConfirm={async (rating, note) => {
            try { await logDrink(opening.id, rating, note); } catch { setError(da.common.saveError); }
            setOpening(null);
          }} />
      )}
    </section>
  );
}
