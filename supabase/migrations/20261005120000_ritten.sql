-- Rittenregistratie, op verzoek van de opdrachtgever.
--
-- De medewerker legt per rit vast: de datum, het doel, van welke plaats naar
-- welke plaats, of het heen en terug was ("vice versa"), en de kilometers van
-- de enkele reis. De vergoeding per kilometer wordt bij het opslaan
-- overgenomen uit `instellingen`. Zo verandert een latere tariefwijziging
-- eerdere maanden niet; zo gaat het ook met de uren van een afspraak
-- (SPEC.md 4.6).
--
-- Het thuisadres staat al in `profielen` (standplaats_adres, _postcode en
-- _plaats). Daarvoor is niets nieuws nodig.
--
-- Dit bestand kan zonder fout een tweede keer draaien.

-- ---------------------------------------------------------------------------
-- 1. De tabel
-- ---------------------------------------------------------------------------

create table if not exists public.ritten (
  id                 uuid primary key default gen_random_uuid(),
  medewerker_id      uuid not null references public.profielen(id),
  datum              date not null,
  doel               text not null check (btrim(doel) <> ''),
  van_plaats         text not null check (btrim(van_plaats) <> ''),
  naar_plaats        text not null check (btrim(naar_plaats) <> ''),
  -- "Vice versa": heen en terug. De kilometers tellen dan dubbel.
  heen_en_terug      boolean not null default false,
  -- De enkele reis.
  km_enkel           numeric(6, 1) not null check (km_enkel > 0),
  -- Vastgelegd bij het opslaan, uit instellingen.kilometervergoeding_per_km.
  vergoeding_per_km  numeric(5, 3) not null check (vergoeding_per_km >= 0),
  aangemaakt_op      timestamptz not null default now(),
  gewijzigd_op       timestamptz
);

comment on table public.ritten is
  'Gereden ritten voor de kilometervergoeding (SPEC.md 4.11).';

create index if not exists ritten_medewerker_datum_idx
  on public.ritten (medewerker_id, datum);

create or replace trigger ritten_gewijzigd_op
  before update on public.ritten
  for each row execute function public.zet_gewijzigd_op();

-- Een vergoeding is geld: elke wijziging komt in het wijzigingslog, net als
-- bij afspraken en urenregels (SPEC.md 4.10).
create or replace trigger ritten_wijzigingslog
  after insert or update or delete on public.ritten
  for each row execute function public.log_wijziging();

-- ---------------------------------------------------------------------------
-- 2. Beveiliging: alleen de eigen ritten, de beheerder alles
-- ---------------------------------------------------------------------------

alter table public.ritten enable row level security;

-- In een do-blok, zodat een tweede keer draaien geen fout geeft.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ritten'
      and policyname = 'ritten_lezen_eigen'
  ) then
    create policy ritten_lezen_eigen on public.ritten
      for select to authenticated
      using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ritten'
      and policyname = 'ritten_toevoegen_eigen'
  ) then
    create policy ritten_toevoegen_eigen on public.ritten
      for insert to authenticated
      with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());
  end if;

  -- `using` houdt andermans ritten buiten bereik, `with check` voorkomt dat een
  -- eigen rit op naam van een ander wordt gezet.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ritten'
      and policyname = 'ritten_bijwerken_eigen'
  ) then
    create policy ritten_bijwerken_eigen on public.ritten
      for update to authenticated
      using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder())
      with check (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ritten'
      and policyname = 'ritten_verwijderen_eigen'
  ) then
    create policy ritten_verwijderen_eigen on public.ritten
      for delete to authenticated
      using (medewerker_id = public.huidig_profiel_id() or public.is_beheerder());
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Het tarief
-- ---------------------------------------------------------------------------

-- € 0,25 per km, zoals de opdrachtgever opgaf. Alleen als er nog niets staat;
-- daarna past de beheerder het aan in Beheer → Instellingen.
update public.instellingen
set kilometervergoeding_per_km = 0.25
where kilometervergoeding_per_km is null;
