-- Trainingen gedaan, factuur verstuurd en de weekmail, op verzoek van de
-- opdrachtgever (SPEC.md 4.12, 4.13 en 6.6).
--
-- - `verstuurde_facturen`: de beheerder vinkt bij een gedane training aan dat
--   hij de school een factuur heeft gestuurd. Het portaal maakt zelf geen
--   facturen (SPEC.md hoofdstuk 10); dit is alleen de registratie dat het is
--   gebeurd.
-- - `weekmails` en `weekmail_trainingen`: welke weekmails er zijn verstuurd en
--   welke gedane trainingen daarin stonden. Zo komt een training één keer in
--   de mail, ook als hij later opnieuw wordt afgevinkt.
--
-- Alleen de beheerder kan bij deze tabellen. De weekmail op maandagochtend
-- draait zonder ingelogde gebruiker en gebruikt daarvoor de geheime sleutel;
-- die gaat langs de beveiligingsregels heen.
--
-- Dit bestand kan zonder fout een tweede keer draaien.

-- ---------------------------------------------------------------------------
-- 1. Factuur verstuurd
-- ---------------------------------------------------------------------------

create table if not exists public.verstuurde_facturen (
  id               uuid primary key default gen_random_uuid(),
  -- Eén vinkje per training. Wordt de afspraak verwijderd, dan het vinkje ook.
  afspraak_id      uuid not null unique
                   references public.afspraken(id) on delete cascade,
  verstuurd_op     date not null,
  vastgelegd_door  uuid references public.profielen(id),
  aangemaakt_op    timestamptz not null default now(),
  gewijzigd_op     timestamptz
);

comment on table public.verstuurde_facturen is
  'Bij welke gedane training de beheerder een factuur heeft verstuurd (SPEC.md 4.12).';

create or replace trigger verstuurde_facturen_gewijzigd_op
  before update on public.verstuurde_facturen
  for each row execute function public.zet_gewijzigd_op();

-- Het gaat om geld: aanvinken en weer uitvinken komt in het wijzigingslog.
create or replace trigger verstuurde_facturen_wijzigingslog
  after insert or update or delete on public.verstuurde_facturen
  for each row execute function public.log_wijziging();

-- ---------------------------------------------------------------------------
-- 2. Weekmail
-- ---------------------------------------------------------------------------

create table if not exists public.weekmails (
  id                 uuid primary key default gen_random_uuid(),
  -- ISO-week waarin de mail ging, bijvoorbeeld '2026-W44'.
  week               text not null check (week ~ '^\d{4}-W\d{2}$'),
  -- true: de vaste mail op maandagochtend. false: met de knop in Beheer.
  automatisch        boolean not null,
  -- Leeg zolang de mail nog onderweg is.
  verzonden_op       timestamptz,
  aantal_trainingen  integer not null default 0 check (aantal_trainingen >= 0),
  aangemaakt_op      timestamptz not null default now(),
  gewijzigd_op       timestamptz
);

comment on table public.weekmails is
  'Verstuurde weekmails met de nieuwe gedane trainingen (SPEC.md 4.13).';

-- Hooguit één vaste maandagmail per week. Vercel roept het adres op maandag
-- twee keer aan (zomer- en wintertijd); dit voorkomt een dubbele mail.
create unique index if not exists weekmails_een_automatische_per_week
  on public.weekmails (week) where automatisch;

create or replace trigger weekmails_gewijzigd_op
  before update on public.weekmails
  for each row execute function public.zet_gewijzigd_op();

create table if not exists public.weekmail_trainingen (
  id             uuid primary key default gen_random_uuid(),
  weekmail_id    uuid not null references public.weekmails(id) on delete cascade,
  -- Eén keer melden is genoeg.
  afspraak_id    uuid not null unique
                 references public.afspraken(id) on delete cascade,
  aangemaakt_op  timestamptz not null default now(),
  gewijzigd_op   timestamptz
);

comment on table public.weekmail_trainingen is
  'Welke gedane training in welke weekmail stond (SPEC.md 4.13).';

create index if not exists weekmail_trainingen_weekmail_idx
  on public.weekmail_trainingen (weekmail_id);

create or replace trigger weekmail_trainingen_gewijzigd_op
  before update on public.weekmail_trainingen
  for each row execute function public.zet_gewijzigd_op();

-- ---------------------------------------------------------------------------
-- 3. Beveiliging: alleen de beheerder
-- ---------------------------------------------------------------------------

alter table public.verstuurde_facturen enable row level security;
alter table public.weekmails enable row level security;
alter table public.weekmail_trainingen enable row level security;

-- In een do-blok, zodat een tweede keer draaien geen fout geeft. Een
-- medewerker krijgt geen policy en ziet dus niets.
do $$
declare
  tabel text;
begin
  foreach tabel in array array['verstuurde_facturen', 'weekmails', 'weekmail_trainingen']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tabel
        and policyname = tabel || '_beheerder'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (public.is_beheerder()) with check (public.is_beheerder())',
        tabel || '_beheerder',
        tabel
      );
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Supabase laten weten dat er tabellen bij zijn
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
