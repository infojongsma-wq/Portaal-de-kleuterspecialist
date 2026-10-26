import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Pagina } from "@/components/pagina";
import {
  MedewerkersAgenda,
  type AgendaMedewerker,
} from "@/components/beheer/medewerkers-agenda";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  haalAlleAfsprakenMetContext,
  haalNietInzetbareDagen,
  haalProfielen,
  isBeheerder,
} from "@/lib/data/queries";

export const metadata = { title: "Agenda medewerkers · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

// Eén kleur per medewerker, goed van elkaar te onderscheiden. De eerste is de
// huisstijlkleur.
const MEDEWERKERKLEUREN = [
  "#026666",
  "#db2777",
  "#ea580c",
  "#7c3aed",
  "#2563eb",
  "#3a673a",
  "#0891b2",
  "#78716c",
];

/** Agenda medewerkers, alleen voor de beheerder (SPEC.md 6.6). */
export default async function AgendaMedewerkersPagina() {
  if (!(await isBeheerder())) {
    return (
      <Pagina titel="Agenda medewerkers">
        <Card className="p-6 text-sm text-muted-foreground">
          Dit scherm is alleen voor de beheerder.
        </Card>
      </Pagina>
    );
  }

  const [profielen, afspraken, nietInzetbareDagen] = await Promise.all([
    haalProfielen(),
    haalAlleAfsprakenMetContext(),
    haalNietInzetbareDagen(),
  ]);

  // Wie actief medewerker is staat erin, ook zonder afspraken. De beheerder en
  // wie niet meer actief is, alleen als er afspraken zijn. Medewerkers eerst.
  const metAfspraken = new Set(afspraken.map((afspraak) => afspraak.medewerkerId));
  const medewerkers: AgendaMedewerker[] = profielen
    .filter(
      (profiel) =>
        (profiel.actief && profiel.rol === "medewerker") ||
        metAfspraken.has(profiel.id),
    )
    .sort(
      (a, b) =>
        Number(a.rol === "beheerder") - Number(b.rol === "beheerder") ||
        `${a.voornaam} ${a.achternaam}`.localeCompare(
          `${b.voornaam} ${b.achternaam}`,
          "nl",
        ),
    )
    .map((profiel, index) => ({
      id: profiel.id,
      naam: `${profiel.voornaam} ${profiel.achternaam}`.trim(),
      voornaam: profiel.voornaam,
      kleur: MEDEWERKERKLEUREN[index % MEDEWERKERKLEUREN.length],
    }));

  return (
    <Pagina
      titel="Agenda medewerkers"
      omschrijving="De afspraken van alle medewerkers. Alleen bekijken: wijzigen doet de medewerker zelf."
      acties={
        <Button variant="outline" asChild>
          <Link href="/beheer">
            <ArrowLeft aria-hidden />
            Terug naar Beheer
          </Link>
        </Button>
      }
    >
      <MedewerkersAgenda
        medewerkers={medewerkers}
        afspraken={afspraken}
        nietInzetbareDagen={nietInzetbareDagen}
      />
    </Pagina>
  );
}
