# Van prototype naar echt portaal

Dit is de lijst met wat er moet gebeuren om het portaal in gebruik te nemen,
en wie wat doet.

---

## Waar het om draait

Het portaal bewaart zijn gegevens in Supabase en zit achter een inlog. Die twee
komen uit hetzelfde onderdeel, dus één keer inrichten regelt allebei.

De inrichting kan ik niet voor je doen — daar is jouw account voor nodig. Reken
op ongeveer twintig minuten voor stap 1 tot en met 4.

---

## Stap 1 — Supabase-project aanmaken (jij, ±10 minuten)

Supabase kent twee niveaus: een **organisatie** (je bedrijf) en daarbinnen een
of meer **projecten** (de databases zelf). Bij een nieuw account maak je eerst
de organisatie aan, daarna pas het project.

1. Ga naar [supabase.com](https://supabase.com) en maak een account. Het gratis
   pakket is ruim voldoende om te beginnen.
2. **Create an organization.** Dit is nog niet het project.
   - **Name:** `De Kleuterspecialist`
   - **Type:** kies wat past; bij een eenmanszaak voldoet `Personal` of
     `Company` prima. Dit heeft geen gevolgen voor de werking.
   - **Plan:** `Free`
   Klik daarna op **Create organization**.
3. Nu verschijnt het scherm voor het project. Vul in:
   - **Name:** `kleuterspecialist-prod`
   - **Database Password:** laat Supabase er een genereren en **bewaar die in
     je wachtwoordmanager**. Je hebt hem later nodig en hij is niet opnieuw op
     te vragen.
   - **Region:** **Central EU (Frankfurt)**. Dit is belangrijk: je slaat
     arbeidsgegevens op, die horen binnen de EU te blijven.
4. Klik **Create new project** en wacht tot hij klaar is. Dat duurt een paar
   minuten.

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

In Supabase staan de URL en de sleutels op **twee verschillende pagina's**.
Klik linksonder op **Project Settings** (het tandwiel).

1. **Project URL** — te vinden onder **Data API**. Ziet eruit als
   `https://abcdefghijklm.supabase.co`.

   Kun je hem niet vinden, lees hem dan af uit de adresbalk. Die ziet eruit als
   `supabase.com/dashboard/project/abcdefghijklm`; het stuk na `/project/` is je
   projectcode, en de Project URL is die code met `https://` ervoor en
   `.supabase.co` erachter.

2. **De sleutels** — te vinden onder **API Keys**. Supabase is ze aan het
   hernoemen, dus je ziet één van deze twee:

   | Waarvoor | Oude naam | Nieuwe naam |
   |---|---|---|
   | publiek | `anon` `public` | **Publishable key** (`sb_publishable_…`) |
   | geheim | `service_role` | **Secret key** (`sb_secret_…`) |

   De geheime zit verborgen achter een oogje of een knop **Reveal**.

3. In Vercel: open je project → **Settings** → **Environment Variables**. Voeg
   toe, en vink bij elk alle drie de omgevingen aan (Production, Preview,
   Development):

   | Naam | Waarde | Soort |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | de Project URL | Config |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | de publieke sleutel | Config |
   | `SUPABASE_SERVICE_ROLE_KEY` | de geheime sleutel | **Secret** |

   Vercel vraagt per variabele om een soort. `Secret` (soms `Sensitive`)
   betekent dat de waarde na opslaan is versleuteld en door niemand meer is
   terug te lezen, ook niet door jou. Dat hoort bij de geheime sleutel. De
   eerste twee worden in de website meegebakken en zijn dus sowieso openbaar;
   die als `Secret` markeren geeft alleen een vals gevoel van veiligheid en
   maakt ze lastiger te controleren.

   Raak je de geheime sleutel kwijt, dan is dat geen ramp: in Supabase maak je
   er een nieuwe aan.

**Let op: omgevingsvariabelen gaan pas mee bij een nieuwe bouw.** Vercel bakt ze
erin op het moment dat de website wordt gebouwd. Voeg je ze achteraf toe, dan
moet er daarna nog één keer opnieuw gebouwd worden, anders draait de website
nog met de oude (lege) waarden.

**Over de geheime sleutel.** Die geeft volledige toegang tot alle gegevens en
omzeilt alle beveiligingsregels. Zet hem **alleen** in Vercel, plak hem nooit in
een chat, een e-mail of een bestand in de repository. De publieke sleutel is wel
veilig om te delen — die is bedoeld om in de browser te staan en geeft op
zichzelf nergens toegang toe; de beveiligingsregels in de database doen dat werk.

---

## Stap 3b — Vercel de juiste tak laten publiceren (jij, ±2 minuten)

Vercel maakt twee soorten websites van dezelfde code:

| Soort | Adres | Waarvoor |
|---|---|---|
| **Production** | `portaal-de-kleuterspecialist.vercel.app` | het echte portaal |
| **Preview** | een lang adres met `-git-` erin | een proefversie per wijziging |

Welke van de twee je krijgt, hangt af van de **tak** (branch) waar de code op
staat. Vercel publiceert standaard de tak `main` als productie. Al het werk aan
dit portaal staat op de tak `claude/kleuterspecialist-portaal-prototype-9roj7p`,
en zolang Vercel die niet als productietak kent, komt elke verbetering alléén op
een preview-adres terecht — het echte adres blijft dan op de oudste versie
staan.

Zo zet je dat goed:

1. Open je project in Vercel → **Settings**. Waar de instelling staat, hangt af
   van hoe oud je scherm is:
   - nieuwere schermen: **Environments** → **Production** → **Branch Tracking**
   - oudere schermen: **Git** → **Production Branch**
2. Er staat `main`. Zet die op
   `claude/kleuterspecialist-portaal-prototype-9roj7p` en sla op.
3. Vanaf dan wordt elke wijziging die wordt doorgestuurd, vanzelf op het echte
   adres gezet. Een wijziging die er al vóór deze instelling was, komt er niet
   met terugwerkende kracht op: die publiceer je één keer handmatig via
   **Deployments** → de bovenste regel → het knopje **⋯** → **Promote to
   Production**.

Kun je de instelling niet vinden, dan is die laatste weg — **Promote to
Production** — op zichzelf ook genoeg. Alleen moet je hem dan na elke wijziging
opnieuw gebruiken.

**Zie je nog steeds de oude versie?** Kijk dan in **Deployments** naar de
bovenste regel. Staat daar het label `Production` bij, en klopt de omschrijving
met de laatste wijziging? Zo niet, dan kijk je naar een preview en staat de
productietak nog verkeerd.

---

## Stap 4 — Je eerste inlogaccount (jij, ±3 minuten)

De koppeling met Supabase en het inlogscherm zijn gebouwd. Wat nog ontbreekt is
een account om mee in te loggen.

**Doe dit in deze volgorde**, anders krijgt je account geen profiel:

1. **Eerst de laatste migratie draaien.** Open in de SQL Editor het bestand
   `supabase/migrations/20260914120000_profiel_bij_inlog.sql`, plak het en klik
   **Run**. Dit zorgt dat er automatisch een profiel bij een nieuw account
   wordt aangemaakt. Zonder dat log je in en zie je een foutmelding.
2. **Daarna het account aanmaken.** Ga in Supabase naar **Authentication** →
   **Users** → **Add user** → **Create new user**. Vul je e-mailadres en een
   wachtwoord van minstens twaalf tekens in, en zet **Auto Confirm User** aan.

De eerste die op deze manier wordt aangemaakt krijgt automatisch de rol
**beheerder**; iedereen daarna wordt medewerker.

Ga daarna naar je portaal. Je komt op het inlogscherm en kunt naar binnen.

**Ben je te vroeg geweest** en bestaat het account al zonder profiel? Draai dan
alsnog de migratie en voer dit uit in de SQL Editor:

```sql
insert into public.profielen (auth_gebruiker_id, voornaam, achternaam, email, rol)
select id, split_part(email, '@', 1), '', email, 'beheerder'
from auth.users
where id not in (select auth_gebruiker_id from public.profielen where auth_gebruiker_id is not null);
```

### Wat er nog niet is

- **Tweestapsverificatie** voor de beheerder (SPEC.md hoofdstuk 7).

### Wat wél werkt

Row Level Security doet het beveiligingswerk in de database zelf: een
medewerker kan alleen bij de eigen afspraken en uren, ook als iemand de app zou
proberen te omzeilen. De rol komt uit `profielen` en nooit uit iets dat de
browser kan zetten.

---

## Stap 4b — Medewerkers kunnen uitnodigen (jij, ±5 minuten)

In het beheerdersportaal maak je een medewerker aan en klik je op
**Uitnodigen**. Supabase stuurt dan een e-mail met een eenmalige link naar
`/instellen`, waar de medewerker zelf een wachtwoord kiest. Daarvoor moeten
deze drie dingen kloppen:

1. **De geheime sleutel staat in Vercel.** Zonder `SUPABASE_SERVICE_ROLE_KEY`
   kan het portaal geen accounts aanmaken; je krijgt dan een melding die dat
   zegt.

   Ophalen: Supabase → **Project Settings** (tandwiel) → **API Keys** → de
   regel `service_role`, in nieuwere schermen **Secret key** (`sb_secret_…`).
   Hij zit achter een oogje of een knop **Reveal**.

   Wegzetten: Vercel → **Settings** → **Environment Variables** → naam
   `SUPABASE_SERVICE_ROLE_KEY`, alle drie de omgevingen aanvinken, soort
   **Sensitive**. Daarna **Deployments** → bovenste regel → **⋯** →
   **Redeploy**, want een variabele gaat pas mee bij een nieuwe bouw.

2. **Supabase weet waar het portaal staat.** Ga naar **Authentication** →
   **URL Configuration**:
   - **Site URL:** `https://portaal-de-kleuterspecialist.vercel.app` — hier
     staat bij een nieuw project `http://localhost:3000`.
   - **Redirect URLs:** klik **Add URL** en voeg
     `https://portaal-de-kleuterspecialist.vercel.app/**` toe. De twee
     sterretjes horen erbij; die staan voor alles wat erachter komt.

   Staat dat er niet in, dan weigert Supabase de link uit de e-mail. Krijg je
   later een eigen webadres (stap 6), zet dat er dan ook bij.

3. **Er is een afzender voor e-mail.** Supabase verstuurt standaard zelf mail,
   maar dat is bedoeld om mee te proberen: een paar berichten per uur, en niet
   altijd betrouwbaar bezorgd. Voor echt gebruik zet je bij **Authentication**
   → **Emails** → **SMTP Settings** je eigen afzender aan, bijvoorbeeld die van
   Strato.

**Bestaat het account al**, bijvoorbeeld omdat je het met de hand hebt
aangemaakt? Dan koppelt de knop **Uitnodigen** dat bestaande account aan het
profiel, en kan de medewerker via "Wachtwoord vergeten" naar binnen.

**Wachtwoordlengte.** Zet bij **Authentication** → **Policies** de minimale
lengte op **12 tekens** (SPEC.md hoofdstuk 7). Het portaal vraagt er zelf ook
om, maar de database hoort de grens te bewaken.

---

## Stap 5 — Instellingen die nog kloppen moeten

Voordat je echte uren gaat bijhouden:

- **Contracturen per week.** Leg dit vast bij Beheer; de jaarnorm rolt er
  vanzelf uit. Zonder contract kan het portaal geen norm berekenen.
- **Datum indiensttreding.** Bepaalt de berekening naar rato in het eerste
  jaar. Staat in `profielen`, veld `in_dienst_vanaf`.
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
| Inloggen met e-mail en wachtwoord | gebouwd |
| Gegevens bewaren in de database | gebouwd |
| Contracturen vastleggen in Beheer | gebouwd |
| Medewerkers aanmaken en wijzigen in Beheer | gebouwd |
| Medewerkers uitnodigen per e-mail | gebouwd — zie stap 4b |
| Tweestapsverificatie voor de beheerder | nog te bouwen |
| Schoolvakanties invoeren in Beheer | nog te bouwen |
| Instellingen wijzigen in Beheer | nog te lezen, niet te wijzigen |
| Wijzigingslog bekijken | triggers vullen hem al, scherm ontbreekt |
| Autorisatietest uit `SPEC.md` 9.7 | kan nu wel, staat nog open |
| Nachtelijke back-up naar HiDrive | nog in te richten |
