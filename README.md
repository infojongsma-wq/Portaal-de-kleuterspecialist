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

## Nog geen database

Er is nog geen Supabase-omgeving gekoppeld. Het portaal start leeg en houdt de
gegevens in het geheugen van de server (`lib/data/opslag.ts`). Lokaal werkt dat;
op Vercel draaien meerdere servers die dat geheugen niet delen, waardoor
wijzigingen verdwijnen.

**Zie `PUBLICEREN.md`** voor de stappen om Supabase te koppelen. Dat lost het
bewaren én het inloggen in één keer op.

De schermen schrijven nu al via server actions met `zod`-validatie — dezelfde
weg die straks naar Postgres loopt. Bij de overstap verandert alleen de
implementatie achter `lib/data/queries.ts`.

**Nooit echte persoonsgegevens in de dev-omgeving.**

## Mappenindeling

| Map | Inhoud |
|---|---|
| `app/` | Routes (App Router). Server components tenzij interactie het anders vereist. |
| `components/ui/` | shadcn/ui-componenten |
| `components/` | Schermonderdelen |
| `lib/uren/` | **Rekenregels uit `SPEC.md` hoofdstuk 5.** Pure functies, geen databasetoegang. |
| `lib/data/` | Datalaag: servergeheugen nu, Supabase later |
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

## Afwijking van SPEC.md

De voorbereidingstijd van een observatie staat op **1,00 uur**; `SPEC.md`
hoofdstuk 2 en 5.1 noemen nog 0,50. De waarde staat in de database
(`activiteitsoorten`), niet in de code.

## Status

Werkend, maar nog zonder database en zonder inlog. Zie `PUBLICEREN.md` voor de
weg naar live, `SPEC.md` hoofdstuk 8 voor de fasering en hoofdstuk 10 voor wat
expliciet niet in versie 1 zit.
