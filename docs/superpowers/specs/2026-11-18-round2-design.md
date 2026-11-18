# Min Vinkælder — round 2 (short design)

Date: 2026-11-18 · Status: approved in chat (owner dropped multi-bottle scan: "only 1 bottle at a time, more than 1 could create problems").

## Intent
Make the app nicer in daily use now that it runs on the owner's iPhone: see at a glance what to drink, get updates without fighting iOS, and get buying advice.

## Scope
1. **Drink-now overview** (main screen): a box above the list with two tappable counts of in-stock *wines*: "Drik snart: N" and "Klar: N". Tapping one filters the list to that status; tapping again clears it. Hidden when both are 0. *(Assistant's call: counts wines, not bottles.)*
2. **Smoother iOS updates**: check for a new service worker at start and whenever the app becomes visible again; autoUpdate then activates/reloads. Only fully verifiable on a phone.
3. **"Hvad mangler jeg?"** (Spørg): a button that sends a fixed question. The answer gets a new `shoppingList` (3–5 items: wine/style + reason) for wines NOT in the cellar, shown as cards. Follow-ups work as usual. Normal questions return an empty shoppingList. ~1–3 cents.

## Non-goals
Multi-bottle scanning (rejected by owner). No new storage.

## Approaches
- Overview: status filter in `queryCellar` (chosen; reuses list + sorting) vs. a separate screen (more UI, no gain).
- Shopping advice: extend the existing answer schema with `shoppingList` (chosen; follow-ups and history keep working) vs. a separate AI call/screen (duplicates the chat).
- Updates: `virtual:pwa-register` + `registration.update()` on visibilitychange (chosen; standard vite-plugin-pwa path).
