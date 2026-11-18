# WineCellar ("Min Vinkælder") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Danish, phone-first PWA where one person scans wine labels with AI, keeps an on-device cellar with purchases and drink log, sees drink/hold status, and asks an AI sommelier what to open from what's in stock.

**Architecture:** Client-only React app. All data (wines, purchases, drink log, photos, settings incl. API key) lives in IndexedDB via Dexie. The browser calls the Claude API directly with the owner's key. Pure domain logic (status, sorting, duplicates, merging) is isolated in `src/domain` and `src/features/*/logic` files so it is unit-testable; AI calls go through an injectable client interface so they are testable without network.

**Tech Stack:** Vite + React 18 + TypeScript, react-router-dom (HashRouter), Dexie, zod (v4), @anthropic-ai/sdk, vite-plugin-pwa, Vitest + @testing-library/react + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-18-winecellar-design.md`

## Global Constraints

- All UI text in Danish, all strings in `src/i18n/da.ts` (no hard-coded UI copy in components).
- AI-generated text (notes, pairings, answers) in Danish; wine names as on the label.
- Main screen title: "Min Vinkælder". Save button: "Gem i Min Vinkælder". Add screen title: "Tilføj vin". Ask screen: "Spørg".
- Model: `claude-sonnet-5-5`, via `client.beta.messages.create` with `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, `output_config.format` (JSON schema) and `output_config.effort: "medium"`. Never send `thinking: {type: "disabled"}`, `temperature`, or forced `tool_choice`.
- Client created with `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`.
- Always check `stop_reason === "refusal"` before reading content.
- Images downscaled on-device to max 1568 px long edge, JPEG quality 0.8, before sending.
- Currency DKK, shown as "kr.". Scores 0–5, one decimal for AI score; own rating whole numbers 0–5.
- AI score always labelled "AI-vurdering"; never called a review.
- Nothing AI-produced is saved without the user seeing it on the confirm screen.
- No backend, no accounts, no sync, no web search, no shelf location.
- Must work in iOS Safari and Android Chrome; HTTPS hosting (GitHub Pages).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Non-vintage wines (NV port, champagne):** `vintage: null` must work everywhere — status, duplicate matching (NV only matches NV), AI lookup, display ("NV"). Tests in Tasks 2 and 9.
2. **AI can't identify the bottle** (blurry photo, not a wine label, obscure wine): scan returns low confidence / null fields, the user lands on an editable form and can type everything by hand; an AI error must never block saving. Tests in Tasks 6 and 9.
3. **AI recommends a bottle that isn't in stock or doesn't exist** (hallucinated id, quantity 0): it is dropped silently, never shown. Test in Task 7.
4. **Quantity can't go negative:** "Drak en flaske" or "−" at 0 leaves 0 and logs nothing extra. Test in Task 3.
5. **Restoring a bad backup** (wrong file, older/newer format, truncated JSON): rejected with a Danish error and existing data left untouched. Test in Task 4.

---

## File Structure

```
index.html
vite.config.ts                  # React + PWA plugin, base for GitHub Pages, vitest config
src/main.tsx                    # mounts <App/>
src/App.tsx                     # HashRouter, routes, bottom nav
src/i18n/da.ts                  # all Danish strings + type labels
src/domain/types.ts             # Wine, Purchase, DrinkLog, Photo, WineType, WineInfo
src/domain/status.ts            # drinkStatus
src/domain/cellar.ts            # filter/sort, duplicate finding, latest price/rating
src/db/db.ts                    # Dexie schema
src/db/repo.ts                  # all reads/writes
src/db/backup.ts                # export/import
src/ai/client.ts                # AiClient interface, createAiClient
src/ai/errors.ts                # AiError + mapping
src/ai/image.ts                 # fitWithin, downscaleImage
src/ai/wineSchema.ts            # zod schema for WineInfo + JSON schema
src/ai/scan.ts                  # identifyFromPhoto, lookupByText
src/ai/ask.ts                   # askSommelier, toCellarContext
src/ai/useApiKey.ts             # hook reading the stored API key
src/features/add/merge.ts       # mergeLookup, needsRelookup
src/features/add/AddWinePage.tsx
src/features/add/ConfirmForm.tsx
src/features/cellar/CellarPage.tsx
src/features/cellar/WineDetailPage.tsx
src/features/cellar/DrinkDialog.tsx
src/features/ask/AskPage.tsx
src/features/settings/SettingsPage.tsx
src/styles.css
tests/...                       # mirrors src/
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `tests/setup.ts`, `tests/smoke.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: `npm test` (= `vitest run`), `npm run build`, `npm run dev`; test env jsdom with `fake-indexeddb/auto` and `@testing-library/jest-dom` loaded from `tests/setup.ts`.

- [ ] **Step 1:** `git init` in the project root; scaffold with `npm create vite@latest . -- --template react-ts` (keep existing `docs/`). Install: `dexie zod @anthropic-ai/sdk react-router-dom`; dev: `vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb vite-plugin-pwa`. Add `"test": "vitest run"`. `.gitignore` includes `node_modules`, `dist`, `.env*`.
- [ ] **Step 2: Write the failing smoke test** `tests/smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "../src/App";
test("shows Min Vinkælder", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Min Vinkælder" })).toBeInTheDocument();
});
```

- [ ] **Step 3:** Run `npm test` — expect FAIL (heading missing).
- [ ] **Step 4:** Make `App.tsx` render `<h1>Min Vinkælder</h1>`; set `<html lang="da">`, mobile viewport meta, title "Min Vinkælder".
- [ ] **Step 5:** Run `npm test` and `npm run build` — expect PASS / build succeeds.
- [ ] **Step 6:** Commit `chore: scaffold WineCellar app`.

---

### Task 2: Domain types, drink status, cellar logic

**Files:**
- Create: `src/domain/types.ts`, `src/domain/status.ts`, `src/domain/cellar.ts`
- Test: `tests/domain/status.test.ts`, `tests/domain/cellar.test.ts`

**Interfaces:**
- Produces:
```ts
export type WineType = "rod" | "hvid" | "rose" | "mousserende" | "hedvin" | "dessert" | "andet";
export type Confidence = "hoj" | "middel" | "lav";
export interface WineInfo {           // what the AI returns / user confirms
  name: string; producer: string | null; vintage: number | null;
  region: string | null; country: string | null; type: WineType;
  grapes: string[]; notes: string; pairings: string[];
  drinkFrom: number | null; drinkTo: number | null;
  aiScore: number | null; aiConfidence: Confidence | null;
}
export interface Wine extends WineInfo { id: string; photoId: string | null; quantity: number; createdAt: string; }
export interface Purchase { id: string; wineId: string; date: string; bottles: number; pricePerBottle: number | null; }
export interface DrinkLog { id: string; wineId: string; date: string; ownRating: number | null; note: string; }
export interface Photo { id: string; blob: Blob; }
export type DrinkStatus = "gem" | "klar" | "drik-snart" | "ukendt";

// status.ts
export function drinkStatus(w: Pick<Wine, "drinkFrom" | "drinkTo">, year: number): DrinkStatus;
// cellar.ts
export type SortKey = "drink-first" | "name" | "vintage" | "score";
export interface CellarQuery { search: string; type: WineType | "alle"; sort: SortKey; includeEmpty: boolean; }
export function queryCellar(wines: Wine[], q: CellarQuery): Wine[];
export function findDuplicate(wines: Wine[], info: Pick<WineInfo, "name" | "producer" | "vintage">): Wine | undefined;
export function latestPrice(purchases: Purchase[]): number | null;
export function latestOwnRating(logs: DrinkLog[]): number | null;
```

- [ ] **Step 1: Write failing tests** `tests/domain/status.test.ts`:

```ts
test("before window is gem", () => expect(drinkStatus({ drinkFrom: 2028, drinkTo: 2035 }, 2026)).toBe("gem"));
test("inside window is klar", () => expect(drinkStatus({ drinkFrom: 2024, drinkTo: 2030 }, 2026)).toBe("klar"));
test("last year of window is drik-snart", () => expect(drinkStatus({ drinkFrom: 2020, drinkTo: 2026 }, 2026)).toBe("drik-snart"));
test("past window is drik-snart", () => expect(drinkStatus({ drinkFrom: 2015, drinkTo: 2022 }, 2026)).toBe("drik-snart"));
test("no window is ukendt", () => expect(drinkStatus({ drinkFrom: null, drinkTo: null }, 2026)).toBe("ukendt"));
test("only drinkTo known", () => expect(drinkStatus({ drinkFrom: null, drinkTo: 2030 }, 2026)).toBe("klar"));
```

`tests/domain/cellar.test.ts` (use a `wine(overrides)` factory):

```ts
test("search matches name, producer, region, grapes case-insensitively", ...);   // "musar" finds Château Musar
test("type filter", ...);                                                        // type "hedvin" returns only ports
test("includeEmpty=false hides quantity 0", ...);
test("drink-first sorts by drinkTo ascending, null last", ...);
test("score sorts descending, null last", ...);
test("findDuplicate matches name+producer+vintage ignoring case/whitespace", ...);
test("findDuplicate: NV only matches NV", () => {
  const nv = wine({ name: "Vintage Port", producer: "Taylor's", vintage: null });
  expect(findDuplicate([nv], { name: "Vintage Port", producer: "Taylor's", vintage: 2017 })).toBeUndefined();
  expect(findDuplicate([nv], { name: "vintage port ", producer: "taylor's", vintage: null })).toBe(nv);
});
test("latestPrice takes most recent purchase with a price", ...);  // [{2025-01, 200}, {2026-03, 250}, {2026-05, null}] -> 250
test("latestOwnRating takes most recent rated log", ...);
```

- [ ] **Step 2:** Run `npx vitest run tests/domain` — FAIL (modules missing).
- [ ] **Step 3:** Implement the signatures above. `drinkStatus` rule: `year >= drinkTo` → drik-snart; `drinkFrom != null && year < drinkFrom` → gem; any window field known → klar; else ukendt. Normalise strings for duplicate match with `trim().toLowerCase()`.
- [ ] **Step 4:** Run `npx vitest run tests/domain` — PASS.
- [ ] **Step 5:** Commit `feat: domain types, drink status and cellar queries`.

---

### Task 3: Database and repository

**Files:**
- Create: `src/db/db.ts`, `src/db/repo.ts`
- Test: `tests/db/repo.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
```ts
// db.ts: Dexie "winecellar" v1, tables wines(id), purchases(id, wineId), drinks(id, wineId), photos(id), settings(key)
export const db: WineCellarDB;
// repo.ts
export async function addWine(info: WineInfo, opts: { photo: Blob | null; bottles: number; pricePerBottle: number | null; date?: string }): Promise<Wine>;
export async function addPurchase(wineId: string, bottles: number, pricePerBottle: number | null, date?: string): Promise<void>; // quantity += bottles
export async function adjustQuantity(wineId: string, delta: number): Promise<number>;     // correction only, clamped at 0, no purchase row
export async function logDrink(wineId: string, ownRating: number | null, note: string): Promise<boolean>; // false if quantity was 0
export async function updateWineInfo(wineId: string, info: Partial<WineInfo>): Promise<void>;
export async function listWines(): Promise<Wine[]>;
export async function getWineDetail(id: string): Promise<{ wine: Wine; purchases: Purchase[]; drinks: DrinkLog[]; photoUrl: string | null } | undefined>;
export async function getSetting<T>(key: SettingKey): Promise<T | undefined>;
export async function setSetting<T>(key: SettingKey, value: T): Promise<void>;
export type SettingKey = "apiKey" | "lastBackupAt";
```
Ids via `crypto.randomUUID()`. Dates as ISO strings; `date` defaults to today.

- [ ] **Step 1: Write failing tests** (reset db in `beforeEach` with `db.delete(); db.open()`):

```ts
test("addWine stores wine, photo and first purchase; quantity = bottles", ...); // bottles 3, price 200 -> quantity 3, 1 purchase
test("addPurchase records separate purchase and adds to quantity", ...);        // +2 at 250 -> quantity 5, 2 purchases
test("adjustQuantity clamps at 0 and creates no purchase", async () => {
  const w = await addWine(info, { photo: null, bottles: 1, pricePerBottle: null });
  expect(await adjustQuantity(w.id, -3)).toBe(0);
  expect((await getWineDetail(w.id))!.purchases).toHaveLength(1);
});
test("logDrink decrements and records rating", ...);                           // quantity 1 -> 0, log with rating 4
test("logDrink at 0 returns false and logs nothing", ...);
test("settings round-trip", ...);
```

- [ ] **Step 2:** Run `npx vitest run tests/db/repo.test.ts` — FAIL.
- [ ] **Step 3:** Implement; multi-table writes in `db.transaction("rw", ...)`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: IndexedDB storage for wines, purchases and drink log`.

---

### Task 4: Backup export / import

**Files:**
- Create: `src/db/backup.ts`
- Test: `tests/db/backup.test.ts`

**Interfaces:**
- Consumes: `db`, `setSetting` (Task 3).
- Produces:
```ts
export const BACKUP_FORMAT = "winecellar-backup";
export const BACKUP_VERSION = 1;
export async function exportBackup(): Promise<Blob>;       // JSON: {format, version, exportedAt, wines, purchases, drinks, settings(without apiKey), photos:[{id, dataUrl}]}; sets lastBackupAt
export async function importBackup(file: Blob): Promise<{ wines: number }>; // validates fully, then replaces all tables in one transaction; throws BackupError
export class BackupError extends Error { constructor(public kind: "ugyldig-fil" | "forkert-version") }
export function backupFileName(date: Date): string;       // "min-vinkaelder-2026-11-18.json"
```
The API key is never written to the backup.

- [ ] **Step 1: Write failing tests:**

```ts
test("export then import restores wines, purchases, drinks and photos", ...);
test("export excludes apiKey", ...);
test("garbage file throws ugyldig-fil and keeps existing data", async () => {
  await addWine(info, { photo: null, bottles: 2, pricePerBottle: null });
  await expect(importBackup(new Blob(["{not json"]))).rejects.toMatchObject({ kind: "ugyldig-fil" });
  expect(await listWines()).toHaveLength(1);
});
test("valid JSON with wrong format/shape throws ugyldig-fil, data kept", ...);
test("newer version throws forkert-version, data kept", ...);   // version 2
test("backupFileName", () => expect(backupFileName(new Date("2026-11-18"))).toBe("min-vinkaelder-2026-11-18.json"));
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement; validate with a zod schema before touching tables; photos as data URLs via `FileReader` and back via `fetch(dataUrl).then(r => r.blob())`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: backup export and restore`.

---

### Task 5: AI client, errors, image downscale

**Files:**
- Create: `src/ai/client.ts`, `src/ai/errors.ts`, `src/ai/image.ts`
- Test: `tests/ai/errors.test.ts`, `tests/ai/image.test.ts`

**Interfaces:**
- Produces:
```ts
// client.ts
export const MODEL = "claude-sonnet-5-5";
export interface AiClient { beta: { messages: { create(params: any): Promise<any> } } }  // narrow seam for tests
export function createAiClient(apiKey: string): AiClient;   // new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
export function baseParams(): { model: string; betas: string[]; fallbacks: "default" };
// errors.ts
export type AiErrorKind = "ingen-noegle" | "ugyldig-noegle" | "for-mange" | "netvaerk" | "afvist" | "ugyldigt-svar" | "ukendt";
export class AiError extends Error { constructor(public kind: AiErrorKind, cause?: unknown) }
export function toAiError(e: unknown): AiError;
export function extractJson(response: any): unknown;   // throws AiError("afvist") on refusal, ("ugyldigt-svar") if no parseable text
// image.ts
export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number };
export async function downscaleImage(file: Blob, maxEdge?: number /*1568*/, quality?: number /*0.8*/): Promise<{ blob: Blob; base64: string; mediaType: "image/jpeg" }>;
```

- [ ] **Step 1: Write failing tests:**

```ts
// errors.test.ts — construct SDK errors via the SDK's exported classes (Anthropic.AuthenticationError etc.)
test("401 -> ugyldig-noegle", ...);
test("429 -> for-mange", ...);
test("connection error -> netvaerk", ...);
test("refusal stop_reason -> afvist", () =>
  expect(() => extractJson({ stop_reason: "refusal", content: [] })).toThrow(expect.objectContaining({ kind: "afvist" })));
test("extracts JSON from first text block", () =>
  expect(extractJson({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"a":1}' }] })).toEqual({ a: 1 }));
test("non-JSON text -> ugyldigt-svar", ...);
// image.test.ts
test("landscape fits", () => expect(fitWithin(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 }));
test("portrait fits", () => expect(fitWithin(3024, 4032, 1568)).toEqual({ width: 1176, height: 1568 }));
test("small image unchanged", () => expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 }));
```

- [ ] **Step 2:** Run `npx vitest run tests/ai` — FAIL.
- [ ] **Step 3:** Implement. `downscaleImage` uses `createImageBitmap` + canvas `toBlob("image/jpeg", quality)` (handles EXIF orientation via `imageOrientation: "from-image"`); not unit-tested (no canvas in jsdom) — covered by manual check in Task 12.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: AI client seam, error mapping, image downscale`.

---

### Task 6: Wine identification and re-lookup

**Files:**
- Create: `src/ai/wineSchema.ts`, `src/ai/scan.ts`
- Test: `tests/ai/scan.test.ts`

**Interfaces:**
- Consumes: `AiClient`, `baseParams`, `extractJson`, `toAiError` (Task 5); `WineInfo` (Task 2).
- Produces:
```ts
export const WineInfoSchema: z.ZodType<WineInfo>;   // aiScore 0..5, vintage 1800..2100 or null
export const wineInfoJsonSchema: object;            // z.toJSONSchema(WineInfoSchema), additionalProperties false
export async function identifyFromPhoto(client: AiClient, image: { base64: string; mediaType: "image/jpeg" }): Promise<WineInfo>;
export async function lookupByText(client: AiClient, q: { name: string; producer: string | null; vintage: number | null }): Promise<WineInfo>;
```
Request: `client.beta.messages.create({ ...baseParams(), max_tokens: 8000, output_config: { effort: "medium", format: { type: "json_schema", schema: wineInfoJsonSchema } }, system: SCAN_SYSTEM, messages })`. Image block first, then text. `SCAN_SYSTEM` (Danish output instructions) must say: write notes and pairings in Danish; keep the wine name as on the label; estimate drinking window from vintage/style; aiScore is your own quality estimate 0–5 from producer reputation, region, vintage, style — not a review; if unsure set aiConfidence "lav" and leave unknown fields null rather than guessing; if the image is not a wine bottle, return name "" and aiConfidence "lav". If the API rejects a schema keyword (e.g. min/max), remove that constraint from the JSON schema only and keep it in zod.

- [ ] **Step 1: Write failing tests** with a fake client recording `create` params:

```ts
test("sends image + Danish system prompt with model and fallbacks", async () => {
  const client = fakeClient(okResponse(sampleInfo));
  await identifyFromPhoto(client, { base64: "AAA", mediaType: "image/jpeg" });
  const p = client.calls[0];
  expect(p.model).toBe("claude-sonnet-5-5");
  expect(p.fallbacks).toBe("default");
  expect(p.betas).toContain("server-side-fallback-2026-07-01");
  expect(p.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAA" } });
  expect(p.thinking).toBeUndefined();
});
test("returns parsed WineInfo", ...);
test("NV wine: vintage null accepted", ...);
test("low-confidence result with nulls is returned, not thrown", ...);   // {name:"", aiConfidence:"lav", ...nulls}
test("aiScore 7 -> ugyldigt-svar", ...);
test("lookupByText sends no image and includes name/producer/vintage text", ...);
test("SDK error is mapped to AiError", ...);
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: identify wine from photo and re-lookup by text`.

---

### Task 7: Sommelier ("Spørg")

**Files:**
- Create: `src/ai/ask.ts`
- Test: `tests/ai/ask.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `latestPrice`, `latestOwnRating`; Task 5 seam.
- Produces:
```ts
export interface CellarItemForAi { id: string; name: string; producer: string | null; vintage: number | null; type: WineType; grapes: string[];
  drinkFrom: number | null; drinkTo: number | null; aiScore: number | null; ownRating: number | null; quantity: number; pricePerBottle: number | null; }
export function toCellarContext(wines: Wine[], purchases: Purchase[], drinks: DrinkLog[]): CellarItemForAi[]; // in-stock only
export interface Recommendation { wineId: string; reason: string; }
export interface SommelierAnswer { intro: string; recommendations: Recommendation[]; }
export interface ChatTurn { role: "user" | "assistant"; text: string; }  // assistant text = JSON of SommelierAnswer
export async function askSommelier(client: AiClient, cellar: CellarItemForAi[], history: ChatTurn[], question: string, year: number): Promise<SommelierAnswer>;
```
Cellar JSON and current year go in `system` (stable across follow-ups); history + new question in `messages`. Recommendations are in the order to drink them. System prompt: answer in Danish; recommend only ids from the list; consider drink status, price (special vs everyday) and own ratings; order matters ("først … senere …"); if nothing fits, say so with empty recommendations.

- [ ] **Step 1: Write failing tests:**

```ts
test("toCellarContext excludes quantity 0 and uses latest price/rating", ...);
test("cellar and year are in system, question in last user message", ...);
test("follow-up resends earlier turns in order", ...);
test("drops recommendations for unknown ids and out-of-stock ids", async () => {
  const client = fakeClient(okResponse({ intro: "x", recommendations: [{ wineId: "a", reason: "r" }, { wineId: "ghost", reason: "r" }] }));
  const ans = await askSommelier(client, [item({ id: "a" })], [], "Hvad skal vi drikke?", 2026);
  expect(ans.recommendations.map(r => r.wineId)).toEqual(["a"]);
});
test("preserves recommendation order", ...);
test("empty cellar still asks and returns AI intro", ...);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: sommelier recommendations from in-stock cellar`.

---

### Task 8: App shell, Danish strings, Settings

**Files:**
- Create: `src/i18n/da.ts`, `src/ai/useApiKey.ts`, `src/features/settings/SettingsPage.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `tests/features/settings.test.tsx`, `tests/app.test.tsx`

**Interfaces:**
- Consumes: `getSetting/setSetting` (Task 3), `exportBackup/importBackup/backupFileName/BackupError` (Task 4).
- Produces: `export const da = {...} as const` incl. `typeLabels: Record<WineType, string>` = Rødvin, Hvidvin, Rosé, Mousserende, Hedvin (portvin m.m.), Dessertvin, Andet; `statusLabels: Record<DrinkStatus, string>` = Gem, Klar, Drik snart, Ukendt; `aiErrors: Record<AiErrorKind, string>`; `backupErrors`. Routes (HashRouter): `/` CellarPage, `/vin/:id` WineDetailPage, `/tilfoej` AddWinePage, `/spoerg` AskPage, `/indstillinger` SettingsPage (pages from later tasks start as placeholders here). Bottom nav: "Min Vinkælder", "Tilføj vin", "Spørg", "Indstillinger". `export function useApiKey(): string | undefined` hook in `src/ai/useApiKey.ts` (live-reads the `apiKey` setting).

Settings page: API key field (password input, "Gem nøgle"), short Danish help text on getting a key at console.anthropic.com and setting a monthly spend limit (e.g. $5); "Sikkerhedskopi" section with "Gem sikkerhedskopi" (downloads `backupFileName(today)`) and "Gendan fra fil" (file input; confirm text before replacing; shows Danish error on BackupError); shows "Sidste sikkerhedskopi: <dato>" or "Aldrig".

- [ ] **Step 1: Write failing tests:**

```tsx
test("nav shows four Danish tabs", ...);
test("saving API key stores it", ...);
test("shows Aldrig when no backup made", ...);
test("bad restore file shows Danish error", ...);
test("backup reminder banner on cellar page when lastBackupAt older than 30 days and cellar not empty", ...);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: app shell, Danish strings and settings`.

---

### Task 9: Add wine — scan, confirm, re-lookup, duplicates

**Files:**
- Create: `src/features/add/merge.ts`, `src/features/add/AddWinePage.tsx`, `src/features/add/ConfirmForm.tsx`
- Test: `tests/features/merge.test.ts`, `tests/features/addWine.test.tsx`

**Interfaces:**
- Consumes: `downscaleImage`, `identifyFromPhoto`, `lookupByText`, `createAiClient`, `AiError` (Tasks 5–6); `addWine`, `addPurchase`, `listWines` (Task 3); `findDuplicate` (Task 2); `da`, `useApiKey` (Task 8).
- Produces:
```ts
export type WineField = keyof WineInfo;
export function needsRelookup(lastAi: Pick<WineInfo,"name"|"producer"|"vintage"> | null, current: WineInfo): boolean; // name/producer/vintage changed vs AI answer (normalised)
export function mergeLookup(current: WineInfo, touched: ReadonlySet<WineField>, fresh: WineInfo): WineInfo; // untouched fields <- fresh; touched kept
```
AddWinePage accepts an optional `client?: AiClient` prop for tests.

Flow:
1. Big button "Tag billede" → `<input type="file" accept="image/*" capture="environment">`; also "Indtast manuelt" (skips AI).
2. While identifying: "Finder vinen…". On AiError: show `da.aiErrors[kind]` and open the empty form (photo kept). No API key: message linking to Indstillinger + manual form.
3. ConfirmForm: heading "Er det den rigtige vin?"; editable name, producer, vintage (blank = NV), region, country, type (select), grapes (comma-separated), notes, pairings, drinkFrom, drinkTo; read-only "AI-vurdering x,x / 5" and a "Usikker" hint when aiConfidence is "lav"; quantity stepper (min 1, default 1); "Pris pr. flaske" (kr., optional). Track touched fields.
4. On "Gem i Min Vinkælder": if `needsRelookup` → call `lookupByText`, apply `mergeLookup`, show "Oplysningerne er opdateret – tjek dem igen" and stay on the form (user must press save again). Else if `findDuplicate` hits → dialog "Du har allerede denne vin (n flasker). Tilføj som nyt køb?" with "Tilføj til eksisterende" (→ `addPurchase`) / "Gem som ny vin". Else `addWine`.
5. After save: "Gemt!" with "Scan næste flaske" (resets to step 1) and "Se vinen" (→ `/vin/:id`).

- [ ] **Step 1: Write failing tests** `merge.test.ts`:

```ts
test("no relookup when only price/type changed", ...);
test("relookup when vintage changed 2016 -> 2019", ...);
test("relookup when vintage cleared to NV", ...);
test("mergeLookup keeps touched grapes, refreshes untouched window/score/notes", () => {
  const merged = mergeLookup({ ...a, vintage: 2019, grapes: ["Syrah"] }, new Set(["vintage", "grapes"]), { ...fresh, vintage: 2019, grapes: ["Cabernet"], drinkTo: 2040 });
  expect(merged.grapes).toEqual(["Syrah"]);
  expect(merged.drinkTo).toBe(2040);
});
```

`addWine.test.tsx` (fake client, fake-indexeddb; mock `downscaleImage`):

```tsx
test("scan fills form; nothing saved until Gem pressed", ...);
test("changing vintage then Gem triggers lookup, shows updated form, second Gem saves", ...);
test("AI error shows Danish message and empty editable form; manual save works", ...);
test("duplicate prompts and adds purchase to existing wine", ...);
test("NV entry saves with vintage null", ...);
test("Scan næste flaske resets the page", ...);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add wine via scan with confirm and re-lookup`.

---

### Task 10: Min Vinkælder list and wine detail

**Files:**
- Create: `src/features/cellar/CellarPage.tsx`, `src/features/cellar/WineDetailPage.tsx`, `src/features/cellar/DrinkDialog.tsx`
- Test: `tests/features/cellar.test.tsx`, `tests/features/wineDetail.test.tsx`

**Interfaces:**
- Consumes: `listWines`, `getWineDetail`, `adjustQuantity`, `addPurchase`, `logDrink` (Task 3); `queryCellar`, `drinkStatus`, `latestOwnRating` (Task 2); `da` (Task 8).
- Produces: `DrinkDialog` props `{ wineName: string; onConfirm(rating: number | null, note: string): void; onCancel(): void }` (reused by Task 11).

CellarPage: search box, type filter chips ("Alle" + types), sort select (default "drink-first": "Drik først", "Navn", "Årgang", "AI-vurdering"), toggle "Vis tomme"; rows show photo thumbnail, name, vintage or "NV", type, "× n", status badge; +/− buttons. Empty state: "Din vinkælder er tom" + button to Tilføj vin. Totals line: "n flasker · m vine".

WineDetailPage: photo, all fields, status badge with window "Drikkes 2026–2034", "AI-vurdering x,x / 5", "Din vurdering" (latest own rating or "–"), notes, pairings, "Køb" list (date, bottles, kr. each), "Drukket" list (date, rating, note); buttons "Drak en flaske" (opens DrinkDialog, disabled at 0), "Køb flere" (bottles + price form → addPurchase), "Ret oplysninger" (inline edit via `updateWineInfo`, no AI call).

- [ ] **Step 1: Write failing tests:**

```tsx
test("default sort is drink-first and shows status badges", ...);
test("search and type filter narrow the list", ...);
test("empty wines hidden unless Vis tomme", ...);
test("minus at 0 stays 0", ...);
test("Drak en flaske with rating 4 decrements and appears under Drukket", ...);
test("Køb flere adds a purchase row with price", ...);
test("NV wine displays NV", ...);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: cellar list and wine detail`.

---

### Task 11: Spørg page

**Files:**
- Create: `src/features/ask/AskPage.tsx`
- Test: `tests/features/ask.test.tsx`

**Interfaces:**
- Consumes: `askSommelier`, `toCellarContext`, `ChatTurn` (Task 7); repo reads + `logDrink` (Task 3); `DrinkDialog` (Task 10); `useApiKey`, `da` (Task 8). Optional `client?: AiClient` prop for tests.

Behaviour: text area with placeholder "Fx: I aften kommer mine forældre til middag – hvilken rødvin skal vi starte med, og hvilken portvin senere?"; "Spørg" button; answer shows intro and numbered bottle cards (photo, name, vintage, status, reason) linking to `/vin/:id`, each with "Åbn denne" (DrinkDialog → logDrink). Follow-ups append to in-memory history; "Ny samtale" clears. History is component state only (not persisted). While waiting: "Tænker…". AiError → Danish message, question text kept. No key → link to Indstillinger.

- [ ] **Step 1: Write failing tests:**

```tsx
test("asks and renders ordered bottle cards", ...);
test("follow-up sends previous turns", ...);
test("Ny samtale clears history", ...);
test("Åbn denne logs a drink", ...);
test("leaving and returning starts empty (not persisted)", ...);
test("AI error keeps the typed question", ...);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: ask the sommelier`.

---

### Task 12: PWA, deploy, manual phone check

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `README.md`, `.github/workflows/deploy.yml`

- [ ] **Step 1:** Configure `vite-plugin-pwa` (`registerType: "autoUpdate"`, manifest `name`/`short_name` "Min Vinkælder", `lang: "da"`, `display: "standalone"`, theme colour a deep wine red, icons). Set Vite `base` to `"./"` so it works under a GitHub Pages sub-path. Add `apple-touch-icon` and `apple-mobile-web-app-capable` meta.
- [ ] **Step 2:** GitHub Actions workflow: on push to `main`, `npm ci && npm test && npm run build`, deploy `dist` to GitHub Pages.
- [ ] **Step 3:** README (Danish): what it is, how to install to home screen on iPhone/Android, how to get an API key and set a spend limit, that data lives only on the phone and to take backups.
- [ ] **Step 4:** Run `npm test` and `npm run build` — all PASS, build succeeds.
- [ ] **Step 5: Manual check on a phone** (via `npm run dev -- --host` over HTTPS or the deployed URL): install to home screen; scan a real label (check photo orientation and that the request image is ≤1568 px); correct the vintage and confirm re-lookup; add 2 more bottles via duplicate prompt; drink one with rating; ask the parents-dinner question and get a red then a port from stock; export backup, clear site data, restore. Record results in the PR/commit message.
- [ ] **Step 6:** Commit `feat: installable PWA and GitHub Pages deploy`.
