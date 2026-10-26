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
