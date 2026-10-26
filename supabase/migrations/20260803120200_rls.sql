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
