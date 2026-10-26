-- Basisschema van het urenregistratie- en planningsportaal.
-- Volgt SPEC.md hoofdstuk 4. Alle tabel- en kolomnamen in het Nederlands,
-- snake_case, primaire sleutel `id uuid`.

-- ---------------------------------------------------------------------------
-- Hulpfunctie: `gewijzigd_op` bijwerken bij elke update.
-- ---------------------------------------------------------------------------

create or replace function public.zet_gewijzigd_op()
returns trigger
language plpgsql
as $$
begin
  new.gewijzigd_op := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4.1 profielen
-- ---------------------------------------------------------------------------

create table public.profielen (
  id                   uuid primary key default gen_random_uuid(),
  auth_gebruiker_id    uuid unique references auth.users(id) on delete cascade,
  voornaam             text not null,
  achternaam           text not null,
  email                text not null unique,
  telefoon             text,
  rol                  text not null check (rol in ('beheerder', 'medewerker')),
  standplaats_adres    text,
  standplaats_postcode text,
  standplaats_plaats   text,
  standplaats_lat      numeric(9, 6),
  standplaats_lng      numeric(9, 6),
  in_dienst_vanaf      date,
  uit_dienst_per       date,
  actief               boolean not null default true,
  aangemaakt_op        timestamptz not null default now(),
  gewijzigd_op         timestamptz,

  constraint profielen_dienstverband_op_volgorde
    check (uit_dienst_per is null or in_dienst_vanaf is null
           or uit_dienst_per >= in_dienst_vanaf)
);

create trigger profielen_gewijzigd_op
  before update on public.profielen
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.2 contracten
-- Meerdere per medewerker; bij urenwijziging een nieuw contract met een
-- nieuwe ingangsdatum. De persoonlijke jaarnorm wordt altijd berekend als
-- norm_fulltime × werktijdfactor en nooit los opgeslagen.
-- ---------------------------------------------------------------------------

create table public.contracten (
  id                      uuid primary key default gen_random_uuid(),
  profiel_id              uuid not null references public.profielen(id) on delete cascade,
  ingangsdatum            date not null,
  einddatum               date,
  uren_per_week           numeric(5, 2) not null check (uren_per_week > 0),
  -- 40 is de fulltime werkweek uit SPEC.md hoofdstuk 2; zie ook
  -- lib/uren/constants.ts, waar dezelfde deler staat.
  werktijdfactor          numeric(5, 4) generated always as (uren_per_week / 40) stored,
  norm_fulltime           numeric(7, 2) not null default 1659,
  referentieperiode_start date not null default '2026-01-01',
  aangemaakt_op           timestamptz not null default now(),
  gewijzigd_op            timestamptz,

  constraint contracten_looptijd_op_volgorde
    check (einddatum is null or einddatum >= ingangsdatum)
);

create index contracten_profiel_idx on public.contracten (profiel_id, ingangsdatum);

create trigger contracten_gewijzigd_op
  before update on public.contracten
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.3 klanten
-- ---------------------------------------------------------------------------

create table public.klanten (
  id                         uuid primary key default gen_random_uuid(),
  naam                       text not null,
  plaats                     text not null,
  adres                      text,
  postcode                   text,
  land                       text default 'NL',
  lat                        numeric(9, 6),
  lng                        numeric(9, 6),
  reistijd_enkel_minuten     integer check (reistijd_enkel_minuten >= 0),
  reisafstand_enkel_km       numeric(6, 1) check (reisafstand_enkel_km >= 0),
  reisgegevens_bijgewerkt_op timestamptz,
  telefoon_algemeen          text,
  email_algemeen             text,
  website                    text,
  notitie                    text,
  actief                     boolean not null default true,
  aangemaakt_door            uuid references public.profielen(id),
  aangemaakt_op              timestamptz not null default now(),
  gewijzigd_op               timestamptz
);

-- Voor het zoekveld met automatisch aanvullen (SPEC.md 4.3 en 6.2).
create index klanten_naam_idx on public.klanten (lower(naam));
create index klanten_plaats_idx on public.klanten (lower(plaats));

create trigger klanten_gewijzigd_op
  before update on public.klanten
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.4 contactpersonen
-- ---------------------------------------------------------------------------

create table public.contactpersonen (
  id            uuid primary key default gen_random_uuid(),
  klant_id      uuid not null references public.klanten(id) on delete cascade,
  naam          text not null,
  functie       text,
  telefoon      text,
  email         text,
  is_primair    boolean not null default false,
  notitie       text,
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op  timestamptz
);

create index contactpersonen_klant_idx on public.contactpersonen (klant_id);

-- Maximaal één primaire contactpersoon per klant (SPEC.md 4.4).
create unique index contactpersonen_een_primair_per_klant
  on public.contactpersonen (klant_id)
  where is_primair;

create trigger contactpersonen_gewijzigd_op
  before update on public.contactpersonen
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.5 activiteitsoorten
-- Instelbaar in het beheerdersportaal. De uren per soort staan hier en
-- nergens anders — nooit hardcoderen in de applicatiecode.
-- ---------------------------------------------------------------------------

create table public.activiteitsoorten (
  id                 uuid primary key default gen_random_uuid(),
  naam               text not null unique,
  uren_op_locatie    numeric(4, 2) not null check (uren_op_locatie >= 0),
  uren_voorbereiding numeric(4, 2) not null check (uren_voorbereiding >= 0),
  kleur              text not null default '#3b82f6',
  volgorde           integer not null default 0,
  handmatige_uren    boolean not null default false,
  actief             boolean not null default true,
  aangemaakt_op      timestamptz not null default now(),
  gewijzigd_op       timestamptz
);

create trigger activiteitsoorten_gewijzigd_op
  before update on public.activiteitsoorten
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.6 afspraken
-- ---------------------------------------------------------------------------

create table public.afspraken (
  id                     uuid primary key default gen_random_uuid(),
  klant_id               uuid not null references public.klanten(id),
  contactpersoon_id      uuid references public.contactpersonen(id) on delete set null,
  medewerker_id          uuid not null references public.profielen(id),
  activiteitsoort_id     uuid not null references public.activiteitsoorten(id),

  titel                  text not null,
  datum                  date not null,
  dagdeel                text not null
                         check (dagdeel in ('ochtend', 'middag', 'hele_dag', 'anders')),
  anders_omschrijving    text,
  starttijd              time,
  eindtijd               time,

  voorbereiding_datum    date not null,
  uren_op_locatie        numeric(4, 2) not null check (uren_op_locatie >= 0),
  uren_voorbereiding     numeric(4, 2) not null check (uren_voorbereiding >= 0),
  reistijd_enkel_minuten integer check (reistijd_enkel_minuten >= 0),
  reisafstand_enkel_km   numeric(6, 1) check (reisafstand_enkel_km >= 0),
  reisgegevens_bron      text check (reisgegevens_bron in ('automatisch', 'handmatig')),

  status                 text not null default 'gepland'
                         check (status in ('gepland', 'voltooid', 'geannuleerd', 'verzet')),
  voltooid_op            timestamptz,
  voorbereiding_gedaan   boolean not null default false,
  verzet_naar_id         uuid references public.afspraken(id) on delete set null,

  -- Alleen zakelijke afspraken. Geen namen of bijzonderheden van individuele
  -- leerlingen (SPEC.md 4.6).
  afspraken_met_klant    text,
  notitie                text,

  gewijzigd_door         uuid references public.profielen(id),
  aangemaakt_op          timestamptz not null default now(),
  gewijzigd_op           timestamptz,

  -- "Anders, namelijk" is verplicht zodra dagdeel op 'anders' staat.
  constraint afspraken_anders_toegelicht
    check (dagdeel <> 'anders' or coalesce(btrim(anders_omschrijving), '') <> ''),

  constraint afspraken_tijden_op_volgorde
    check (starttijd is null or eindtijd is null or eindtijd > starttijd),

  constraint afspraken_verzet_verwijst_naar_andere_afspraak
    check (verzet_naar_id is null or verzet_naar_id <> id)
);

create index afspraken_medewerker_datum_idx on public.afspraken (medewerker_id, datum);
create index afspraken_voorbereiding_idx on public.afspraken (medewerker_id, voorbereiding_datum);
create index afspraken_klant_idx on public.afspraken (klant_id, datum desc);

create trigger afspraken_gewijzigd_op
  before update on public.afspraken
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.7 urenregels
-- Alle uren komen hier samen: automatisch afgeleid uit afspraken én
-- handmatig geboekt.
-- ---------------------------------------------------------------------------

create table public.urenregels (
  id            uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.profielen(id),
  datum         date not null,
  afspraak_id   uuid references public.afspraken(id) on delete cascade,
  categorie     text not null check (categorie in (
                  'op_locatie', 'voorbereiding', 'reistijd', 'administratie',
                  'overleg', 'scholing', 'acquisitie', 'overig',
                  -- Nog niet in scope, alvast toegestaan zodat verlof- en
                  -- ziekteregistratie later geen migratie vraagt (SPEC.md 4.7).
                  'verlof', 'ziekte', 'feestdag')),
  uren          numeric(5, 2) not null check (uren >= 0),
  toelichting   text,
  bron          text not null check (bron in ('automatisch', 'handmatig')),
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op  timestamptz
);

create index urenregels_medewerker_datum_idx on public.urenregels (medewerker_id, datum);
create index urenregels_afspraak_idx on public.urenregels (afspraak_id);

create trigger urenregels_gewijzigd_op
  before update on public.urenregels
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.8 niet_inzetbare_dagen
-- Bepaalt over hoeveel dagen de jaarnorm wordt uitgesmeerd (SPEC.md 5.4).
-- Uren boeken op deze dagen blijft toegestaan.
-- ---------------------------------------------------------------------------

create table public.niet_inzetbare_dagen (
  id            uuid primary key default gen_random_uuid(),
  datum         date not null unique,
  soort         text not null check (soort in ('schoolvakantie', 'feestdag', 'overig')),
  omschrijving  text not null,
  regio         text not null default 'Noord',
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op  timestamptz
);

create index niet_inzetbare_dagen_datum_idx on public.niet_inzetbare_dagen (datum);

create trigger niet_inzetbare_dagen_gewijzigd_op
  before update on public.niet_inzetbare_dagen
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.9 instellingen — precies één rij.
-- ---------------------------------------------------------------------------

create table public.instellingen (
  id                            uuid primary key default gen_random_uuid(),
  -- Dwingt af dat er nooit meer dan één rij bestaat.
  enige_rij                     boolean not null default true,
  eigen_reistijd_uren_per_dag   numeric(4, 2) not null default 2.00
                                check (eigen_reistijd_uren_per_dag >= 0),
  kilometervergoeding_per_km    numeric(5, 3),
  reistijd_afronding_minuten    integer not null default 5
                                check (reistijd_afronding_minuten > 0),
  max_uren_per_dag_waarschuwing numeric(4, 2) not null default 12.00
                                check (max_uren_per_dag_waarschuwing > 0),
  aangemaakt_op                 timestamptz not null default now(),
  gewijzigd_op                  timestamptz,

  constraint instellingen_enige_rij_waar check (enige_rij),
  constraint instellingen_enige_rij_uniek unique (enige_rij)
);

create trigger instellingen_gewijzigd_op
  before update on public.instellingen
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 4.10 wijzigingslog — alleen leesbaar voor de beheerder, nooit bewerkbaar.
-- ---------------------------------------------------------------------------

create table public.wijzigingslog (
  id            uuid primary key default gen_random_uuid(),
  gebruiker_id  uuid references public.profielen(id),
  tabel         text not null,
  record_id     uuid not null,
  actie         text not null check (actie in ('insert', 'update', 'delete')),
  oude_waarde   jsonb,
  nieuwe_waarde jsonb,
  tijdstip      timestamptz not null default now(),
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op  timestamptz
);

create index wijzigingslog_record_idx on public.wijzigingslog (tabel, record_id, tijdstip desc);
