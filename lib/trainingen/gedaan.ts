import type {
  Activiteitsoort,
  Afspraak,
  Klant,
} from "@/lib/data/types";

/**
 * Trainingen gedaan (SPEC.md 6.6): per medewerker de afspraken op school die
 * als gedaan zijn afgevinkt, met of de beheerder de school al een factuur
 * heeft gestuurd en of de training al in een weekmail stond.
 *
 * Een pure functie zonder databasetoegang, zodat hij los te testen is. De
 * Beheer-pagina en de weekmail gebruiken hem allebei.
 */

export interface GedaneTraining {
  afspraakId: string;
  /** `null` als de training zonder datum is afgevinkt. */
  datum: string | null;
  school: string;
  plaats: string;
  titel: string;
  soort: string;
  /** Wanneer het vinkje "Training voltooid" is gezet. */
  voltooidOp: string | null;
  /** Datum waarop de beheerder de factuur heeft verstuurd, of `null`. */
  factuurVerstuurdOp: string | null;
  /** Stond de training al in een weekmail? */
  gemeld: boolean;
}

export interface TrainingenVanMedewerker {
  id: string;
  naam: string;
  trainingen: GedaneTraining[];
}

export interface TrainingenInvoer {
  afspraken: Afspraak[];
  klanten: Klant[];
  soorten: Activiteitsoort[];
  medewerkers: { id: string; naam: string; actief: boolean; rol: string }[];
  /** Per afspraak de datum waarop de factuur is verstuurd. */
  facturen: Map<string, string>;
  /** De afspraken die al in een weekmail stonden. */
  gemeld: Set<string>;
}

/** Nieuwste eerst; zonder datum achteraan. */
function nieuwsteEerst(a: GedaneTraining, b: GedaneTraining): number {
  if (a.datum === b.datum) return a.school.localeCompare(b.school, "nl");
  if (!a.datum) return 1;
  if (!b.datum) return -1;
  return b.datum.localeCompare(a.datum);
}

export function gedaneTrainingen(
  invoer: TrainingenInvoer,
): TrainingenVanMedewerker[] {
  const klanten = new Map(invoer.klanten.map((klant) => [klant.id, klant]));
  const soorten = new Map(invoer.soorten.map((soort) => [soort.id, soort]));

  const perMedewerker = new Map<string, GedaneTraining[]>();

  for (const afspraak of invoer.afspraken) {
    if (afspraak.status !== "voltooid" || !afspraak.klantId) continue;

    // Alleen afspraken op school; zelf ingevulde uren zoals Literatuurstudie
    // horen niet bij een school en dus ook niet bij een factuur.
    const soort = soorten.get(afspraak.activiteitsoortId);
    const klant = klanten.get(afspraak.klantId);
    if (!soort || soort.handmatigeUren || !klant) continue;

    const lijst = perMedewerker.get(afspraak.medewerkerId) ?? [];
    lijst.push({
      afspraakId: afspraak.id,
      datum: afspraak.datum,
      school: klant.naam,
      plaats: klant.plaats,
      titel: afspraak.titel,
      soort: soort.naam,
      voltooidOp: afspraak.voltooidOp,
      factuurVerstuurdOp: invoer.facturen.get(afspraak.id) ?? null,
      gemeld: invoer.gemeld.has(afspraak.id),
    });
    perMedewerker.set(afspraak.medewerkerId, lijst);
  }

  // Een actieve medewerker staat er altijd in, ook zonder gedane trainingen;
  // zo zie je dat er nog niets is afgevinkt. De beheerder en wie niet meer
  // actief is, alleen als er iets is.
  return invoer.medewerkers
    .filter(
      (medewerker) =>
        (medewerker.actief && medewerker.rol === "medewerker") ||
        perMedewerker.has(medewerker.id),
    )
    .map((medewerker) => ({
      id: medewerker.id,
      naam: medewerker.naam,
      trainingen: (perMedewerker.get(medewerker.id) ?? []).sort(nieuwsteEerst),
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Alleen wat nog niet in een weekmail stond. Medewerkers zonder iets nieuws
 * vallen weg.
 */
export function nogNietGemeld(
  lijst: TrainingenVanMedewerker[],
): TrainingenVanMedewerker[] {
  return lijst
    .map((medewerker) => ({
      ...medewerker,
      trainingen: medewerker.trainingen.filter((training) => !training.gemeld),
    }))
    .filter((medewerker) => medewerker.trainingen.length > 0);
}

/** Het aantal trainingen in een lijst per medewerker. */
export function aantalTrainingen(lijst: TrainingenVanMedewerker[]): number {
  return lijst.reduce((som, medewerker) => som + medewerker.trainingen.length, 0);
}
