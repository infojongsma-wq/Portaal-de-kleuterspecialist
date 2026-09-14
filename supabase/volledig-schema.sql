-- ============================================================================
-- Portaal De Kleuterspecialist — volledige database in één keer
-- ============================================================================
--
-- Plak dit hele bestand in de SQL Editor van een LEEG Supabase-project en
-- klik op Run. Daarmee staat de database in één keer goed.
--
-- Dit bestand is samengesteld uit de losse bestanden in `migrations/`, in
-- volgorde. Gebruik óf dit bestand, óf `npx supabase db push` met de losse
-- migraties — niet allebei, want dan probeert de tweede wat de eerste al
-- gedaan heeft.
--
-- Onderdelen:
--   1. 20260803120000_basisschema.sql
--   2. 20260803120100_wijzigingslog.sql
--   3. 20260803120200_rls.sql
--   4. 20260803120300_startgegevens.sql
--   5. 20260803150000_dagdelen_en_ongeplande_afspraken.sql
--   6. 20260914090000_urencategorieen_en_observatie.sql
--
-- ============================================================================



-- ============================================================================
-- UIT: 20260803120000_basisschema.sql
-- ============================================================================

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


-- ============================================================================
-- UIT: 20260803120100_wijzigingslog.sql
-- ============================================================================

-- Wijzigingslog vullen met triggers op `afspraken` en `urenregels`
-- (SPEC.md 4.10). De log is alleen leesbaar voor de beheerder en wordt nooit
-- vanuit de applicatie geschreven.

create or replace function public.log_wijziging()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profiel uuid;
begin
  -- De gebruiker die de wijziging doet, herleid via het profiel. Blijft null
  -- bij acties zonder ingelogde gebruiker, bijvoorbeeld een migratie.
  select id into profiel from public.profielen where auth_gebruiker_id = auth.uid();

  if tg_op = 'DELETE' then
    insert into public.wijzigingslog (gebruiker_id, tabel, record_id, actie, oude_waarde)
    values (profiel, tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.wijzigingslog (gebruiker_id, tabel, record_id, actie, oude_waarde, nieuwe_waarde)
    values (profiel, tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.wijzigingslog (gebruiker_id, tabel, record_id, actie, nieuwe_waarde)
    values (profiel, tg_table_name, new.id, 'insert', to_jsonb(new));
    return new;
  end if;
end;
$$;

create trigger afspraken_wijzigingslog
  after insert or update or delete on public.afspraken
  for each row execute function public.log_wijziging();

create trigger urenregels_wijzigingslog
  after insert or update or delete on public.urenregels
  for each row execute function public.log_wijziging();


-- ============================================================================
-- UIT: 20260803120200_rls.sql
-- ============================================================================

-- Row Level Security (SPEC.md hoofdstuk 7).
--
-- Op elke tabel staat RLS aan. Een tabel zonder policy is een bug.
--
-- De rol van de gebruiker komt uit `profielen`, opgehaald via een
-- `security definer`-functie. Nooit uit een JWT-claim die de client zelf kan
-- zetten.

-- ---------------------------------------------------------------------------
-- Hulpfuncties.
--
-- `security definer` is hier nodig: de functies lezen `profielen` terwijl op
-- die tabel zelf ook RLS staat. Zonder definer-rechten zou de policy op
-- profielen zichzelf aanroepen en oneindig doorlopen.
-- ---------------------------------------------------------------------------

create or replace function public.huidig_profiel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profielen where auth_gebruiker_id = auth.uid();
$$;

create or replace function public.is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profielen
    where auth_gebruiker_id = auth.uid()
      and rol = 'beheerder'
      and actief
  );
$$;

revoke execute on function public.huidig_profiel_id() from public;
revoke execute on function public.is_beheerder() from public;
grant execute on function public.huidig_profiel_id() to authenticated;
grant execute on function public.is_beheerder() to authenticated;

-- ---------------------------------------------------------------------------
-- Een medewerker mag het eigen profiel bijwerken, maar niet de velden die over
-- de arbeidsrelatie gaan. RLS werkt niet op kolomniveau, dus dat gaat via een
-- trigger (SPEC.md 7, "alleen eigen rij lezen en beperkt bijwerken").
-- ---------------------------------------------------------------------------

create or replace function public.bewaak_profielvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_beheerder() then
    return new;
  end if;

  if new.rol is distinct from old.rol
     or new.actief is distinct from old.actief
     or new.in_dienst_vanaf is distinct from old.in_dienst_vanaf
     or new.uit_dienst_per is distinct from old.uit_dienst_per
     or new.email is distinct from old.email
     or new.auth_gebruiker_id is distinct from old.auth_gebruiker_id then
    raise exception
      'Rol, dienstverband, e-mailadres en account kunnen alleen door een beheerder worden gewijzigd.';
  end if;

  return new;
end;
$$;

create trigger profielen_bewaak_velden
  before update on public.profielen
  for each row execute function public.bewaak_profielvelden();

-- ---------------------------------------------------------------------------
-- RLS aanzetten op alle tabellen.
-- ---------------------------------------------------------------------------

alter table public.profielen            enable row level security;
alter table public.contracten           enable row level security;
alter table public.klanten              enable row level security;
alter table public.contactpersonen      enable row level security;
alter table public.activiteitsoorten    enable row level security;
alter table public.afspraken            enable row level security;
alter table public.urenregels           enable row level security;
alter table public.niet_inzetbare_dagen enable row level security;
alter table public.instellingen         enable row level security;
alter table public.wijzigingslog        enable row level security;

-- ---------------------------------------------------------------------------
-- profielen — medewerker leest de eigen rij en werkt die beperkt bij.
-- ---------------------------------------------------------------------------

create policy profielen_lezen_eigen on public.profielen
  for select to authenticated
  using (auth_gebruiker_id = auth.uid() or public.is_beheerder());

create policy profielen_bijwerken_eigen on public.profielen
  for update to authenticated
  using (auth_gebruiker_id = auth.uid() or public.is_beheerder())
  with check (auth_gebruiker_id = auth.uid() or public.is_beheerder());

create policy profielen_beheerder_toevoegen on public.profielen
  for insert to authenticated
  with check (public.is_beheerder());

create policy profielen_beheerder_verwijderen on public.profielen
  for delete to authenticated
  using (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- contracten — medewerker leest alleen het eigen contract.
-- ---------------------------------------------------------------------------

create policy contracten_lezen_eigen on public.contracten
  for select to authenticated
  using (profiel_id = public.huidig_profiel_id() or public.is_beheerder());

create policy contracten_beheerder_schrijven on public.contracten
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- klanten en contactpersonen — gedeeld; iedere ingelogde medewerker leest en
-- schrijft (SPEC.md 7).
-- ---------------------------------------------------------------------------

create policy klanten_lezen on public.klanten
  for select to authenticated
  using (true);

create policy klanten_schrijven on public.klanten
  for insert to authenticated
  with check (true);

create policy klanten_bijwerken on public.klanten
  for update to authenticated
  using (true)
  with check (true);

-- Verwijderen blijft bij de beheerder: klanten hangen aan afspraken en uren.
create policy klanten_beheerder_verwijderen on public.klanten
  for delete to authenticated
  using (public.is_beheerder());

create policy contactpersonen_lezen on public.contactpersonen
  for select to authenticated
  using (true);

create policy contactpersonen_schrijven on public.contactpersonen
  for insert to authenticated
  with check (true);

create policy contactpersonen_bijwerken on public.contactpersonen
  for update to authenticated
  using (true)
  with check (true);

create policy contactpersonen_verwijderen on public.contactpersonen
  for delete to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- afspraken — alleen de eigen afspraken (SPEC.md 7 en testeis 9.7).
-- ---------------------------------------------------------------------------

create policy afspraken_lezen_eigen on public.afspraken
  for select to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

create policy afspraken_toevoegen_eigen on public.afspraken
  for insert to authenticated
  with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

-- `using` houdt andermans rijen buiten bereik, `with check` voorkomt dat een
-- eigen afspraak op naam van een ander wordt gezet.
create policy afspraken_bijwerken_eigen on public.afspraken
  for update to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder())
  with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

create policy afspraken_verwijderen_eigen on public.afspraken
  for delete to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- urenregels — alleen de eigen uren.
-- ---------------------------------------------------------------------------

create policy urenregels_lezen_eigen on public.urenregels
  for select to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

create policy urenregels_toevoegen_eigen on public.urenregels
  for insert to authenticated
  with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

create policy urenregels_bijwerken_eigen on public.urenregels
  for update to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder())
  with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

create policy urenregels_verwijderen_eigen on public.urenregels
  for delete to authenticated
  using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Stamgegevens — medewerker leest, beheerder beheert.
-- ---------------------------------------------------------------------------

create policy activiteitsoorten_lezen on public.activiteitsoorten
  for select to authenticated
  using (true);

create policy activiteitsoorten_beheerder_schrijven on public.activiteitsoorten
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

create policy niet_inzetbare_dagen_lezen on public.niet_inzetbare_dagen
  for select to authenticated
  using (true);

create policy niet_inzetbare_dagen_beheerder_schrijven on public.niet_inzetbare_dagen
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

create policy instellingen_lezen on public.instellingen
  for select to authenticated
  using (true);

create policy instellingen_beheerder_schrijven on public.instellingen
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- wijzigingslog — beheerder leest, niemand schrijft of wijzigt.
-- Vullen gebeurt uitsluitend via de `security definer`-trigger.
-- ---------------------------------------------------------------------------

create policy wijzigingslog_beheerder_lezen on public.wijzigingslog
  for select to authenticated
  using (public.is_beheerder());


-- ============================================================================
-- UIT: 20260803120300_startgegevens.sql
-- ============================================================================

-- Startgegevens: de waarden die de applicatie nodig heeft om te kunnen rekenen
-- (SPEC.md 4.5 en 4.9). Geen persoonsgegevens.

-- Activiteitsoorten (SPEC.md 4.5). De uren staan hier en nergens anders;
-- de beheerder past ze aan in het beheerdersportaal.
insert into public.activiteitsoorten
  (naam, uren_op_locatie, uren_voorbereiding, kleur, volgorde, handmatige_uren)
values
  ('Training',   3.00, 3.00, '#2563eb', 10, false),
  ('Observatie', 3.50, 0.50, '#16a34a', 20, false),
  ('Anders',     0.00, 0.00, '#78716c', 30, true)
on conflict (naam) do nothing;

-- De enige rij met instellingen (SPEC.md 4.9).
insert into public.instellingen
  (eigen_reistijd_uren_per_dag, reistijd_afronding_minuten, max_uren_per_dag_waarschuwing)
values
  (2.00, 5, 12.00)
on conflict (enige_rij) do nothing;


-- ============================================================================
-- UIT: 20260803150000_dagdelen_en_ongeplande_afspraken.sql
-- ============================================================================

-- Twee wijzigingen aan `afspraken` op verzoek van de opdrachtgever.
--
-- 1. Een afspraak kan meerdere dagdelen beslaan. `dagdeel` wordt daarom een
--    lijst. "Hele dag" is geen aparte waarde meer: dat is ochtend én middag,
--    zodat er geen tegenstrijdige invoer kan ontstaan.
--
-- 2. Een training kan met de school zijn afgesproken zonder dat er al een
--    datum is — "nog in te plannen". Zulke afspraken hebben geen datum en
--    tellen nergens in mee tot die is ingevuld.

-- ---------------------------------------------------------------------------
-- 1. dagdeel wordt dagdelen
-- ---------------------------------------------------------------------------

alter table public.afspraken
  add column dagdelen text[];

-- Bestaande rijen omzetten; 'hele_dag' wordt ochtend plus middag.
update public.afspraken
set dagdelen = case dagdeel
  when 'hele_dag' then array['ochtend', 'middag']
  else array[dagdeel]
end;

alter table public.afspraken
  alter column dagdelen set not null,
  drop constraint afspraken_anders_toegelicht,
  drop column dagdeel;

alter table public.afspraken
  add constraint afspraken_dagdelen_niet_leeg
    check (array_length(dagdelen, 1) >= 1),
  add constraint afspraken_dagdelen_toegestaan
    check (dagdelen <@ array['ochtend', 'middag', 'anders']),
  -- "Anders, namelijk" blijft verplicht zodra 'anders' is aangevinkt.
  add constraint afspraken_anders_toegelicht
    check ('anders' <> all (dagdelen)
           or coalesce(btrim(anders_omschrijving), '') <> '');

-- ---------------------------------------------------------------------------
-- 2. Afspraken zonder datum
-- ---------------------------------------------------------------------------

alter table public.afspraken
  alter column datum drop not null,
  alter column voorbereiding_datum drop not null;

-- Zonder datum is er ook geen voorbereidingsdatum, en andersom hoort een
-- ingeplande afspraak er altijd een te hebben.
alter table public.afspraken
  add constraint afspraken_datums_horen_bij_elkaar
    check ((datum is null) = (voorbereiding_datum is null));

-- Een afspraak zonder datum kan niet voltooid of verzet zijn.
alter table public.afspraken
  add constraint afspraken_zonder_datum_is_gepland
    check (datum is not null or status in ('gepland', 'geannuleerd'));

comment on column public.afspraken.datum is
  'Dag van het bezoek. NULL betekent: met de school afgesproken, nog in te plannen.';

-- Voor de lijst "afgesproken trainingen" per school.
create index afspraken_klant_ongepland_idx
  on public.afspraken (klant_id)
  where datum is null;


-- ============================================================================
-- UIT: 20260914090000_urencategorieen_en_observatie.sql
-- ============================================================================

-- Twee wijzigingen op verzoek van de opdrachtgever.
--
-- 1. De medewerker boekt handmatige uren in vijf categorieën: inlezen
--    trainingen, literatuur lezen, overleg, reistijd boven het uur enkele
--    reis, en overig. De eerste twee bestonden nog niet.
--
-- 2. Een observatie kost 1 uur voorbereiding in plaats van een half uur.
--    LET OP: SPEC.md hoofdstuk 2 en 5.1 noemen nog 0,50. De waarde staat in
--    de database en niet in de code, dus dit is een instelling en geen
--    codewijziging — maar SPEC.md wijkt er nu van af.

-- ---------------------------------------------------------------------------
-- 1. Nieuwe categorieën
-- ---------------------------------------------------------------------------

alter table public.urenregels
  drop constraint urenregels_categorie_check;

alter table public.urenregels
  add constraint urenregels_categorie_check check (categorie in (
    -- Afgeleid uit afspraken; niet handmatig te boeken.
    'op_locatie', 'voorbereiding', 'reistijd',
    -- Handmatig te boeken door de medewerker.
    'inlezen_trainingen', 'literatuur_lezen', 'overleg', 'overig',
    -- Bestaande categorieën; blijven geldig voor eerder geboekte uren.
    'administratie', 'scholing', 'acquisitie',
    -- Nog niet in scope, alvast toegestaan (SPEC.md 4.7).
    'verlof', 'ziekte', 'feestdag'));

comment on column public.urenregels.categorie is
  'Reistijd die handmatig wordt geboekt betreft de reistijd boven het uur enkele reis; zie SPEC.md 5.2.';

-- ---------------------------------------------------------------------------
-- 2. Voorbereidingstijd van een observatie
-- ---------------------------------------------------------------------------

update public.activiteitsoorten
set uren_voorbereiding = 1.00
where naam = 'Observatie';

-- Bestaande afspraken houden de uren waarmee ze zijn vastgelegd (SPEC.md 4.6);
-- die worden hier dus bewust niet bijgewerkt.

-- ---------------------------------------------------------------------------
-- 3. Opruimen: de soort 'Anders'
--
-- Die bestond om de uren handmatig in te vullen, maar de medewerker ziet de
-- urenvelden niet meer en kan de soort dus niet kiezen. Alleen weghalen als er
-- geen enkele afspraak aan hangt; anders zou de herkomst van geboekte uren
-- verdwijnen.
-- ---------------------------------------------------------------------------

delete from public.activiteitsoorten
where naam = 'Anders'
  and not exists (
    select 1 from public.afspraken
    where afspraken.activiteitsoort_id = activiteitsoorten.id
  );

-- ---------------------------------------------------------------------------
-- 4. Kleuren uit de huisstijl
-- ---------------------------------------------------------------------------

update public.activiteitsoorten set kleur = '#026666' where naam = 'Training';
update public.activiteitsoorten set kleur = '#95c11f' where naam = 'Observatie';
