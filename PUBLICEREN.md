# Van prototype naar echt portaal

Dit is de lijst met wat er moet gebeuren om het portaal in gebruik te nemen,
en wie wat doet.

---

## Waar het nu op vastloopt

Er zit nog **geen database** achter. Alles wat je invult staat in het geheugen
van de server. Op je eigen laptop werkt dat; op Vercel draait je portaal op
meerdere servers tegelijk, en die delen dat geheugen niet. Vandaar dat een
school die je toevoegt even later weer weg is.

Dat is geen bug meer maar een ontbrekend onderdeel, en het is **hetzelfde
onderdeel dat de inlog mogelijk maakt**. Supabase levert allebei: de database
én het inloggen. Eén keer inrichten lost dus twee dingen tegelijk op.

De inrichting kan ik niet voor je doen — daar is jouw account voor nodig.
Reken op ongeveer twintig minuten.

---

## Stap 1 — Supabase-project aanmaken (jij, ±10 minuten)

1. Ga naar [supabase.com](https://supabase.com) en maak een account. Het gratis
   pakket is ruim voldoende om te beginnen.
2. Klik **New project**.
3. Vul in:
   - **Name:** `kleuterspecialist-prod`
   - **Database Password:** laat Supabase er een genereren en **bewaar die in
     je wachtwoordmanager**. Je hebt hem later nodig en hij is niet opnieuw op
     te vragen.
   - **Region:** **Central EU (Frankfurt)**. Dit is belangrijk: je slaat
     arbeidsgegevens op, die horen binnen de EU te blijven.
4. Klik **Create new project** en wacht tot hij klaar is.

Maak daarnaast hetzelfde aan met de naam `kleuterspecialist-dev`. Dat is je
oefenomgeving, waar je zonder risico dingen kunt proberen. Niet verplicht, wel
verstandig.

---

## Stap 2 — De database inrichten (jij, ±5 minuten)

De opbouw van de database staat al klaar in `supabase/migrations/`. Die moet
één keer worden uitgevoerd.

**De makkelijkste weg, zonder installatie:**

1. Open het bestand **`supabase/volledig-schema.sql`** uit deze repository.
2. Selecteer alles (Ctrl+A) en kopieer het (Ctrl+C).
3. Open je project in Supabase en klik links op **SQL Editor**.
4. Plak alles in het venster en klik rechtsonder op **Run**.

Je hoort onderin `Success. No rows returned` te zien. Dat is goed: het bouwt
tabellen, die geven zelf niets terug.

**Voor later, als je met de opdrachtregel werkt:** de losse migraties staan in
`supabase/migrations/` en gaan met `npx supabase db push`. Gebruik óf het
volledige bestand, óf de losse migraties — niet allebei.

---

## Stap 3 — De sleutels aan Vercel geven (jij, ±5 minuten)

1. In Supabase: **Project Settings** → **API Keys**. Daar staan drie dingen:
   - **Project URL**
   - **anon public** sleutel
   - **service_role** sleutel
2. In Vercel: open je project → **Settings** → **Environment Variables**. Voeg
   toe:

   | Naam | Waarde |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | de Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | de anon public sleutel |
   | `SUPABASE_SERVICE_ROLE_KEY` | de service_role sleutel |

**Over de service_role-sleutel.** Die geeft volledige toegang tot alle gegevens
en omzeilt alle beveiligingsregels. Zet hem **alleen** in Vercel, plak hem
nooit in een chat, een e-mail of een bestand in de repository. De anon-sleutel
is wel veilig om te delen — die is bedoeld om in de browser te staan en geeft
op zichzelf nergens toegang toe.

---

## Stap 4 — De koppeling en het inlogscherm (ik)

Zodra stap 1 tot en met 3 klaar zijn, bouw ik:

- de koppeling met Supabase, in plaats van het huidige servergeheugen;
- een inlogscherm met e-mailadres en wachtwoord;
- automatisch doorsturen naar de inlogpagina als je niet bent ingelogd;
- tweestapsverificatie voor de beheerder;
- het aanmaken en uitnodigen van medewerkers in het beheerdersportaal.

De beveiligingsregels in de database (Row Level Security) staan al klaar en
zijn bij stap 2 mee geïnstalleerd. Die zorgen ervoor dat een medewerker alleen
bij de eigen afspraken en uren kan, ook als iemand de app zelf zou proberen te
omzeilen.

**Wat ik van je nodig heb:** de Project URL en de anon-sleutel. Die mag je
gewoon hier in de chat zetten. De service_role-sleutel niet — die zet je alleen
in Vercel en houd je verder voor jezelf.

---

## Stap 5 — Instellingen die nog kloppen moeten

Voordat je echte uren gaat bijhouden:

- **Contracturen per week.** Staat nu op 24. Pas dit aan bij Beheer; de
  jaarnorm rolt er vanzelf uit.
- **Datum indiensttreding.** Bepaalt de berekening naar rato in het eerste
  jaar.
- **Schoolvakanties.** De vakantiedagen die er nu in staan zijn bij benadering
  ingevuld en zijn **geen officiële data**. Vervang ze per schooljaar door de
  echte data van regio Noord. Zolang dat niet klopt, klopt de jaarnorm ook niet
  — het portaal waarschuwt daar zelf over.
- **Soorten trainingen.** Vul bij Beheer je eigen trainingen aan, met de juiste
  uren per soort.
- **Logo.** In `public/logo.svg` staat een nagetekende versie. Vervang dat
  bestand door je eigen logo, dan staat het overal meteen goed.

---

## Stap 6 — Eigen webadres

Je portaal staat nu op een `vercel.app`-adres. Voor `portaal.dekleuterspecialist.nl`:

1. In Vercel: **Settings** → **Domains** → voeg `portaal.dekleuterspecialist.nl`
   toe.
2. Vercel toont een CNAME-regel.
3. Bij Strato: open het DNS-beheer van `dekleuterspecialist.nl` en zet die
   CNAME-regel erin.
4. Na een tot enkele uren staat het adres live, met een geldig beveiligingsslot
   (https) dat Vercel zelf regelt.

---

## Voordat er echte gegevens in gaan

- **Zet er niets echts in zolang er geen inlog is.** Het adres is nu voor
  iedereen met de link toegankelijk.
- **Back-up.** `SPEC.md` hoofdstuk 3 vraagt om een nachtelijke kopie naar Strato
  HiDrive. Supabase maakt zelf al dagelijkse back-ups; de kopie naar HiDrive
  komt daar bovenop en moet nog worden ingericht.
- **Geen leerlinggegevens.** Het portaal waarschuwt bij elk tekstveld, maar de
  regel blijft: alleen zakelijke afspraken.
- **AVG.** Je legt arbeidstijden van een medewerker vast. Een korte
  verwerkersovereenkomst met Supabase en Vercel en een regeling hoe lang je de
  gegevens bewaart horen erbij (`SPEC.md` fase 6).

---

## Wat nog niet af is

| Onderwerp | Staat |
|---|---|
| Inloggen en tweestapsverificatie | wacht op stap 1 t/m 3 |
| Gegevens bewaren in een database | wacht op stap 1 t/m 3 |
| Medewerkers uitnodigen per e-mail | wacht op inloggen |
| Schoolvakanties invoeren in Beheer | nog te bouwen |
| Instellingen wijzigen in Beheer | nog te lezen, niet te wijzigen |
| Autorisatietest uit `SPEC.md` 9.7 | kan pas tegen een echte database |
| Nachtelijke back-up naar HiDrive | nog in te richten |
