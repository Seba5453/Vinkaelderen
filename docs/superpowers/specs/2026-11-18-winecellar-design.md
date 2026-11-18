# WineCellar ("Min Vinkælder") — Design

Date: 2026-11-18
Status: Draft for approval (updated after builder check)

## 1. Intent

A personal wine-cellar app for one person, used on their phone. They photograph
bottle labels to build an inventory of what they own, see whether each wine
should be opened now or aged further, and ask in plain language what to open
for a meal or an evening ("tonight my parents are coming for dinner; which red
first, and which port later when the night gets late?"). Answers must come only
from bottles actually in stock.

The owner wants Vivino-style richness (identification, grapes, notes, score,
pairings) without Vivino (no public API) and with low running costs.

## 2. Goals

- Add a bottle by photographing its label; AI identifies it and fills details.
- User confirms/corrects every AI-filled field before saving.
- Track quantity and price paid; each purchase recorded separately (date,
  bottles, price per bottle); adjust quantity anytime.
- Show a drinking window and a status badge per wine (Hold / Ready / Drink soon).
- Free-text "what should we drink" assistant that recommends from in-stock bottles.
- Danish UI and Danish AI-generated text.
- Very low cost: a few cents per new wine, ~1–3 cents per question.

## 3. Non-goals

- No user accounts, no multi-user, no sharing.
- No sync between devices (phone is the primary and only device).
- No app-store / native app.
- No web-sourced reviews or community ratings.
- No shelf/rack location tracking.
- No price tracking / market values.
- No English UI for now (but keep strings in one place so it can be added later).

## 4. Anti-goals (would make it a failure even if it "works")

- Inventing reviews or presenting AI's score as other people's opinion.
- Saving AI guesses without the user seeing and confirming them.
- Re-paying the AI for a wine already known (e.g. adding another bottle of the same wine).
- Losing the cellar with no way to recover it.
- Recommending bottles the user doesn't have (or has 0 of).

## 5. Constraints

- Runs in the phone browser (iOS Safari and Android Chrome); installable to home
  screen (PWA). Camera access requires HTTPS hosting.
- No backend. Data lives on the phone.
- AI: Anthropic Claude API, model `claude-sonnet-5-5` (owner's choice after
  seeing cost comparison), called directly from the browser
  (`dangerouslyAllowBrowser` / direct browser access).
- The owner supplies their own API key in Settings; stored on the device only.
  Recommend the owner sets a monthly spend cap (e.g. $5) in their Anthropic console.
- Currency: DKK.

## 6. Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **A. Client-only PWA**, data + key on device, browser calls Claude directly, free static hosting | Simplest, free hosting, offline cellar browsing. Key is on the phone (acceptable for personal use, mitigated with spend cap). | **Chosen** by owner |
| B. PWA + small serverless proxy holding the key | Key never on phone; easier to share later. Needs auth on the proxy or anyone can spend the owner's money; more to maintain. | Rejected: overhead without current benefit |
| C. Native iOS/Android app | App store accounts, yearly fee (iOS), much more work; no capability the web lacks here. | Rejected |
| Vivino / unofficial APIs | No public API; scraping breaks ToS and can stop working anytime. | Rejected |
| Free barcode + Open Food Facts | Free but spotty wine coverage, no notes, older bottles lack barcodes. | Rejected in favour of AI |

## 7. Features (as decided with the owner)

### 7.1 Scan & confirm ("Tilføj vin")
1. User takes a photo (or picks one from the gallery).
2. Photo is downscaled on-device before sending (cost + speed) and stored locally
   as the bottle's picture.
3. One AI call returns structured data: name, producer, vintage, region, country,
   type (rødvin, hvidvin, rosé, mousserende, hedvin/portvin, dessertvin, …),
   grapes, tasting notes (Danish), food pairings (Danish), drinking window
   (from–to year), AI score 0–5, and a confidence indicator.
4. Confirm screen shows every field editable, plus quantity stepper and
   price-per-bottle (kr.). Nothing is saved until "Gem i Min Vinkælder".
5. If the user changes **name or vintage**, the app re-asks the AI for the
   corrected wine (text-only, cheaper) so drinking window, score and notes
   match. Changing quantity/price/type etc. does not trigger a new lookup.
   *(Assistant's call)* Fields the user has edited by hand on this screen are
   kept; only untouched fields are refreshed from the new answer. The confirm
   screen therefore tracks which fields the user touched.
6. If the wine (same producer+name+vintage) already exists, offer to add the
   bottles to the existing entry as a new purchase instead of creating a
   duplicate (no AI cost beyond the initial identification).
7. Owner has ~50 bottles and no existing list, so one-at-a-time scanning is
   the onboarding path; no import. *(Assistant's call)* After saving, offer
   "Scan næste flaske" to go straight to the camera for the next bottle.

### 7.2 Min Vinkælder (main screen)
- List of wines with photo, name, vintage, type, quantity, status badge.
- Search and filter by type; sort by "drink first" (closest to end of window),
  name, vintage, score.
- Quantity +/- directly from list/detail.
- Wine detail: all fields, notes, pairings, AI score, own rating, purchases
  (date, bottles, price each), drink log.
- "Køb flere" (bought more): adds a purchase (date, bottles, price per bottle).
  Plain +/- on quantity is for corrections and is not a purchase.
- "Drak en flaske" (drank one): decrements quantity and lets the user add their
  own rating (0–5) and a note. Wines at 0 stay in history, hidden from the main
  list by default.

### 7.3 Drink or hold
- Status from drinking window vs current year:
  - **Gem** (Hold): before window start.
  - **Klar** (Ready): inside window.
  - **Drik snart** (Drink soon): last year of window or past it.
- Exact thresholds are the builder's call within that intent.

### 7.4 Spørg (ask)
- Free-text input in Danish (or any language; reply in Danish).
- App sends the in-stock cellar (compact list: id, name, vintage, type, grapes,
  window, AI score, own rating, quantity, price per bottle) plus the question.
  Price lets the AI tell everyday bottles from special ones ("something cheaper").
- Follow-up questions are allowed within one conversation ("noget billigere?",
  "ikke den, den drak vi sidst"); earlier turns are resent. Conversations are
  **not saved**: leaving the screen or starting "Ny samtale" clears it.
- AI returns recommendations referencing cellar ids, with a short reason each,
  possibly ordered (e.g. "first … later …"). App renders them as tappable
  bottle cards. Any id not in stock is discarded.
- Optional "Åbn denne" action to mark a recommended bottle as drunk.

### 7.5 Scores
- AI score 0–5 labelled clearly as "AI-vurdering" (estimate from producer
  reputation, region, vintage quality, style) — never presented as reviews.
- Own rating 0–5 shown alongside. Own ratings are included in the pairing
  context so suggestions can lean toward what the owner likes.

### 7.6 Settings & backup
- API key entry (with link/explanation on how to get one and set a spend cap).
- "Sikkerhedskopi": export entire cellar (data + photos) to a single file;
  import/restore from that file. Gentle reminder if no backup in a while
  (builder's call on cadence).

## 8. Data (shape, not schema)

- **Wine**: id, name, producer, vintage (nullable for NV), region, country, type,
  grapes[], notes, pairings[], drinkFrom, drinkTo, aiScore, aiConfidence,
  photo, createdAt.
- **Stock**: current quantity per wine.
- **Purchase**: wineId, date, bottles, pricePerBottle (DKK, optional). The
  price shown/sent to the AI is the latest purchase price (builder may show an
  average too).
- **Tasting/drink log**: wineId, date, ownRating, note.
- Stored in IndexedDB.

## 9. Tech (builder's/assistant's calls, stated to owner)

- React + TypeScript + Vite, PWA (installable, offline shell).
- IndexedDB (e.g. Dexie) for data and photos.
- Anthropic TypeScript SDK in the browser; structured output (JSON schema) for
  the scan and pairing calls; responses validated before use.
- Image downscale/compress on-device before upload.
- Free static HTTPS hosting (GitHub Pages / Netlify / Cloudflare Pages).
- All UI strings in a single Danish strings module.

## 10. Costs (estimates, USD)

- New wine scan with Sonnet 5.5: ~$0.01–0.02.
- Re-lookup after correcting name/vintage: under ~$0.01.
- Pairing question: ~$0.01–0.03 for a ~50-bottle cellar; each follow-up in
  the same conversation costs about the same again.
- Adding more bottles of a known wine: $0.

## 11. Left to the builder

- Visual design and layout details (within Danish, phone-first, simple).
- Exact status thresholds, sort defaults, backup reminder cadence.
- Error handling UX (no network, bad photo, AI unsure → let user type details).
- Prompt wording, image size target, duplicate-matching rules.
- Testing approach.
