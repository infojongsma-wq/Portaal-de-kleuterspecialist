-- Startgegevens: de waarden die de applicatie nodig heeft om te kunnen rekenen
-- (SPEC.md 4.5 en 4.9). Geen persoonsgegevens.

-- Activiteitsoorten (SPEC.md 4.5). De uren staan hier en nergens anders;
-- de beheerder past ze aan in het beheerdersportaal.
insert into public.activiteitsoorten
  (naam, uren_op_locatie, uren_voorbereiding, kleur, volgorde, handmatige_uren)
values
  ('Training',   3.00, 3.00, '#2563eb', 10, false),
  ('Observatie', 3.50, 0.50, '#16a34a', 20, false),
  ('Anders',     0.00, 0.00, '#78716c', 30, true)
on conflict (naam) do nothing;

-- De enige rij met instellingen (SPEC.md 4.9).
insert into public.instellingen
  (eigen_reistijd_uren_per_dag, reistijd_afronding_minuten, max_uren_per_dag_waarschuwing)
values
  (2.00, 5, 12.00)
on conflict (enige_rij) do nothing;
