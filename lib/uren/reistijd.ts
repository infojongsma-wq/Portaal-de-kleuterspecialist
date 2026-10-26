import { afrondMinuten, afrondUren } from "./afronding";
import { ENKELE_REIZEN_IN_EIGEN_REISTIJD } from "./constants";

/**
 * Reistijd uit de rittenregistratie (SPEC.md 5.2).
 *
 * Reistijd hoort niet meer bij een afspraak, maar bij een gereden rit. Per rit
 * staat de berekende reisduur van de enkele reis (routeplanner, zonder files)
 * en eventueel een afwijkende reistijd die de medewerker zelf invult, bij
 * files of een omleiding. Per dag gaat de eigen tijd eraf: een uur per enkele
 * reis, met een maximum van de eigen reistijd per dag uit `instellingen`.
 *
 *     reistijd_dag   = Σ reistijd per rit
 *     eigen_tijd_dag = MIN(eigen reistijd per dag ;
 *                          enkele reizen × eigen reistijd per dag ÷ 2)
 *     werktijd_dag   = MAX(0 ; reistijd_dag − eigen_tijd_dag)
 */

/** De velden van een rit die de reistijdberekening nodig heeft. */
export interface RitReistijdInvoer {
  /** ISO `jjjj-mm-dd`. */
  datum: string;
  /** "Vice versa": heen en terug, dus twee enkele reizen. */
  heenEnTerug: boolean;
  /**
   * De berekende reisduur van de enkele reis in minuten, al afgerond.
   * `null` als die (nog) niet bekend is.
   */
  reisduurEnkelMinuten: number | null;
  /**
   * De reistijd van de hele rit (bij vice versa heen en terug samen) zoals de
   * medewerker die zelf heeft ingevuld. Gaat vóór de berekende reisduur.
   * `null` als ze de berekende reisduur aanhoudt.
   */
  afwijkendeReistijdMinuten: number | null;
}

export interface ReistijdVanDag {
  /** Alle reistijd van de ritten van deze dag, vóór aftrek. */
  brutoUren: number;
  /** De eigen tijd die eraf ging; nooit meer dan de bruto reistijd. */
  eigenTijdUren: number;
  /** Wat als werktijd telt. */
  werktijdUren: number;
  /** Ritten waarvan de reistijd meetelt. */
  aantalRitten: number;
  /** Ritten zonder bekende reistijd; die tellen nergens mee. */
  aantalZonderReistijd: number;
}

/** Twee enkele reizen bij vice versa, anders één. */
export function enkeleReizenVanRit(rit: Pick<RitReistijdInvoer, "heenEnTerug">): number {
  return rit.heenEnTerug ? 2 : 1;
}

/**
 * De reistijd van één rit in minuten: de afwijkende reistijd als die is
 * ingevuld, anders de berekende reisduur (dubbel bij vice versa). `null` als
 * geen van beide bekend is.
 */
export function reistijdVanRitMinuten(rit: RitReistijdInvoer): number | null {
  if (rit.afwijkendeReistijdMinuten !== null) return rit.afwijkendeReistijdMinuten;
  if (rit.reisduurEnkelMinuten === null) return null;
  return rit.reisduurEnkelMinuten * enkeleReizenVanRit(rit);
}

/**
 * De reistijd van één dag (SPEC.md 5.2). Geef de ritten van die dag mee; een
 * rit op een andere datum wordt genegeerd.
 *
 * Een rit zonder bekende reistijd telt nergens mee, ook niet bij de eigen
 * tijd: anders zou hij de reistijd van de andere ritten op die dag opeten.
 */
export function reistijdVanDag(
  datum: string,
  ritten: RitReistijdInvoer[],
  eigenReistijdUrenPerDag: number,
): ReistijdVanDag {
  const vanDeDag = ritten.filter((rit) => rit.datum === datum);
  const bekend = vanDeDag.filter((rit) => reistijdVanRitMinuten(rit) !== null);

  const minuten = bekend.reduce(
    (som, rit) => som + (reistijdVanRitMinuten(rit) ?? 0),
    0,
  );
  const enkeleReizen = bekend.reduce(
    (som, rit) => som + enkeleReizenVanRit(rit),
    0,
  );

  const bruto = minuten / 60;
  const eigenTijd = Math.min(
    eigenReistijdUrenPerDag,
    (enkeleReizen * eigenReistijdUrenPerDag) / ENKELE_REIZEN_IN_EIGEN_REISTIJD,
    bruto,
  );

  return {
    brutoUren: afrondUren(bruto),
    eigenTijdUren: afrondUren(eigenTijd),
    werktijdUren: afrondUren(Math.max(0, bruto - eigenTijd)),
    aantalRitten: bekend.length,
    aantalZonderReistijd: vanDeDag.length - bekend.length,
  };
}

/**
 * De reistijd van een reeks ritten, bijvoorbeeld een maand: per dag
 * uitgerekend zoals in `reistijdVanDag` en dan opgeteld. De eigen tijd gaat er
 * dus per dag af, niet één keer over de hele maand.
 */
export function reistijdVanRitten(
  ritten: RitReistijdInvoer[],
  eigenReistijdUrenPerDag: number,
): ReistijdVanDag {
  const dagen = [...new Set(ritten.map((rit) => rit.datum))].map((datum) =>
    reistijdVanDag(datum, ritten, eigenReistijdUrenPerDag),
  );
  const som = (veld: keyof ReistijdVanDag) =>
    dagen.reduce((totaal, dag) => totaal + dag[veld], 0);

  return {
    brutoUren: afrondUren(som("brutoUren")),
    eigenTijdUren: afrondUren(som("eigenTijdUren")),
    werktijdUren: afrondUren(som("werktijdUren")),
    aantalRitten: som("aantalRitten"),
    aantalZonderReistijd: som("aantalZonderReistijd"),
  };
}

/** Seconden van de routeplanner naar minuten, afgerond zoals 5.6 voorschrijft. */
export function secondenNaarReisduurMinuten(
  seconden: number,
  afrondingMinuten: number,
): number {
  return afrondAutomatischeReistijdMinuten(seconden / 60, afrondingMinuten);
}

/**
 * Rondt de berekende reisduur af vóór opslag (SPEC.md 5.6), op
 * `instellingen.reistijd_afronding_minuten`. Niet voor een reistijd die de
 * medewerker zelf invult; die blijft zoals ingevuld.
 */
export function afrondAutomatischeReistijdMinuten(
  minuten: number,
  afrondingMinuten: number,
): number {
  return afrondMinuten(minuten, afrondingMinuten);
}
