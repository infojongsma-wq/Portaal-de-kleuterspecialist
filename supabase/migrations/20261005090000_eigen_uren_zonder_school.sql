-- Drie soorten afspraken waarvoor de medewerker zelf de uren invult:
-- Literatuurstudie, Overig en Niet beschikbaar (op verzoek van de
-- opdrachtgever).
--
-- Daarvoor is nodig:
--
--  1. Een afspraak hoeft niet meer aan een school te hangen. Literatuurstudie
--     en "niet beschikbaar" gebeuren niet op een school. Dat een training of
--     observatie wél een school heeft, bewaakt de server action.
--
--  2. Per soort: onder welke urencategorie de zelf ingevulde uren vallen, en
--     of ze meetellen als gewerkte tijd. "Niet beschikbaar" is geen werk: het
--     staat in de agenda, maar telt niet mee voor de jaarnorm. De beheerder
--     kan dat per soort wijzigen.
--
-- LET OP: SPEC.md 4.6 noemt klant_id nog verplicht.

-- ---------------------------------------------------------------------------
-- 1. School niet meer verplicht
-- ---------------------------------------------------------------------------

alter table public.afspraken
  alter column klant_id drop not null;

comment on column public.afspraken.klant_id is
  'Leeg bij soorten zonder school, zoals literatuurstudie of niet beschikbaar.';

-- ---------------------------------------------------------------------------
-- 2. Waar de uren heen gaan, en of ze tellen
-- ---------------------------------------------------------------------------

-- "if not exists": wie dit per ongeluk twee keer in de SQL Editor draait,
-- krijgt geen foutmelding en geen dubbele kolommen.
alter table public.activiteitsoorten
  add column if not exists urencategorie text
    check (urencategorie in
      ('inlezen_trainingen', 'literatuur_lezen', 'overleg', 'overig')),
  add column if not exists telt_als_werktijd boolean not null default true;

comment on column public.activiteitsoorten.urencategorie is
  'Alleen bij handmatige uren: onder welke categorie de zelf ingevulde uren in de urenverantwoording vallen.';

comment on column public.activiteitsoorten.telt_als_werktijd is
  'Tellen de uren mee als gewerkte tijd? Uit bij bijvoorbeeld "Niet beschikbaar": wel in de agenda, niet in de jaarnorm.';

-- ---------------------------------------------------------------------------
-- 3. De drie nieuwe soorten
-- ---------------------------------------------------------------------------

insert into public.activiteitsoorten
  (naam, uren_op_locatie, uren_voorbereiding, kleur, volgorde,
   handmatige_uren, urencategorie, telt_als_werktijd)
values
  ('Literatuurstudie', 0, 0, '#94ab68', 30, true, 'literatuur_lezen', true),
  ('Overig',           0, 0, '#3a673a', 40, true, 'overig',           true),
  ('Niet beschikbaar', 0, 0, '#a8a29e', 50, true, null,               false)
on conflict (naam) do nothing;

-- De oude soort 'Anders' had ook zelf ingevulde uren, maar is in 20260914090000
-- al opgeruimd voor zover er niets aan hing. Staat hij er nog, dan zou hij nu
-- naast 'Overig' in het menu verschijnen. Op non-actief, zodat eerdere
-- afspraken hun soort houden.
update public.activiteitsoorten
set actief = false
where naam = 'Anders'
  and handmatige_uren;
