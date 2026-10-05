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
