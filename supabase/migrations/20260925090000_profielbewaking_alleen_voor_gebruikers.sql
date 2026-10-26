-- De bewaking van profielvelden hield Supabase Auth zelf tegen.
--
-- De beheerder maakt eerst een profiel aan en nodigt de medewerker daarna uit.
-- Supabase Auth maakt dan een account, en de trigger `bij_nieuwe_auth_gebruiker`
-- koppelt dat account aan het bestaande profiel: een UPDATE van
-- `auth_gebruiker_id`. Die UPDATE komt niet van een ingelogde gebruiker maar van
-- Supabase Auth zelf. Daar is geen auth.uid(), dus is_beheerder() gaf false, en
-- de bewaking weigerde de koppeling. Supabase Auth meldde daarop "Database error
-- saving new user" en maakte het account niet aan — elke uitnodiging liep vast.
--
-- De bewaking is bedoeld tegen een medewerker die via het portaal aan zijn
-- eigen rol of dienstverband zit. Zo'n verzoek komt altijd binnen met een JWT
-- met de rol 'authenticated'. Een verzoek zonder JWT (Supabase Auth zelf, de SQL
-- Editor) of met de service_role-sleutel komt van de beheerkant; dat laat hij
-- voortaan door. Voor ingelogde gebruikers verandert er niets.

create or replace function public.bewaak_profielvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_rol text;
begin
  -- PostgREST zet bij elk verzoek de claims van het token. Supabase Auth en de
  -- SQL Editor doen dat niet; dan is de instelling leeg of afwezig.
  jwt_rol := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';

  if jwt_rol is null or jwt_rol = 'service_role' then
    return new;
  end if;

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
