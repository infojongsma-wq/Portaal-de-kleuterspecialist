import type { Rit } from "@/lib/data/types";
import { rittenTotaal, type RittenTotaal } from "@/lib/uren";
import { inMaand } from "./maand";

/**
 * Het ritten-overzicht in Beheer (SPEC.md 6.6): per medewerker het totaal van
 * één maand, en het totaal van iedereen samen.
 *
 * Een pure functie zonder databasetoegang, zodat hij los te testen is.
 */

export interface MedewerkerRegel {
  id: string;
  naam: string;
  totaal: RittenTotaal;
}

export interface Rittenmaand {
  regels: MedewerkerRegel[];
  totaal: RittenTotaal;
}

export function rittenmaand(
  ritten: Rit[],
  maand: string,
  medewerkers: { id: string; naam: string; actief: boolean }[],
): Rittenmaand {
  const vanDeMaand = ritten.filter((rit) => inMaand(rit.datum, maand));

  // Wie actief is staat er altijd in, ook zonder ritten: zo zie je ook dat er
  // niets is ingevuld. Wie niet meer actief is, alleen als er ritten zijn.
  const regels = medewerkers
    .map((medewerker) => ({
      id: medewerker.id,
      naam: medewerker.naam,
      actief: medewerker.actief,
      totaal: rittenTotaal(
        vanDeMaand.filter((rit) => rit.medewerkerId === medewerker.id),
      ),
    }))
    .filter((regel) => regel.actief || regel.totaal.aantal > 0)
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"))
    .map(({ id, naam, totaal }) => ({ id, naam, totaal }));

  return { regels, totaal: rittenTotaal(vanDeMaand) };
}
