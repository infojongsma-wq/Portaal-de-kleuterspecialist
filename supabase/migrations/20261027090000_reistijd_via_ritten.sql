-- Reistijd uit de rittenregistratie, op verzoek van de opdrachtgever
-- (SPEC.md 4.11 en 5.2).
--
-- De reistijd hoort niet meer bij een afspraak, maar bij een gereden rit. Per
-- rit komen er twee kolommen bij:
--
-- - `reisduur_enkel_minuten`: de reisduur van de enkele reis volgens de
--   routeplanner, zonder files, afgerond op instellingen.reistijd_afronding_minuten.
--   Leeg als die niet bekend is.
-- - `afwijkende_reistijd_minuten`: de werkelijke reistijd van de hele rit (bij
--   vice versa heen en terug samen), als de medewerker die zelf invult, bij
--   files of een omleiding. Leeg als de berekende reisduur geldt.
--
-- De reistijdkolommen van `afspraken` blijven staan voor eerdere gegevens,
-- maar tellen niet meer mee voor de uren.
--
-- De beveiliging van `ritten` verandert niet. Dit bestand kan zonder fout een
-- tweede keer draaien.

alter table public.ritten
  add column if not exists reisduur_enkel_minuten integer
    check (reisduur_enkel_minuten >= 0 and reisduur_enkel_minuten <= 1440);

alter table public.ritten
  add column if not exists afwijkende_reistijd_minuten integer
    check (afwijkende_reistijd_minuten >= 0 and afwijkende_reistijd_minuten <= 1440);

comment on column public.ritten.reisduur_enkel_minuten is
  'Reisduur van de enkele reis volgens de routeplanner, zonder files (SPEC.md 5.2).';
comment on column public.ritten.afwijkende_reistijd_minuten is
  'Werkelijke reistijd van de hele rit, door de medewerker ingevuld (SPEC.md 5.2).';

-- Supabase laten weten dat er kolommen bij zijn.
notify pgrst, 'reload schema';
