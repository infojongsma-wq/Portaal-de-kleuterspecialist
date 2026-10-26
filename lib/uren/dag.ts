import { afrondUren } from "./afronding";
import { teltLocatieUren, teltVoorbereidingUren } from "./afspraak";
import { reistijdVanDag, type RitReistijdInvoer } from "./reistijd";
import type { AfspraakInvoer, Telwijze, UrenregelInvoer } from "./types";

export interface DagInvoer {
  /** ISO `jjjj-mm-dd`. */
  datum: string;
  /**
   * Alle afspraken die deze dag raken: zowel afspraken met `datum` op deze dag
   * als afspraken waarvan alleen de `voorbereidingDatum` op deze dag valt.
   */
  afspraken: AfspraakInvoer[];
  /** Alleen handmatig geboekte urenregels; automatische regels volgen uit de afspraken. */
  handmatigeUrenregels: UrenregelInvoer[];
  /**
   * De gereden ritten; daar komt de reistijd uit (SPEC.md 5.2). Ritten zijn
   * gereden, dus ze tellen in beide telwijzen mee.
   */
  ritten: RitReistijdInvoer[];
  /** Uit `instellingen.eigen_reistijd_uren_per_dag`. */
  eigenReistijdUrenPerDag: number;
  /** Uit `instellingen.max_uren_per_dag_waarschuwing`. */
  maxUrenPerDagWaarschuwing: number;
  telwijze?: Telwijze;
}

export interface DagUitkomst {
  datum: string;
  urenOpLocatie: number;
  urenVoorbereiding: number;
  /** Reistijd van alle ritten van deze dag, vóór aftrek van de eigen tijd. */
  brutoReistijdUren: number;
  /** De eigen tijd die is afgetrokken; `0` op dagen zonder ritten. */
  eigenReistijdUren: number;
  /** Reistijd die als werktijd telt, na aftrek. */
  reistijdUren: number;
  urenHandmatig: number;
  totaalUren: number;
  /** Ritten op deze dag waarvan de reistijd meetelt. */
  aantalRitten: number;
  /** Ritten op deze dag zonder bekende reistijd; die tellen niet mee. */
  rittenZonderReistijd: number;
  /** Boven de Arbeidstijdenwet-grens uit `instellingen` (SPEC.md 5.3). */
  overschrijdtMaximum: boolean;
}

/**
 * Berekent de uren van één dag (SPEC.md 5.3):
 *
 *     werkuren_dag = Σ uren op locatie (afspraken op deze datum)
 *                  + Σ uren voorbereiding (afspraken met deze voorbereidingsdatum)
 *                  + reistijd uit de ritten van deze dag, na aftrek eigen tijd
 *                  + Σ handmatige urenregels
 *
 * Welke afspraken meetellen hangt af van hun status en van de telwijze;
 * zie de statusmatrix in `afspraak.ts`.
 */
export function berekenDag(invoer: DagInvoer): DagUitkomst {
  const telwijze = invoer.telwijze ?? "gepland";

  // Afspraken die geen werk zijn, zoals "niet beschikbaar", doen nergens mee:
  // niet in de uren en niet in de waarschuwing voor te lange dagen.
  const afspraken = invoer.afspraken.filter(
    (afspraak) => afspraak.teltAlsWerktijd !== false,
  );

  const urenOpLocatie = afspraken
    .filter(
      (afspraak) =>
        afspraak.datum === invoer.datum &&
        teltLocatieUren(afspraak.status, telwijze),
    )
    .reduce((totaal, afspraak) => totaal + afspraak.urenOpLocatie, 0);

  const urenVoorbereiding = afspraken
    .filter(
      (afspraak) =>
        afspraak.voorbereidingDatum === invoer.datum &&
        teltVoorbereidingUren(
          afspraak.status,
          afspraak.voorbereidingGedaan,
          telwijze,
        ),
    )
    .reduce((totaal, afspraak) => totaal + afspraak.urenVoorbereiding, 0);

  // Reistijd komt uit de ritten van deze dag (SPEC.md 5.2).
  const reistijd = reistijdVanDag(
    invoer.datum,
    invoer.ritten,
    invoer.eigenReistijdUrenPerDag,
  );
  const reistijdUren = reistijd.werktijdUren;

  const urenHandmatig = invoer.handmatigeUrenregels
    .filter((regel) => regel.datum === invoer.datum)
    .reduce((totaal, regel) => totaal + regel.uren, 0);

  const totaalUren = afrondUren(
    urenOpLocatie + urenVoorbereiding + reistijdUren + urenHandmatig,
  );

  return {
    datum: invoer.datum,
    urenOpLocatie: afrondUren(urenOpLocatie),
    urenVoorbereiding: afrondUren(urenVoorbereiding),
    brutoReistijdUren: reistijd.brutoUren,
    eigenReistijdUren: reistijd.eigenTijdUren,
    reistijdUren,
    urenHandmatig: afrondUren(urenHandmatig),
    totaalUren,
    aantalRitten: reistijd.aantalRitten,
    rittenZonderReistijd: reistijd.aantalZonderReistijd,
    overschrijdtMaximum: totaalUren > invoer.maxUrenPerDagWaarschuwing,
  };
}

/**
 * Berekent alle dagen waarop iets geboekt staat. Handig voor een periodetotaal
 * zonder over lege dagen te itereren.
 */
export function berekenDagen(
  invoer: Omit<DagInvoer, "datum">,
): DagUitkomst[] {
  const datums = new Set<string>();
  for (const afspraak of invoer.afspraken) {
    // Afspraken die nog ingepland moeten worden hebben geen datum en leveren
    // dus ook geen dag op.
    if (afspraak.datum) datums.add(afspraak.datum);
    if (afspraak.voorbereidingDatum) datums.add(afspraak.voorbereidingDatum);
  }
  for (const regel of invoer.handmatigeUrenregels) {
    datums.add(regel.datum);
  }
  for (const rit of invoer.ritten) {
    datums.add(rit.datum);
  }

  return [...datums]
    .sort()
    .map((datum) => berekenDag({ ...invoer, datum }));
}

/** Somt de dagtotalen op. */
export function totaalUren(dagen: DagUitkomst[]): number {
  return afrondUren(dagen.reduce((totaal, dag) => totaal + dag.totaalUren, 0));
}
