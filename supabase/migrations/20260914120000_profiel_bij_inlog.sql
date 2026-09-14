-- Een account in Supabase Auth en een rij in `profielen` zijn twee
-- verschillende dingen. Zonder die tweede kan de app niets: de rol, de
-- standplaats en het contract hangen eraan, en alle RLS-policies leiden er hun
-- antwoord uit af.
--
-- Deze trigger maakt het profiel aan zodra er een account bijkomt, zodat
-- inloggen nooit eindigt in een leeg scherm.

create or replace function public.maak_profiel_bij_nieuwe_gebruiker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bestaande_profielen integer;
  toegekende_rol text;
  gekozen_voornaam text;
  gekozen_achternaam text;
begin
  select count(*) into bestaande_profielen from public.profielen;

  -- De eerste die inlogt is de eigenaar en wordt beheerder. Iedereen daarna
  -- is medewerker; de beheerder kan dat naderhand wijzigen.
  toegekende_rol := case when bestaande_profielen = 0 then 'beheerder'
                         else 'medewerker' end;

  -- Namen kunnen bij de uitnodiging zijn meegegeven. Zo niet, dan is het deel
  -- vóór de @ een bruikbare eerste invulling.
  gekozen_voornaam := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'voornaam'), ''),
    split_part(new.email, '@', 1)
  );
  gekozen_achternaam := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'achternaam'), ''),
    ''
  );

  insert into public.profielen
    (auth_gebruiker_id, voornaam, achternaam, email, rol)
  values
    (new.id, gekozen_voornaam, gekozen_achternaam, new.email, toegekende_rol)
  -- Heeft de beheerder het profiel al aangemaakt en daarna pas uitgenodigd,
  -- dan wordt het bestaande profiel aan het account gekoppeld.
  on conflict (email) do update
    set auth_gebruiker_id = excluded.auth_gebruiker_id,
        gewijzigd_op = now();

  return new;
end;
$$;

create trigger bij_nieuwe_auth_gebruiker
  after insert on auth.users
  for each row execute function public.maak_profiel_bij_nieuwe_gebruiker();

-- ---------------------------------------------------------------------------
-- Een medewerker moet de eigen instellingen kunnen lezen om te kunnen rekenen.
-- Dat stond al zo in de policies; hier alleen een index zodat het opzoeken van
-- het profiel bij elke aanvraag snel blijft.
-- ---------------------------------------------------------------------------

create index if not exists profielen_auth_gebruiker_idx
  on public.profielen (auth_gebruiker_id);
