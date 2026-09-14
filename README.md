# Portaal De Kleuterspecialist

Urenregistratie- en planningsportaal voor De Kleuterspecialist. Afspraken met
basisscholen vastleggen, plannen in een agenda en de uren verantwoorden tegen
de jaarurennorm (Arbeidstijdenwet).

- **`SPEC.md`** — functionele en technische specificatie. Leidend document.
- **`CLAUDE.md`** — projectafspraken, conventies en werkwijze.

## Aan de slag

```bash
npm install
npm run dev      # ontwikkelserver op http://localhost:3000
npm run test     # unittests, waaronder de rekenregels
npm run build    # productiebuild — moet slagen vóór elke commit
```

## Database en inloggen

Het portaal draait op Supabase: Postgres voor de gegevens, Supabase Auth voor
het inloggen. Zonder de omgevingsvariabelen uit `.env.example` start het niet.
**Zie `PUBLICEREN.md`** voor het inrichten.

- Lezen gaat via `lib/data/werkset.ts`, dat per aanvraag in één keer ophaalt wat
  de ingelogde gebruiker mag zien. Row Level Security in Postgres bepaalt dat,
  niet de app.
- Schrijven gaat uitsluitend via server actions met `zod`-validatie.
- De verbinding gebruikt altijd de sessie van de gebruiker, nooit de
  `service_role`-sleutel — anders zou RLS worden omzeild.

**Nooit echte persoonsgegevens in de dev-omgeving.**

## Mappenindeling

| Map | Inhoud |
|---|---|
| `app/` | Routes (App Router). Server components tenzij interactie het anders vereist. |
| `components/ui/` | shadcn/ui-componenten |
| `components/` | Schermonderdelen |
| `lib/uren/` | **Rekenregels uit `SPEC.md` hoofdstuk 5.** Pure functies, geen databasetoegang. |
| `lib/data/` | Datalaag: `werkset.ts` haalt op, `queries.ts` rekent |
| `lib/supabase/` | Verbindingen voor server, browser en proxy |
| `lib/export/` | Selectie en kolommen van het overzicht, gedeeld door scherm en Excel |
| `lib/validatie/` | `zod`-schema's voor de server actions |
| `supabase/migrations/` | Databasemigraties |

De rekenregels staan uitsluitend in `lib/uren/`. Getallen als 1659, 3,0 uur of
2,0 uur eigen reistijd horen daar niet hardcoded te staan — die komen uit de
database. Zie de tabel in `CLAUDE.md`.

## Supabase koppelen

```bash
cp .env.example .env.local   # en vul de projectgegevens in
npx supabase db push         # migraties toepassen op de dev-database
```

Zonder opdrachtregel: plak `supabase/volledig-schema.sql` in de SQL Editor van
een leeg project. Zie `PUBLICEREN.md`.

## Afwijkingen van CLAUDE.md

- **Excel-export met `exceljs` in plaats van SheetJS.** SheetJS is niet meer via
  npm te verkrijgen; wat op npm achterbleef staat sinds 2022 stil met bekende
  lekken.
- **PDF zonder bibliotheek.** De PDF-knop laat de browser afdrukken naar PDF,
  met een afdrukopmaak in `globals.css`. Dat scheelt een zware afhankelijkheid.
- **Eigen datumveld** in plaats van `<input type="date">`, omdat die laatste de
  notatie van de browsertaal volgt en `CLAUDE.md` `dd-mm-jjjj` voorschrijft.
- **shadcn/ui als broncode** in `components/ui/`, omdat de registry op
  ui.shadcn.com vanuit de bouwomgeving niet bereikbaar is.

## Status

Werkend, maar nog zonder database en zonder inlog. Zie `PUBLICEREN.md` voor de
weg naar live, `SPEC.md` hoofdstuk 8 voor de fasering en hoofdstuk 10 voor wat
expliciet niet in versie 1 zit.
