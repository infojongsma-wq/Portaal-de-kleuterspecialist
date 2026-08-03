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

## Demogegevens

Er is nog geen Supabase-omgeving gekoppeld. Zolang `NEXT_PUBLIC_SUPABASE_URL`
leeg is draait het portaal op een **ingebouwde demoset in het servergeheugen**
met verzonnen scholen en personen (`lib/data/demo-gegevens.ts`). Wijzigingen
blijven bewaard zolang de server draait en zijn weg na een herstart.

Dat is bewust: zo is het prototype te bekijken zonder database, terwijl de
schermen wél al via server actions en `zod`-validatie schrijven — dezelfde weg
die straks naar Supabase loopt.

**Nooit echte persoonsgegevens in de demoset of in de dev-omgeving.**

## Mappenindeling

| Map | Inhoud |
|---|---|
| `app/` | Routes (App Router). Server components tenzij interactie het anders vereist. |
| `components/ui/` | shadcn/ui-componenten |
| `components/` | Schermonderdelen |
| `lib/uren/` | **Rekenregels uit `SPEC.md` hoofdstuk 5.** Pure functies, geen databasetoegang. |
| `lib/data/` | Datalaag: demogegevens nu, Supabase later |
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

## Status

Prototype. Zie `SPEC.md` hoofdstuk 8 voor de fasering; hoofdstuk 10 beschrijft
wat expliciet niet in versie 1 zit.
