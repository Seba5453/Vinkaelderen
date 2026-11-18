# Min Vinkælder

Din personlige vinkælder på telefonen. Fotografér etiketten, så finder AI'en vinen, druerne, smagsnoter, drikkevindue og en AI-vurdering (0–5). Du holder styr på antal, køb og hvad du har drukket – og kan spørge, hvad I skal drikke i aften, ud fra det du faktisk har.

## Kom i gang

1. **Åbn appen** i telefonens browser (Safari på iPhone, Chrome på Android).
2. **Læg den på hjemmeskærmen**
   - iPhone: Del-knappen → *Føj til hjemmeskærm*
   - Android: Menu (⋮) → *Installer app* / *Føj til startskærm*
3. **Tilføj din API-nøgle** under *Indstillinger*
   - Opret en nøgle på [console.anthropic.com](https://console.anthropic.com) under *API Keys*.
   - Sæt en **månedlig udgiftsgrænse** (fx 5 $) under *Billing → Limits*, så der aldrig kommer overraskelser.
   - Nøglen gemmes kun på din telefon.

## Hvad koster det?

Ca. 1–2 cent pr. ny vin, du scanner, og 1–3 cent pr. spørgsmål. Flere flasker af en vin, du allerede har, koster ingenting.

## Dine data

Alt ligger **kun på din telefon** (i browserens lager). Ryder du browserdata eller mister telefonen, forsvinder vinkælderen. Tag derfor en **sikkerhedskopi** under *Indstillinger* jævnligt og gem filen i fx iCloud eller Google Drev. Appen minder dig om det efter 30 dage.

## Udvikling

```bash
npm install
npm run dev -- --host   # kamera kræver HTTPS på telefonen – brug den udrullede version eller en HTTPS-tunnel
npm test
npm run build
```

Udrulning: push til `main` på GitHub, og slå *Pages → Source: GitHub Actions* til i repoets indstillinger.
