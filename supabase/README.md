# Database

Migraties voor de PostgreSQL-database achter het portaal (Supabase, regio EU
Frankfurt). Volgt `SPEC.md` hoofdstuk 4 (datamodel) en 7 (beveiliging).

## Migraties toepassen

```bash
npx supabase link --project-ref <ref-van-kleuterspecialist-dev>
npx supabase db push
```

## Volgorde

| Bestand | Inhoud |
|---|---|
| `20260803120000_basisschema.sql` | Alle tabellen, sleutels, indexen en `gewijzigd_op`-triggers |
| `20260803120100_wijzigingslog.sql` | Triggers die `afspraken` en `urenregels` loggen |
| `20260803120200_rls.sql` | Row Level Security: hulpfuncties en policies per tabel |
| `20260803120300_startgegevens.sql` | Activiteitsoorten en de enige rij met instellingen |

## Uitgangspunten

- **RLS staat aan op elke tabel.** Een tabel zonder policy is een bug.
- De rol van de gebruiker komt via `is_beheerder()` uit `profielen`, niet uit
  een JWT-claim die de client kan zetten.
- `huidig_profiel_id()` en `is_beheerder()` zijn `security definer`, anders zou
  de policy op `profielen` zichzelf aanroepen.
- Het wijzigingslog is alleen leesbaar voor de beheerder en wordt uitsluitend
  door triggers gevuld.

## Nog te doen

- Twee testgebruikers in `kleuterspecialist-dev` om testeis 7 uit `SPEC.md`
  hoofdstuk 9 te kunnen draaien (medewerker A mag niet bij medewerker B).
- `niet_inzetbare_dagen` vullen met de vakantiedata van regio Noord per
  schooljaar, plus de nationale feestdagen.
- Nachtelijke `pg_dump` naar Strato HiDrive (`SPEC.md` hoofdstuk 3).
