# SPEC.md — Urenregistratie- en planningsportaal De Kleuterspecialist

> Dit is de functionele en technische specificatie. Claude Code: lees dit document voordat je code schrijft en verwijs bij twijfel terug naar het betreffende hoofdstuk.
> Versie 1.0 — augustus 2026

---

## 1. Doel en context

De Kleuterspecialist verzorgt trainingen en observaties bij basisscholen. Er is één medewerker in dienst (mogelijk later meer). Zij plant zelf haar afspraken met scholen, werkt vanuit huis en reist naar klanten.

De app moet vier dingen doen:

1. **Registreren** — afspraken vastleggen. Niet elke afspraak heeft een school: een afspraak is **op school** (training, observatie; uren automatisch berekend) of **anders** (literatuurstudie, overig, niet beschikbaar; uren zelf ingevuld). Zie 4.5.
2. **Plannen** — een agenda die laat zien wat wanneer staat gepland
3. **Verantwoorden** — een urenoverzicht dat aantoont dat de jaarurennorm gehaald wordt
4. **Ritten bijhouden** — gereden kilometers vastleggen voor de kilometervergoeding, per maand af te drukken of als Excel te downloaden (6.7)

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
| Afstanden | Google Maps Routes API, alleen vanaf de server; plaatsnamen en adressen voorstellen via de PDOK Locatieserver (5.7) |
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

De standplaats is het thuisadres van de medewerker. Zij stelt het zelf in op het tabblad Ritten (6.7).

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

Niet elke afspraak heeft een school. De soorten vallen in twee groepen:

- **Op school** (`handmatige_uren = false`) — Training en Observatie. De afspraak hoort bij een school. De uren liggen per soort vast en de reistijd volgt uit de school.
- **Anders** (`handmatige_uren = true`) — Literatuurstudie, Overig en Niet beschikbaar. Geen school, dus ook geen contactpersoon, geen voorbereiding en geen reistijd. De medewerker vult het aantal uren per afspraak zelf in.

```sql
id                 uuid primary key
naam               text not null unique
uren_op_locatie    numeric(4,2) not null              -- 0 bij 'anders'
uren_voorbereiding numeric(4,2) not null              -- 0 bij 'anders'
kleur              text not null default '#3b82f6'   -- voor de agenda
volgorde           integer not null default 0
handmatige_uren    boolean not null default false     -- true bij 'anders': geen school, uren zelf ingevuld
urencategorie      text check (urencategorie in
                     ('inlezen_trainingen','literatuur_lezen','overleg','overig'))
                                                      -- alleen bij 'anders': categorie van de uren (4.7)
telt_als_werktijd  boolean not null default true      -- false: wel in de agenda, telt nergens mee
actief             boolean not null default true
```

Startgegevens:

| naam | uren_op_locatie | uren_voorbereiding | handmatige_uren | urencategorie | telt_als_werktijd |
|---|---|---|---|---|---|
| Training | 3,00 | 3,00 | false | — | true |
| Observatie | 3,50 | 1,00 | false | — | true |
| Literatuurstudie | 0,00 | 0,00 | true | `literatuur_lezen` | true |
| Overig | 0,00 | 0,00 | true | `overig` | true |
| Niet beschikbaar | 0,00 | 0,00 | true | — | false |

Bij 'anders' staan de uren niet bij de soort maar bij de afspraak (4.6). De eerdere startsoort 'Anders', één soort met handmatige uren, is vervangen door deze drie.

Of een soort op school of anders is, ligt vast zodra er afspraken aan hangen. Wisselen zou de betekenis van die afspraken met terugwerkende kracht veranderen. `telt_als_werktijd` blijft wel te wijzigen en geldt dan ook voor bestaande afspraken.

### 4.6 `afspraken`

```sql
id                    uuid primary key
klant_id              uuid references klanten(id)   -- leeg bij een afspraak 'anders'
contactpersoon_id     uuid references contactpersonen(id)
medewerker_id         uuid not null references profielen(id)
activiteitsoort_id    uuid not null references activiteitsoorten(id)

titel                 text not null            -- naam van de training; bij 'anders' een omschrijving
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

**Op school of anders.** Of een afspraak een school heeft, volgt uit de soort (4.5):

- **Op school:** `klant_id` is verplicht. Uren en reistijd worden bij het opslaan overgenomen uit de soort en de school.
- **Anders:** `klant_id`, `contactpersoon_id`, de reisgegevens en `afspraken_met_klant` blijven leeg. De zelf ingevulde uren staan in `uren_op_locatie`, `uren_voorbereiding` is 0 en `voorbereiding_datum` is gelijk aan `datum`. Een datum is verplicht.

De database staat een lege `klant_id` toe. Dat een afspraak op school ook echt een school heeft, controleert de server bij het opslaan.

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
| `inlezen_trainingen` | ja |
| `literatuur_lezen` | ja |
| `administratie` | ja |
| `overleg` | ja |
| `scholing` | ja |
| `acquisitie` | ja |
| `overig` | ja |
| `verlof` | nee — later |
| `ziekte` | nee — later |
| `feestdag` | nee — later |

De laatste drie staan wel in de check-constraint zodat ze later zonder migratie te gebruiken zijn.

Uren van een afspraak 'anders' vallen onder de `urencategorie` van de soort (4.5): Literatuurstudie onder `literatuur_lezen`, Overig onder `overig`.

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
kilometervergoeding_per_km    numeric(5,3)     -- € 0,25; geldt voor nieuwe ritten (4.11)
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

Vullen met database-triggers op `afspraken`, `urenregels` en `ritten`. Alleen leesbaar voor de beheerder, nooit bewerkbaar.

### 4.11 `ritten`

Gereden ritten voor de kilometervergoeding, één rij per rit.

```sql
id                 uuid primary key
medewerker_id      uuid not null references profielen(id)
datum              date not null
doel               text not null                  -- doel van de rit
van_plaats         text not null                  -- plaats, adres, school met adres, of 'Thuis'
naar_plaats        text not null
heen_en_terug      boolean not null default false -- "vice versa": de km tellen dubbel
km_enkel           numeric(6,1) not null check (km_enkel > 0)
vergoeding_per_km  numeric(5,3) not null          -- vastgelegd bij het opslaan
```

- Van en naar zijn een plaats ("Hengelo"), een adres ("Schoolweg 5, 5678 CD Hengelo") of een school uit `klanten`, als naam met adres ("De Proeftuin, Schoolweg 5, 5678 CD Hengelo"). Naam en adres staan zo in de rit zelf, zodat ook later nog te zien is waar de rit heen ging. 'Thuis' staat voor het thuisadres van de medewerker: de standplaats in `profielen` (4.1).
- De vergoeding per km wordt bij het opslaan overgenomen uit `instellingen.kilometervergoeding_per_km`. Een latere wijziging van de vergoeding verandert eerdere ritten dus niet, net zoals bij de uren van een afspraak (4.6).
- Er is geen aparte tabel met plaatsen: de keuzelijst haalt de eerder gebruikte plaatsen uit de ritten zelf.

**Waarschuwing in de UI bij `doel`:** dezelfde privacywaarschuwing als bij de vrije tekstvelden van een afspraak (4.6).

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
| Literatuurstudie, Overig (anders) | — | — | **zelf ingevuld** |
| Niet beschikbaar (anders) | — | — | **telt niet mee** |

De voorbereidingsuren worden geboekt op `voorbereiding_datum`, de locatie-uren op `datum`. Standaard zijn die gelijk, maar ze mogen verschillen.

**Afspraken 'anders'** hebben geen school, dus geen voorbereiding en geen reistijd (5.2). De zelf ingevulde uren tellen op `datum`, in de urenverantwoording onder de `urencategorie` van de soort. Een soort met `telt_als_werktijd = false`, zoals Niet beschikbaar, staat wel in de agenda maar telt nergens mee: niet in de dagtotalen, niet in de reistijd, niet in de waarschuwing bij lange dagen en niet in de jaarnorm.

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

Bij een afspraak 'anders' staan de zelf ingevulde uren in `uren_op_locatie`; ze tellen dus mee in de eerste regel. Afspraken van een soort met `telt_als_werktijd = false` (Niet beschikbaar) tellen in geen enkele regel mee.

Waarschuw bij `werkuren_dag > 12` (Arbeidstijdenwet-grens voor volwassenen). Uren van Niet beschikbaar tellen daarbij niet mee.

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

**Voorbeeld — training zonder reistijd, 2,5 uur literatuurstudie en 4 uur niet beschikbaar op dezelfde dag:**
```
training op locatie       3,00
training voorbereiding    3,00
literatuurstudie          2,50
niet beschikbaar (4,00)   telt niet mee
------------------------
totaal                    8,50 uur
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

Dit geldt ook voor afspraken 'anders': Literatuurstudie en Overig tellen als gerealiseerd zodra ze als gedaan zijn afgevinkt. Niet beschikbaar telt in geen van beide kolommen.

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

### 5.7 Ritten en kilometervergoeding

```
km_rit      = km_enkel × 2   bij heen en terug ("vice versa")
            = km_enkel       anders
bedrag_rit  = km_rit × vergoeding_per_km, afgerond op hele centen
maandtotaal = Σ km_rit  en  Σ bedrag_rit
```

Het totaalbedrag is de som van de **afgeronde** bedragen per rit, niet het totaal aantal kilometers × de vergoeding. Zo tellen de regels in het overzicht en in de Excel precies op tot het totaal, ook als de vergoeding halverwege de maand is gewijzigd.

**Voorbeeldmaand (vergoeding € 0,25):**

| Rit | Km enkel | Heen en terug | Km | Bedrag |
|---|---|---|---|---|
| Thuis – Hengelo | 23,4 | ja | 46,8 | € 11,70 |
| Thuis – Zwolle | 10,1 | nee | 10,1 | € 2,53 (€ 2,525 naar boven) |
| Thuis – Zwolle | 10,1 | nee | 10,1 | € 2,53 |
| **Totaal** | | | **67,0** | **€ 16,76** |

67,0 × € 0,25 zou € 16,75 geven; de regels tellen op tot € 16,76, en dat is het totaal.

Kilometers worden met één decimaal opgeslagen. Een afstand uit de routeplanner, in meters, wordt afgerond op 0,1 km.

**De afstand automatisch bepalen**, zodra van en naar allebei gekozen zijn:

1. Is de route eerder gereden, in een van beide richtingen, dan de `km_enkel` van de meest recente rit over die route. Hoofdletters en spaties tellen bij het vergelijken niet mee. Een afstand die de medewerker zelf heeft verbeterd, komt zo vanzelf terug.
2. Anders de snelste route met de auto volgens Google Maps (Routes API), van adres tot adres. Bij een school het adres uit `klanten`; bij alleen een plaatsnaam het midden van die plaats. Voor Thuis het volledige thuisadres, zonder naam: op uitdrukkelijk verzoek van de opdrachtgever een uitzondering op de privacyafspraak in CLAUDE.md, zodat de kilometers van deur tot deur kloppen.
3. Liggen van en naar op hetzelfde punt, is er geen sleutel, of geeft Google geen antwoord, dan vult de medewerker de kilometers zelf in.

De medewerker kan de kilometers altijd aanpassen.

---

## 6. Schermen

### 6.1 Inloggen
E-mail + wachtwoord, "wachtwoord vergeten", optioneel TOTP-code. Na inloggen doorsturen op basis van rol.

### 6.2 Medewerker — hoofdscherm (`/afspraken`)

Tweekolomsindeling, minimaal 1280px breed.

**Links — afspraakformulier:**

Het formulier begint met de soort. Die bepaalt of de afspraak op school of anders is (4.5), en daarmee welke velden er verder staan.

| Veld | Type | Opmerking |
|---|---|---|
| Soort afspraak | Keuzelijst | Uit `activiteitsoorten`, in twee groepen: **Op school** en **Anders** |
| Klant | Combobox met zoeken-tijdens-typen | Alleen bij op school. Vanaf 2 tekens zoeken op naam en plaats; knop "nieuwe klant" opent een dialoog |
| Contactpersoon | Keuzelijst | Alleen bij op school. Gefilterd op gekozen klant |
| Naam van de training | Tekst | Verplicht. Bij anders heet dit veld "Omschrijving" |
| Datum | Datumkiezer | dd-mm-jjjj. Bij anders verplicht |
| Aantal uren | Getal | Alleen bij anders. Verplicht, behalve bij een soort die niet meetelt (Niet beschikbaar) |
| Dagdeel | Keuzerondjes | Ochtend / Middag / Hele dag / Anders |
| Anders, namelijk | Tekst | Alleen zichtbaar bij dagdeel "Anders" |
| Datum voorbereiding | Datumkiezer | Alleen bij op school. Standaard gelijk aan datum |
| Reistijd enkele reis | Getal, minuten | Alleen bij op school. Voorgevuld vanuit de klant, aanpasbaar |
| Afspraken met klant | Tekstvak | Alleen bij op school. Met privacywaarschuwing |
| Notities/memo | Tekstvak | Met privacywaarschuwing |
| Training voltooid | Vinkje | Zet status op `voltooid`. Bij anders heet dit "Gedaan"; ontbreekt bij een soort die niet meetelt |
| **Gegevens opslaan** | Knop | |

Onder het formulier een **live urenberekening** die meteen laat zien: `3,00 op locatie + 3,00 voorbereiding + 0,00 reistijd = 6,00 uur`.

**Rechts — permanente agenda:**
FullCalendar met knoppen voor maand, week en dag. Kleuren per activiteitsoort. Klikken op een afspraak laadt deze in het formulier. Vandaag gemarkeerd. Schoolvakanties met een grijze achtergrond.

**Boven — knoppenbalk:**
`Afspraken` · `Overzicht` · `Klanten` · `Mijn uren` · `Ritten` · (bij beheerder) `Beheer`

### 6.3 Overzicht (`/overzicht`)

Chronologische tabel: datum · klant · plaats · soort · titel · uren · status.
Filters op periode, klant, soort en status. Sorteerbaar. Exporteren naar Excel en PDF.

Bij afspraken 'anders' blijven klant en plaats leeg. Bij een soort die niet meetelt (Niet beschikbaar) staat "telt niet mee" in plaats van uren. In de Excel-export staan zelf ingevulde uren in een eigen kolom, naast op locatie, voorbereiding en reistijd.

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
- **Soorten afspraken** — per soort instellen of de uren vastliggen (op school: uren op locatie en voorbereiding) of dat de medewerker ze zelf invult (anders: onder welke urencategorie ze vallen en of ze meetellen als werktijd)
- **Niet-inzetbare dagen** — schoolvakanties en feestdagen per jaar invoeren
- **Ritten** — per maand per medewerker het aantal ritten, de kilometers en het bedrag, met een totaalregel. Per medewerker **Bekijken** (het tabblad Ritten van die medewerker, waar ook afdrukken kan) en **Excel** (6.7)
- **Instellingen** — eigen reistijd per dag, kilometervergoeding (aan te passen; geldt voor nieuwe ritten), afronding
- **Wijzigingslog** — alleen lezen
- **Export** — Excel en PDF per periode

### 6.7 Ritten (`/ritten`)

Tweekolomsindeling, net als het hoofdscherm. Zo eenvoudig dat iedereen het kan invullen.

**Links — thuisadres:** straat en huisnummer, postcode en woonplaats. De medewerker stelt dit zelf in; het staat in de standplaatsvelden van `profielen` (4.1). Voor de afstand gaat het, zonder naam, naar Google Maps (5.7); dat staat er ook bij.

**Links — nieuwe rit:**

| Veld | Type | Opmerking |
|---|---|---|
| Datum | Datumkiezer | dd-mm-jjjj, standaard vandaag |
| Doel van de rit | Tekst | Verplicht. Met privacywaarschuwing |
| Van | Keuzelijst met zoeken | Thuis bovenaan; daaronder de eerder gebruikte plaatsen en adressen, de vaakst gebruikte eerst. Tijdens het typen: scholen uit `klanten` met hun adres, Nederlandse woonplaatsen uit de PDOK Locatieserver (met de provincie erbij als een naam vaker voorkomt) en, zodra er een huisnummer in staat, adressen uit PDOK. Iets anders kan zoals getypt. Bij een nieuwe rit staat hier al Thuis |
| Naar | Keuzelijst met zoeken | Idem |
| Adres bij Van en bij Naar | Vier velden: Postcode, Huisnummer, Straat, Plaats | Onder de keuzelijst. Na postcode en huisnummer vult de app straat en plaats in uit de PDOK Locatieserver, zoals bij een webwinkel. Bij Thuis en bij een school staan de velden vast ingevuld; **Ander adres invullen** maakt ze leeg. Een adres over de grens kan met straat, huisnummer en plaats. In de rit komt één regel: "Schoolweg 5, 5678 CD Hengelo" |
| Vice versa (heen en terug) | Vinkje | De kilometers tellen dubbel |
| Kilometers (enkele reis) | Getal | Vult zich vanzelf (5.7), aanpasbaar |
| **Rit opslaan** | Knop | |

Onder het formulier staat meteen het totaal: `46,8 km · € 11,70`.

**Rechts:** de ritten van de gekozen maand, met pijltjes naar de vorige en volgende maand. Per rit: datum, doel, van – naar, km en bedrag, met wijzigen en verwijderen (na bevestiging). Onderaan het totaal aantal km en het totaalbedrag van de maand.

Twee knoppen voor de gekozen maand, op elk moment, ook halverwege de maand:

- **Afdrukken** — het maandoverzicht op papier, met een kop: naam, maand, thuisadres, vergoeding en de datum van afdrukken. Via het afdrukvenster ook als PDF te bewaren.
- **Excel downloaden** — één blad met een kop (naam, thuisadres, vergoeding, datum), de kolommen Datum · Doel van de rit · Van · Naar · Heen en terug · Km enkele reis · Km totaal · Vergoeding per km · Bedrag, en een totaalregel. Getallen als getal met Nederlandse opmaak; ingesteld op A4 liggend, één pagina breed.

**Beheerder:** kiest bovenaan van welke medewerker hij de ritten bekijkt, afdrukt en downloadt. Wijzigen doet de medewerker zelf, net als bij de afspraken.

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
| `ritten` | alleen waar `medewerker_id` = eigen profiel | alles |
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
| Later | Verlof en ziekte (alleen indien nodig), onkostendeclaratie | |

**Na elke fase:** commit, en laat de tests van hoofdstuk 5 draaien.

---

## 9. Testen

Verplichte geautomatiseerde tests vóór fase 4 als afgerond geldt:

1. Alle reistijd-testgevallen uit 5.2
2. De vier dagvoorbeelden uit 5.3
3. Alle werktijdfactor-combinaties uit 5.4
4. De statusmatrix uit 5.5 — elk van de vier statussen, met en zonder `voorbereiding_gedaan`
5. Berekening naar rato bij een indiensttreding op 1 maart, 1 juli en 1 oktober
6. Een jaar waarin een schoolvakantie op een feestdag valt (mag niet dubbel worden afgetrokken)
7. **Autorisatietest:** medewerker A mag op geen enkele manier bij de afspraken of uren van medewerker B
8. Afspraken 'anders' (5.1 en 5.3): zelf ingevulde uren tellen mee zonder voorbereiding en reistijd; Niet beschikbaar telt nergens mee, ook niet in de waarschuwing bij meer dan 12 uur
9. Ritten (5.7): de km bij heen en terug, het bedrag per rit op centen, de voorbeeldmaand, en het terugvinden van een eerder gereden route in beide richtingen. De autorisatietest uit punt 7 geldt ook voor ritten

---

## 10. Wat expliciet niet in versie 1 zit

- Verlof-, ziekte- en feestdagregistratie
- Onkostendeclaratie. De rittenregistratie met kilometervergoeding zit er wél in (6.7)
- Facturatie aan scholen
- Mobiele app of telefooninvoer
- Koppeling met Outlook of Google Agenda
- Meerdere organisaties in één installatie

Komt er een verzoek dat hier onder valt: op de "later"-lijst, niet erbij bouwen.
