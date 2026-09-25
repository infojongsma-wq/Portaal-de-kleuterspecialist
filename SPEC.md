# SPEC.md — Urenregistratie- en planningsportaal De Kleuterspecialist

> Dit is de functionele en technische specificatie. Claude Code: lees dit document voordat je code schrijft en verwijs bij twijfel terug naar het betreffende hoofdstuk.
> Versie 1.0 — augustus 2026

---

## 1. Doel en context

De Kleuterspecialist verzorgt trainingen en observaties bij basisscholen. Er is één medewerker in dienst (mogelijk later meer). Zij plant zelf haar afspraken met scholen, werkt vanuit huis en reist naar klanten.

De app moet drie dingen doen:

1. **Registreren** — afspraken met scholen vastleggen, met automatische urenberekening
2. **Plannen** — een agenda die laat zien wat wanneer staat gepland
3. **Verantwoorden** — een urenoverzicht dat aantoont dat de jaarurennorm gehaald wordt

De urenregistratie is wettelijk verplicht (Arbeidstijdenwet) en moet betrouwbaar en herleidbaar zijn.

### Gebruikers

| Rol | Wie | Wat mag deze |
|---|---|---|
| `beheerder` | Sander (eigenaar) | Alles: eigen én andermans gegevens, medewerkersbeheer, urenverantwoording, instellingen |
| `medewerker` | De trainer(s) | Eigen afspraken en uren; klantgegevens delen zij met de beheerder |

---

## 2. Vaste uitgangspunten

Deze waarden zijn besloten en mogen niet worden gewijzigd zonder overleg.

| Uitgangspunt | Waarde |
|---|---|
| Jaarurennorm bij 1,0 fte | **1659 uur** |
| Fulltime werkweek | 40 uur |
| Vakanties | Vallen **buiten** de norm (1659 = 40 × 41,48 weken) |
| Referentieperiode | Kalenderjaar, 1 januari t/m 31 december |
| Standplaats medewerker | Laaressingel, Enschede |
| Vakantieregio | Noord |
| Eigen reistijd per dag | 2,0 uur (instelbaar) |
| Training | 3,0 uur op locatie + 3,0 uur voorbereiding = 6,0 uur |
| Observatie | 3,5 uur op locatie + 1,0 uur voorbereiding = 4,5 uur |
| Doelapparaat | Laptop, minimaal 1280px breed |
| Taal interface | Nederlands |

### Nog te bevestigen vóór livegang

- Contracturen per week van de medewerker (bepaalt de werktijdfactor)
- Datum indiensttreding (bepaalt de berekening naar rato in het eerste jaar)

Bouw de app zo dat deze twee als instelbare velden in het beheerdersportaal staan — niet in code.

---

## 3. Techniek

| Onderdeel | Keuze |
|---|---|
| Framework | Next.js (App Router), TypeScript, React Server Components |
| Styling | Tailwind CSS + shadcn/ui |
| Agenda | FullCalendar (gratis versie, `dayGridMonth` / `timeGridWeek` / `timeGridDay`) |
| Database | PostgreSQL via Supabase, regio EU Frankfurt |
| Auth | Supabase Auth, e-mail + wachtwoord, TOTP-tweestapsverificatie |
| Autorisatie | Row Level Security in Postgres |
| Datumbewerking | `date-fns` met locale `nl` |
| Formulieren | `react-hook-form` + `zod` |
| Hosting | Vercel |
| Domein | `portaal.dekleuterspecialist.nl` (CNAME bij Strato) |
| Back-up | Nachtelijke `pg_dump` naar Strato HiDrive Objektspeicher (S3-compatibel) |

### Twee omgevingen

- `kleuterspecialist-dev` — testgegevens, verzonnen scholen en personen
- `kleuterspecialist-prod` — pas vullen na oplevering van fase 4

**Nooit echte persoonsgegevens in dev.**

---

## 4. Datamodel

Alle tabel- en kolomnamen in het Nederlands, `snake_case`, enkelvoudige primaire sleutel `id` (uuid).
Alle tabellen hebben `aangemaakt_op` en `gewijzigd_op` (timestamptz).

### 4.1 `profielen`

```sql
id                    uuid primary key
auth_gebruiker_id     uuid unique references auth.users(id) on delete cascade
voornaam              text not null
achternaam            text not null
email                 text not null unique
telefoon              text
rol                   text not null check (rol in ('beheerder','medewerker'))
standplaats_adres     text
standplaats_postcode  text
standplaats_plaats    text
standplaats_lat       numeric(9,6)
standplaats_lng       numeric(9,6)
in_dienst_vanaf       date
uit_dienst_per        date
actief                boolean not null default true
```

### 4.2 `contracten`

Meerdere per medewerker; bij urenwijziging een nieuw contract met nieuwe ingangsdatum.

```sql
id                     uuid primary key
profiel_id             uuid not null references profielen(id)
ingangsdatum           date not null
einddatum              date
uren_per_week          numeric(5,2) not null
werktijdfactor         numeric(5,4) generated always as (uren_per_week / 40) stored
norm_fulltime          numeric(7,2) not null default 1659
referentieperiode_start date not null default '2026-01-01'  -- alleen dag+maand relevant
```

De persoonlijke jaarnorm wordt **altijd berekend** als `norm_fulltime × werktijdfactor`, nooit los ingevoerd.

### 4.3 `klanten`

```sql
id                       uuid primary key
naam                     text not null          -- naam van de school
plaats                   text not null
adres                    text
postcode                 text
land                     text default 'NL'
lat                      numeric(9,6)
lng                      numeric(9,6)
reistijd_enkel_minuten   integer                -- vanaf standplaats medewerker
reisafstand_enkel_km     numeric(6,1)
reisgegevens_bijgewerkt_op timestamptz
telefoon_algemeen        text
email_algemeen           text
website                  text
notitie                  text
actief                   boolean not null default true
aangemaakt_door          uuid references profielen(id)
```

Index op `lower(naam)` en `lower(plaats)` voor het zoekveld met automatisch aanvullen.

### 4.4 `contactpersonen`

```sql
id           uuid primary key
klant_id     uuid not null references klanten(id) on delete cascade
naam         text not null
functie      text
telefoon     text
email        text
is_primair   boolean not null default false
notitie      text
```

Maximaal één `is_primair = true` per klant (afdwingen met een partial unique index).

### 4.5 `activiteitsoorten`

Instelbaar in het beheerdersportaal. **Nooit hardcoderen in de applicatiecode.**

```sql
id                 uuid primary key
naam               text not null unique
uren_op_locatie    numeric(4,2) not null
uren_voorbereiding numeric(4,2) not null
kleur              text not null default '#3b82f6'   -- voor de agenda
volgorde           integer not null default 0
handmatige_uren    boolean not null default false     -- true bij 'Anders'
actief             boolean not null default true
```

Startgegevens:

| naam | uren_op_locatie | uren_voorbereiding | handmatige_uren |
|---|---|---|---|
| Training | 3,00 | 3,00 | false |
| Observatie | 3,50 | 1,00 | false |
| Anders | 0,00 | 0,00 | true |

### 4.6 `afspraken`

```sql
id                    uuid primary key
klant_id              uuid not null references klanten(id)
contactpersoon_id     uuid references contactpersonen(id)
medewerker_id         uuid not null references profielen(id)
activiteitsoort_id    uuid not null references activiteitsoorten(id)

titel                 text not null            -- naam van de training
datum                 date not null
dagdeel               text not null check (dagdeel in ('ochtend','middag','hele_dag','anders'))
anders_omschrijving   text                     -- verplicht als dagdeel = 'anders'
starttijd             time
eindtijd              time

voorbereiding_datum   date not null            -- default = datum, aanpasbaar
uren_op_locatie       numeric(4,2) not null    -- overgenomen uit activiteitsoort
uren_voorbereiding    numeric(4,2) not null
reistijd_enkel_minuten integer                 -- overgenomen uit klant
reisafstand_enkel_km  numeric(6,1)
reisgegevens_bron     text check (reisgegevens_bron in ('automatisch','handmatig'))

status                text not null default 'gepland'
                      check (status in ('gepland','voltooid','geannuleerd','verzet'))
voltooid_op           timestamptz
voorbereiding_gedaan  boolean not null default false
verzet_naar_id        uuid references afspraken(id)

afspraken_met_klant   text
notitie               text

gewijzigd_door        uuid references profielen(id)
```

**Waarschuwing in de UI bij `notitie` en `afspraken_met_klant`:**
> Alleen zakelijke afspraken. Geen namen of bijzonderheden van individuele leerlingen.

### 4.7 `urenregels`

Alle uren komen hier samen — zowel automatisch afgeleid uit afspraken als handmatig geboekt.

```sql
id              uuid primary key
medewerker_id   uuid not null references profielen(id)
datum           date not null
afspraak_id     uuid references afspraken(id) on delete cascade
categorie       text not null
uren            numeric(5,2) not null check (uren >= 0)
toelichting     text
bron            text not null check (bron in ('automatisch','handmatig'))
```

Toegestane categorieën:

| Categorie | In scope fase 1–5 |
|---|---|
| `op_locatie` | ja |
| `voorbereiding` | ja |
| `reistijd` | ja |
| `administratie` | ja |
| `overleg` | ja |
| `scholing` | ja |
| `acquisitie` | ja |
| `overig` | ja |
| `verlof` | nee — later |
| `ziekte` | nee — later |
| `feestdag` | nee — later |

De laatste drie staan wel in de check-constraint zodat ze later zonder migratie te gebruiken zijn.

### 4.8 `niet_inzetbare_dagen`

```sql
id            uuid primary key
datum         date not null unique
soort         text not null check (soort in ('schoolvakantie','feestdag','overig'))
omschrijving  text not null
regio         text not null default 'Noord'
```

Per schooljaar vullen met de officiële vakantiedata van regio Noord plus nationale feestdagen. Bepaalt over hoeveel dagen de jaarnorm wordt uitgesmeerd (zie hoofdstuk 5.4). Uren boeken op deze dagen blijft toegestaan.

### 4.9 `instellingen`

Eén rij, key-value of vaste kolommen.

```sql
eigen_reistijd_uren_per_dag   numeric(4,2) not null default 2.00
kilometervergoeding_per_km    numeric(5,3)
reistijd_afronding_minuten    integer not null default 5
max_uren_per_dag_waarschuwing numeric(4,2) not null default 12.00
```

### 4.10 `wijzigingslog`

```sql
id            uuid primary key
gebruiker_id  uuid references profielen(id)
tabel         text not null
record_id     uuid not null
actie         text not null check (actie in ('insert','update','delete'))
oude_waarde   jsonb
nieuwe_waarde jsonb
tijdstip      timestamptz not null default now()
```

Vullen met database-triggers op `afspraken` en `urenregels`. Alleen leesbaar voor de beheerder, nooit bewerkbaar.

---

## 5. Rekenregels

Dit hoofdstuk is de kern. Bouw hier **geautomatiseerde tests** voor, met exact de voorbeelden hieronder.

### 5.1 Uren per afspraak

```
basisuren = uren_op_locatie + uren_voorbereiding
```

| Activiteitsoort | Op locatie | Voorbereiding | Totaal |
|---|---|---|---|
| Training | 3,0 | 3,0 | **6,0** |
| Observatie | 3,5 | 1,0 | **4,5** |
| Anders | handmatig | handmatig | handmatig |

De voorbereidingsuren worden geboekt op `voorbereiding_datum`, de locatie-uren op `datum`. Standaard zijn die gelijk, maar ze mogen verschillen.

### 5.2 Reistijd per dag

```
brutoreistijd_dag    = 2 × reistijd_enkel_minuten ÷ 60
eigen_tijd           = instellingen.eigen_reistijd_uren_per_dag  (2,0)
declarabele_reistijd = MAX(0 ; brutoreistijd_dag − eigen_tijd)
```

**Testgevallen:**

| Enkele reis | Bruto retour | Declarabel |
|---|---|---|
| 0 min | 0,00 | **0,00** |
| 35 min | 1,17 | **0,00** |
| 60 min | 2,00 | **0,00** |
| 61 min | 2,03 | **0,03** |
| 90 min | 3,00 | **1,00** |
| 135 min | 4,50 | **2,50** |
| 160 min | 5,33 | **3,33** |

**Meerdere afspraken op één dag:** neem de **langste** enkele reis van die dag × 2, en trek daar één keer de eigen tijd van af. Toon in de UI een melding: *"Meerdere afspraken op deze dag. De reistijd is berekend op basis van de verste bestemming — pas handmatig aan als de werkelijke route langer was."*

**Dagen zonder klantbezoek:** de 2-uursaftrek geldt niet. Reistijd naar bijvoorbeeld een netwerkbijeenkomst boek je als handmatige urenregel.

### 5.3 Uren per dag

```
werkuren_dag = Σ uren_op_locatie (afspraken met datum = dag, status ≠ geannuleerd)
             + Σ uren_voorbereiding (afspraken met voorbereiding_datum = dag,
                                     status ≠ geannuleerd OF voorbereiding_gedaan = true)
             + declarabele_reistijd_dag
             + Σ handmatige urenregels op die dag
```

Waarschuw bij `werkuren_dag > 12` (Arbeidstijdenwet-grens voor volwassenen).

**Voorbeeld — één training in Zwolle (enkele reis 60 min):**
```
op locatie          3,00
voorbereiding       3,00
reistijd  2,00 − 2,00 = 0,00
------------------------
totaal              6,00 uur
```

**Voorbeeld — één training in Utrecht (enkele reis 110 min):**
```
op locatie          3,00
voorbereiding       3,00
reistijd  3,67 − 2,00 = 1,67
------------------------
totaal              7,67 uur
```

**Voorbeeld — observatie in Hengelo (enkele reis 15 min), voorbereiding dag ervoor:**
```
Dag van de observatie:  3,50 op locatie + 0,00 reistijd = 3,50 uur
Dag ervoor:             1,00 voorbereiding              = 1,00 uur
```

### 5.4 Jaarurennorm-balans

**Stap 1 — persoonlijke norm:**
```
werktijdfactor        = uren_per_week ÷ 40
persoonlijke_jaarnorm = norm_fulltime (1659) × werktijdfactor
```

| Uren/week | wtf | Jaarnorm |
|---|---|---|
| 8 | 0,20 | 331,80 |
| 16 | 0,40 | 663,60 |
| 20 | 0,50 | 829,50 |
| 24 | 0,60 | 995,40 |
| 32 | 0,80 | 1.327,20 |
| 40 | 1,00 | 1.659,00 |

**Stap 2 — verdelen over inzetbare dagen, níet over 52 weken:**

De 1659 uur is 40 uur × 41,48 weken; de vakanties zitten er al uit. Zou je de norm over alle kalenderweken uitsmeren, dan lijkt het in juli alsof er achterstand is ontstaan.

```
inzetbare_dagen(periode) = aantal ma t/m vr in periode
                           − dagen in niet_inzetbare_dagen

verstreken_deel = inzetbare_dagen(1 jan .. vandaag)
                  ÷ inzetbare_dagen(1 jan .. 31 dec)

verwachte_uren  = persoonlijke_jaarnorm × verstreken_deel
saldo           = gerealiseerde_uren − verwachte_uren
```

Effect: de normlijn **staat stil tijdens schoolvakanties** en loopt tijdens schoolweken.

**Controle dat het model klopt.** De norm van 1659 uur staat gelijk aan 41,48 werkweken × 40 uur, oftewel **207,4 inzetbare dagen** per jaar. Reken je 2027 na met de vakantiedata van regio Noord, dan kom je uit op 261 weekdagen − 51 vakantiedagen = 210, minus circa vier losse feestdagen buiten de vakanties ≈ **206 dagen**. Dat sluit aan bij de 207,4 uit de norm. Vult de beheerder de tabel goed, dan komt de berekening dus vanzelf op het juiste aantal uit. Bouw hier een controle op: wijkt het aantal inzetbare dagen meer dan 5% af van 207,4, toon dan een waarschuwing dat de vakantiedata waarschijnlijk onvolledig zijn ingevoerd.

**Stap 3 — eerste jaar naar rato:**
```
norm_eerste_jaar = persoonlijke_jaarnorm
                 × inzetbare_dagen(ingangsdatum .. 31 dec)
                 ÷ inzetbare_dagen(1 jan .. 31 dec)
```

**Gepland versus gerealiseerd:**

| Kolom | Wat telt mee |
|---|---|
| Gepland | Alle afspraken met status `gepland` of `voltooid`, ook toekomstige |
| Gerealiseerd | Alleen status `voltooid`, plus alle handmatige urenregels |

Alleen **gerealiseerd** telt mee voor het saldo.

### 5.5 Statusregels

| Status | Locatie-uren tellen | Voorbereidingsuren tellen | Reistijd telt |
|---|---|---|---|
| `gepland` | alleen in kolom "gepland" | alleen in kolom "gepland" | alleen in "gepland" |
| `voltooid` | ja | ja | ja |
| `geannuleerd` | nee | alleen als `voorbereiding_gedaan = true` | nee |
| `verzet` | nee (telt bij de nieuwe afspraak) | alleen als `voorbereiding_gedaan = true` | nee |

### 5.6 Afronding

- Uren opslaan met 2 decimalen
- **Automatisch berekende** reistijd afronden op `reistijd_afronding_minuten` (standaard 5) vóór opslag. Handmatig ingevoerde reistijd blijft exact zoals ingevoerd — daarom kent testgeval 61 minuten in 5.2 geen afronding.
- Weergave in de interface: uren met komma als decimaalteken (`6,50`), nooit met punt
- Optioneel naast de decimale weergave ook `6u30` tonen

---

## 6. Schermen

### 6.1 Inloggen
E-mail + wachtwoord, "wachtwoord vergeten", optioneel TOTP-code. Na inloggen doorsturen op basis van rol.

### 6.2 Medewerker — hoofdscherm (`/afspraken`)

Tweekolomsindeling, minimaal 1280px breed.

**Links — afspraakformulier:**

| Veld | Type | Opmerking |
|---|---|---|
| Klant | Combobox met zoeken-tijdens-typen | Vanaf 2 tekens zoeken op naam en plaats; knop "nieuwe klant" opent een dialoog |
| Contactpersoon | Keuzelijst | Gefilterd op gekozen klant |
| Soort activiteit | Keuzelijst | Uit `activiteitsoorten` |
| Naam van de training | Tekst | Verplicht |
| Datum | Datumkiezer | dd-mm-jjjj |
| Dagdeel | Keuzerondjes | Ochtend / Middag / Hele dag / Anders |
| Anders, namelijk | Tekst | Alleen zichtbaar bij "Anders" |
| Datum voorbereiding | Datumkiezer | Standaard gelijk aan datum |
| Reistijd enkele reis | Getal, minuten | Voorgevuld vanuit de klant, aanpasbaar |
| Afspraken met klant | Tekstvak | Met privacywaarschuwing |
| Notities/memo | Tekstvak | Met privacywaarschuwing |
| Training voltooid | Vinkje | Zet status op `voltooid` |
| **Gegevens opslaan** | Knop | |

Onder het formulier een **live urenberekening** die meteen laat zien: `3,00 op locatie + 3,00 voorbereiding + 0,00 reistijd = 6,00 uur`.

**Rechts — permanente agenda:**
FullCalendar met knoppen voor maand, week en dag. Kleuren per activiteitsoort. Klikken op een afspraak laadt deze in het formulier. Vandaag gemarkeerd. Schoolvakanties met een grijze achtergrond.

**Boven — knoppenbalk:**
`Afspraken` · `Overzicht` · `Klanten` · `Mijn uren` · (bij beheerder) `Beheer`

### 6.3 Overzicht (`/overzicht`)

Chronologische tabel: datum · klant · plaats · soort · titel · uren · status.
Filters op periode, klant, soort en status. Sorteerbaar. Exporteren naar Excel en PDF.

### 6.4 Klanten (`/klanten`)

Zoekveld dat aanvult tijdens typen. Gekozen klant toont een kaart met:

- Schoolgegevens en adres
- Alle contactpersonen
- **Ingeplande trainingen** (toekomstig, status `gepland`)
- **Uitgevoerde trainingen** (status `voltooid`, aflopend op datum)
- Alle notities en afspraken uit eerdere bezoeken, chronologisch
- Reistijd en afstand vanaf de standplaats

### 6.5 Mijn uren (`/mijn-uren`)

Voor de medewerker: eigen uren per week, maand en jaar. Voortgangsbalk richting de jaarnorm. Mogelijkheid om handmatige urenregels toe te voegen (administratie, overleg, scholing).

### 6.6 Beheer (`/beheer`)

Alleen voor `beheerder`:

- **Medewerkers** — profielen aanmaken, uitnodigen per e-mail, contract met uren per week en ingangsdatum vastleggen
- **Urenverantwoording** — per medewerker en per periode: gepland versus gerealiseerd, saldo ten opzichte van de norm, uitsplitsing per categorie, grafiek met normlijn en werkelijke lijn
- **Activiteitsoorten** — uren per soort aanpassen
- **Niet-inzetbare dagen** — schoolvakanties en feestdagen per jaar invoeren
- **Instellingen** — eigen reistijd per dag, kilometervergoeding, afronding
- **Wijzigingslog** — alleen lezen
- **Export** — Excel en PDF per periode

---

## 7. Beveiliging

### Row Level Security

Op elke tabel RLS aanzetten. Basisregels:

| Tabel | Medewerker | Beheerder |
|---|---|---|
| `profielen` | alleen eigen rij lezen en beperkt bijwerken | alles |
| `contracten` | alleen eigen rij lezen | alles |
| `klanten` | lezen en schrijven | alles |
| `contactpersonen` | lezen en schrijven | alles |
| `afspraken` | alleen waar `medewerker_id` = eigen profiel | alles |
| `urenregels` | alleen waar `medewerker_id` = eigen profiel | alles |
| `activiteitsoorten` | alleen lezen | alles |
| `niet_inzetbare_dagen` | alleen lezen | alles |
| `instellingen` | alleen lezen | alles |
| `wijzigingslog` | geen toegang | alleen lezen |

Rol bepalen via een `security definer`-functie die `rol` uit `profielen` haalt op basis van `auth.uid()`. Rol nooit uit een JWT-claim halen die de client kan beïnvloeden.

### Overig

- Wachtwoord minimaal 12 tekens
- TOTP verplicht voor `beheerder`
- Sessieduur maximaal 12 uur
- Alle schrijfacties via server actions, nooit rechtstreeks vanuit de browser met de service-key
- De `service_role`-sleutel staat uitsluitend in serveromgevingsvariabelen, nooit in `NEXT_PUBLIC_*`
- HTTPS en HSTS afdwingen

---

## 8. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| **1** | Project opzetten, database, auth, RLS, rollen, nachtelijke back-up naar HiDrive | Je kunt inloggen en ziet een leeg dashboard |
| **2** | Klanten, contactpersonen, afspraakformulier, urenberekening per afspraak | Een training is vast te leggen |
| **3** | Agenda naast het formulier, chronologisch overzicht, klantkaart | Het hoofdscherm werkt zoals in 6.2 |
| **4** | Beheerdersportaal, contracten, urenverantwoording, jaarnormsaldo, export | De uren zijn te verantwoorden |
| **5** | Niet-inzetbare dagen, handmatige urenregels, eventueel automatische routeberekening | De urentotalen kloppen volledig |
| **6** | Domein koppelen, TOTP aan, betaalde tiers, AVG-documenten, echte gegevens invoeren | Live |
| Later | Verlof en ziekte (alleen indien nodig), onkosten- en kilometerdeclaratie | |

**Na elke fase:** commit, en laat de tests van hoofdstuk 5 draaien.

---

## 9. Testen

Verplichte geautomatiseerde tests vóór fase 4 als afgerond geldt:

1. Alle reistijd-testgevallen uit 5.2
2. De drie dagvoorbeelden uit 5.3
3. Alle werktijdfactor-combinaties uit 5.4
4. De statusmatrix uit 5.5 — elk van de vier statussen, met en zonder `voorbereiding_gedaan`
5. Berekening naar rato bij een indiensttreding op 1 maart, 1 juli en 1 oktober
6. Een jaar waarin een schoolvakantie op een feestdag valt (mag niet dubbel worden afgetrokken)
7. **Autorisatietest:** medewerker A mag op geen enkele manier bij de afspraken of uren van medewerker B

---

## 10. Wat expliciet niet in versie 1 zit

- Verlof-, ziekte- en feestdagregistratie
- Onkosten- en kilometerdeclaratie
- Facturatie aan scholen
- Mobiele app of telefooninvoer
- Koppeling met Outlook of Google Agenda
- Meerdere organisaties in één installatie

Komt er een verzoek dat hier onder valt: op de "later"-lijst, niet erbij bouwen.
