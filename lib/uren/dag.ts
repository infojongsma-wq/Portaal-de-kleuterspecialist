import { afrondUren } from "./afronding";
import {
  teltLocatieUren,
  teltReistijd,
  teltVoorbereidingUren,
} from "./afspraak";
import {
  brutoReistijdUren,
  declarabeleReistijdUren,
  langsteEnkeleReisMinuten,
} from "./reistijd";
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
  /** Reistijd heen en terug, vóór aftrek van de eigen tijd. */
  brutoReistijdUren: number;
  /** De eigen tijd die is afgetrokken; `0` op dagen zonder klantbezoek. */
  eigenReistijdUren: number;
  /** Declarabele reistijd na aftrek. */
  reistijdUren: number;
  urenHandmatig: number;
  totaalUren: number;
  langsteEnkeleReisMinuten: number;
  /** Aantal afspraken op deze dag waarvan de reistijd meetelt. */
  aantalReizen: number;
  /** Meer dan één bestemming; de UI toont dan een melding (SPEC.md 5.2). */
  meerdereBestemmingen: boolean;
  /** Boven de Arbeidstijdenwet-grens uit `instellingen` (SPEC.md 5.3). */
  overschrijdtMaximum: boolean;
}

/**
 * Berekent de uren van één dag (SPEC.md 5.3):
 *
 *     werkuren_dag = Σ uren op locatie (afspraken op deze datum)
 *                  + Σ uren voorbereiding (afspraken met deze voorbereidingsdatum)
 *                  + declarabele reistijd
 *                  + Σ handmatige urenregels
 *
 * Welke afspraken meetellen hangt af van hun status en van de telwijze;
 * zie de statusmatrix in `afspraak.ts`.
 */
export function berekenDag(invoer: DagInvoer): DagUitkomst {
  const telwijze = invoer.telwijze ?? "gepland";

  const urenOpLocatie = invoer.afspraken
    .filter(
      (afspraak) =>
        afspraak.datum === invoer.datum &&
        teltLocatieUren(afspraak.status, telwijze),
    )
    .reduce((totaal, afspraak) => totaal + afspraak.urenOpLocatie, 0);

  const urenVoorbereiding = invoer.afspraken
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

  // Reistijd hoort bij de dag van het bezoek, niet bij de voorbereidingsdag.
  const reizen = invoer.afspraken.filter(
    (afspraak) =>
      afspraak.datum === invoer.datum &&
      teltReistijd(afspraak.status, telwijze) &&
      (afspraak.reistijdEnkelMinuten ?? 0) > 0,
  );

  const langsteReis = langsteEnkeleReisMinuten(reizen);
  const heeftKlantbezoek = langsteReis > 0;

  const reistijdUren = heeftKlantbezoek
    ? declarabeleReistijdUren(langsteReis, invoer.eigenReistijdUrenPerDag)
    : 0;

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
    brutoReistijdUren: heeftKlantbezoek ? brutoReistijdUren(langsteReis) : 0,
    eigenReistijdUren: heeftKlantbezoek ? invoer.eigenReistijdUrenPerDag : 0,
    reistijdUren,
    urenHandmatig: afrondUren(urenHandmatig),
    totaalUren,
    langsteEnkeleReisMinuten: langsteReis,
    aantalReizen: reizen.length,
    meerdereBestemmingen: reizen.length > 1,
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
    datums.add(afspraak.datum);
    datums.add(afspraak.voorbereidingDatum);
  }
  for (const regel of invoer.handmatigeUrenregels) {
    datums.add(regel.datum);
  }

  return [...datums]
    .sort()
    .map((datum) => berekenDag({ ...invoer, datum }));
}

/** Somt de dagtotalen op. */
export function totaalUren(dagen: DagUitkomst[]): number {
  return afrondUren(dagen.reduce((totaal, dag) => totaal + dag.totaalUren, 0));
}
