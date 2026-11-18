import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { da } from "../../i18n/da";
import { createAiClient, type AiClient } from "../../ai/client";
import { useApiKey } from "../../ai/useApiKey";
import { downscaleImage } from "../../ai/image";
import { identifyFromPhoto, lookupByText } from "../../ai/scan";
import { AiError, toAiError } from "../../ai/errors";
import { addPurchase, addWine, listWines } from "../../db/repo";
import { findDuplicate } from "../../domain/cellar";
import type { Wine, WineInfo } from "../../domain/types";
import ConfirmForm, { emptyForm, fromForm, toForm, type FormState } from "./ConfirmForm";
import { mergeLookup, needsRelookup, type WineField } from "./merge";

type Step = "start" | "busy" | "form" | "duplicate" | "saved";
type Identity = Pick<WineInfo, "name" | "producer" | "vintage">;

const parsePrice = (s: string) => { const n = Number.parseFloat(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };

export default function AddWinePage({ client: injected }: { client?: AiClient }) {
  const apiKey = useApiKey();
  const client = useMemo(() => injected ?? (apiKey ? createAiClient(apiKey) : null), [injected, apiKey]);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("start");
  const [busyText, setBusyText] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState<Set<WineField>>(new Set());
  const [lastAi, setLastAi] = useState<Identity | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Wine | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function reset() {
    setStep("start"); setPhoto(null); setForm(emptyForm()); setTouched(new Set()); setLastAi(null);
    setQuantity(1); setPrice(""); setNotice(null); setError(null); setDuplicate(null); setSavedId(null);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusyText(da.add.identifying);
    setStep("busy");
    let image: Awaited<ReturnType<typeof downscaleImage>>;
    try {
      image = await downscaleImage(file);
    } catch {
      setPhoto(file); setStep("form"); setError(da.aiErrors.ukendt); return;
    }
    setPhoto(image.blob);
    if (!client) { setError(da.aiErrors["ingen-noegle"]); setStep("form"); return; }
    try {
      const found = await identifyFromPhoto(client, image);
      setForm(toForm(found));
      setLastAi(found.name ? { name: found.name, producer: found.producer, vintage: found.vintage } : null);
    } catch (e) {
      setError(da.aiErrors[toAiError(e).kind]);
    }
    setStep("form");
  }

  function onChange(field: WineField, next: FormState) {
    setForm(next);
    setTouched((t) => new Set(t).add(field));
    setNotice(null);
  }

  async function onSave() {
    const current = fromForm(form);
    setError(null);
    if (!current.name) { setError(da.add.nameRequired); return; }

    if (client && needsRelookup(lastAi, current)) {
      setBusyText(da.add.lookingUp);
      setStep("busy");
      try {
        const merged = mergeLookup(current, touched, await lookupByText(client, current));
        setForm(toForm(merged));
        setNotice(da.add.relookedUp);
      } catch (e) {
        setError(da.aiErrors[(e instanceof AiError ? e : toAiError(e)).kind]);
      }
      // Either way the confirmed identity is now the current one, so the next save goes through.
      setLastAi({ name: current.name, producer: current.producer, vintage: current.vintage });
      setStep("form");
      return;
    }

    const dup = findDuplicate(await listWines(), current);
    if (dup) { setDuplicate(dup); setStep("duplicate"); return; }
    await saveNew(current);
  }

  async function saveNew(current: WineInfo) {
    const w = await addWine(current, { photo, bottles: quantity, pricePerBottle: parsePrice(price) });
    setSavedId(w.id); setStep("saved");
  }

  async function addToExisting() {
    if (!duplicate) return;
    await addPurchase(duplicate.id, quantity, parsePrice(price));
    setSavedId(duplicate.id); setStep("saved");
  }

  return (
    <section className="page">
      <h1>{da.add.title}</h1>

      {step === "start" && (
        <div className="card">
          <label htmlFor="camera" className="cta">📷 {da.add.takePhoto}</label>
          <input id="camera" aria-label={da.add.takePhoto} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => onPhoto(e.target.files?.[0])} />
          <button onClick={() => setStep("form")}>{da.add.manual}</button>
          {!client && apiKey !== undefined && <p className="muted"><Link to="/indstillinger">{da.aiErrors["ingen-noegle"]}</Link></p>}
        </div>
      )}

      {step === "busy" && <p className="card" aria-busy="true">{busyText}</p>}

      {(step === "form" || step === "duplicate") && (
        <>
          {photo && <PhotoPreview blob={photo} />}
          {error && <p role="alert">{error}</p>}
          {notice && <p className="banner">{notice}</p>}
          <ConfirmForm form={form} onChange={onChange} quantity={quantity} onQuantity={setQuantity} price={price} onPrice={setPrice} />
          {step === "form" && <button className="primary big" onClick={onSave}>{da.add.saveButton}</button>}
          {step === "duplicate" && duplicate && (
            <div className="confirm">
              <p>{da.add.duplicate(duplicate.quantity)}</p>
              <button className="primary" onClick={addToExisting}>{da.add.addToExisting}</button>
              <button onClick={() => saveNew(fromForm(form))}>{da.add.saveAsNew}</button>
            </div>
          )}
        </>
      )}

      {step === "saved" && (
        <div className="card">
          <h2>{da.add.saved}</h2>
          <button className="primary big" onClick={reset}>{da.add.scanNext}</button>
          {savedId && <button onClick={() => navigate(`/vin/${savedId}`)}>{da.add.seeWine}</button>}
        </div>
      )}
    </section>
  );
}

function PhotoPreview({ blob }: { blob: Blob }) {
  const url = useMemo(() => (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null), [blob]);
  return url ? <img className="hero" src={url} alt="" /> : null;
}
