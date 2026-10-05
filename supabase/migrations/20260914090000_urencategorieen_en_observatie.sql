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
