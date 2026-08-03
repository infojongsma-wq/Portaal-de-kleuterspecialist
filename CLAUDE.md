# CLAUDE.md

Projectafspraken voor het urenregistratie- en planningsportaal van De Kleuterspecialist.

**Lees eerst `SPEC.md`.** Dat document bevat het datamodel, de rekenregels en de schermbeschrijvingen. Dit bestand bevat alleen de conventies en de werkwijze.

---

## Wat deze app is

Een webportaal waarin één (later meer) medewerker van De Kleuterspecialist afspraken met basisscholen vastlegt en uren registreert volgens een jaarurennorm. De eigenaar gebruikt het om de uren te verantwoorden. Wettelijk verplichte registratie onder de Arbeidstijdenwet.

Gebruikers zijn geen ontwikkelaars. Bouw voor duidelijkheid, niet voor elegantie.

---

## Taal en notatie

- **Alle interfacetekst in het Nederlands.** Geen Engelse labels, knoppen of foutmeldingen.
- **Code in het Engels**, maar database- en domeinbegrippen in het Nederlands: `afspraken`, `urenregels`, `activiteitsoorten`. Niet mengen.
- **Datums:** `dd-mm-jjjj` in de interface. In de database altijd ISO (`date` / `timestamptz`).
- **Tijden:** 24-uursnotatie, `09:30`.
- **Uren:** komma als decimaalteken in de interface (`6,50`), punt in de database. Bij voorkeur ook `6u30` tonen naast de decimale waarde.
- **Bedragen:** euro's, komma als decimaalteken.
- **Weeknummers:** ISO-weeknummers, week begint op maandag.
- Gebruik `date-fns` met locale `nl` voor alle datumbewerking en -weergave. Nooit handmatig datums met strings opbouwen.

---

## Databaseconventies

- Tabelnamen: Nederlands, meervoud, `snake_case` — `afspraken`, `klanten`, `contactpersonen`
- Kolomnamen: Nederlands, `snake_case`
- Primaire sleutel: `id uuid default gen_random_uuid()`
- Elke tabel heeft `aangemaakt_op timestamptz default now()` en `gewijzigd_op timestamptz`
- Verwijzende sleutel: `<tabel_enkelvoud>_id`, bijvoorbeeld `klant_id`
- Geldbedragen en uren: `numeric`, nooit `float`
- Migraties via de Supabase CLI, in `supabase/migrations/`, met een beschrijvende naam
- **Row Level Security staat aan op elke tabel.** Een tabel zonder RLS-policy is een bug.

---

## Architectuur

- Next.js App Router. Standaard Server Components; `"use client"` alleen waar interactie het vereist.
- Alle schrijfacties via Server Actions met een validatieschema van `zod`.
- Geen rechtstreekse databasequery's vanuit de browser met verhoogde rechten.
- De `SUPABASE_SERVICE_ROLE_KEY` staat uitsluitend in serveromgevingsvariabelen. Nooit in een `NEXT_PUBLIC_*`-variabele, nooit in clientcode.
- Rol van de gebruiker altijd serverside ophalen uit `profielen`, nooit uit een JWT-claim die de client kan zetten.
- Rekenlogica in `lib/uren/` als **pure functies zonder databasetoegang**, zodat ze los te testen zijn. De rekenregels uit `SPEC.md` hoofdstuk 5 staan hier en nergens anders.

---

## Rekenregels — nooit hardcoderen

Deze waarden komen uit de database, niet uit constanten in de code:

| Waarde | Waar het vandaan komt |
|---|---|
| 3,0 / 3,0 uur voor een training | `activiteitsoorten` |
| 3,5 / 0,5 uur voor een observatie | `activiteitsoorten` |
| 2,0 uur eigen reistijd per dag | `instellingen.eigen_reistijd_uren_per_dag` |
| 1659 uur bij 1,0 fte | `contracten.norm_fulltime` |
| 40 uur fulltime werkweek | vaste deler in de werktijdfactor — wél een constante, met een commentaarregel erbij |
| Schoolvakanties | `niet_inzetbare_dagen` |

Als je een van deze getallen in een `.ts`-bestand ziet staan buiten `lib/uren/constants.ts`, is dat een fout.

---

## Privacy

- **Geen leerlinggegevens.** Bij elk vrij tekstveld (`notitie`, `afspraken_met_klant`) een zichtbare waarschuwing tonen: *"Alleen zakelijke afspraken. Geen namen of bijzonderheden van individuele leerlingen."*
- Geen persoonsgegevens in logregels, foutmeldingen of externe diensten.
- Geen analytics of trackingscripts van derden.
- In de ontwikkelomgeving uitsluitend verzonnen testgegevens. Nooit echte namen van medewerkers of scholen.

---

## Werkwijze

1. **Eén ding per keer.** Bouw geen hele fase in één keer; bouw één scherm of één functie en stop.
2. **Toon je plan voordat je meerdere bestanden aanmaakt.**
3. **Tests bij rekenlogica zijn niet optioneel.** Elke wijziging in `lib/uren/` gaat samen met tests uit `SPEC.md` hoofdstuk 9.
4. **Commit na elke werkende stap**, met een Nederlandse commitmelding in de gebiedende wijs: `voeg klantformulier toe`.
5. **Wijzig `SPEC.md` niet** zonder dat er expliciet om gevraagd wordt. Constateer je een tegenstrijdigheid, meld die dan en vraag hoe het moet.
6. **Verzin geen functies.** Staat iets niet in `SPEC.md`, vraag het dan. Hoofdstuk 10 van `SPEC.md` bevat wat er expliciet níet in versie 1 zit.
7. **Geen nieuwe afhankelijkheden** zonder het te melden en kort te motiveren.

---

## Vaste bibliotheken

Gebruik deze, geen alternatieven:

| Doel | Bibliotheek |
|---|---|
| Styling | Tailwind CSS |
| Componenten | shadcn/ui |
| Agenda | FullCalendar (gratis versie) |
| Formulieren | react-hook-form |
| Validatie | zod |
| Datums | date-fns, locale `nl` |
| Database en auth | @supabase/supabase-js, @supabase/ssr |
| Tests | Vitest |
| Excel-export | SheetJS |

---

## Commando's

```bash
npm run dev          # ontwikkelserver
npm run build        # productiebuild — moet slagen vóór elke commit
npm run test         # unittests, waaronder de rekenregels
npx supabase db push # migraties toepassen op de dev-database
```

---

## Hulp nodig

Als iets in `SPEC.md` onduidelijk of tegenstrijdig is: stel de vraag in plaats van een aanname te doen. Bij urenberekeningen is een verkeerde aanname pas maanden later zichtbaar, in de vorm van een onjuiste jaarafrekening.

---

## Next.js

Deze versie van Next.js wijkt af van wat in trainingsdata zit. Zie `AGENTS.md` en `node_modules/next/dist/docs/` voor de actuele conventies.
