import { differenceInCalendarDays, parseISO } from "date-fns";
import { afrondOpDecimalen, afrondUren } from "./afronding";
import { FULLTIME_UREN_PER_WEEK } from "./constants";

/**
 * De jaarurennorm, per kalenderjaar.
 *
 * Het uitgangspunt is de netto jaartaak uit de cao: 1659 uur bij een voltijds
 * dienstverband, waar de vakantie-uren al vanaf zijn. Daar hoort geen
 * verdeling over weken of maanden bij — een medewerker werkt de ene week meer
 * dan de andere, en aan het eind van het jaar telt alleen het totaal.
 *
 * Begint of eindigt een dienstverband midden in het jaar, dan gaat de norm
 * naar rato over de kalenderdagen van dat deel van het jaar. Elk nieuw jaar
 * begint de teller weer op nul, met de norm die dan in het contract staat.
 */

/** Deeltijdfactor: contracturen gedeeld door een voltijdse week. */
export function werktijdfactor(urenPerWeek: number): number {
  // Vier decimalen, gelijk aan `contracten.werktijdfactor numeric(5,4)`.
  return afrondOpDecimalen(urenPerWeek / FULLTIME_UREN_PER_WEEK, 4);
}

/**
 * Persoonlijke jaarnorm over een heel jaar. Wordt altijd berekend uit de
 * fulltimenorm en de contracturen, nooit los ingevoerd.
 */
export function persoonlijkeJaarnorm(
  normFulltime: number,
  urenPerWeek: number,
): number {
  return afrondUren(normFulltime * werktijdfactor(urenPerWeek));
}

/** Aantal kalenderdagen van `vanaf` tot en met `totEnMet`; 0 als de periode leeg is. */
export function kalenderdagen(vanafIso: string, totEnMetIso: string): number {
  const dagen =
    differenceInCalendarDays(parseISO(totEnMetIso), parseISO(vanafIso)) + 1;
  return dagen > 0 ? dagen : 0;
}

/** Eén contractregel, met de periode waarin hij geldt. */
export interface ContractPeriode {
  urenPerWeek: number;
  /** Uit `contracten.norm_fulltime`, door de beheerder per contract in te vullen. */
  normFulltime: number;
  vanaf: string;
  tot?: string | null;
}

export interface JaarnormInvoer {
  jaar: number;
  /**
   * Alle contracten die dit jaar kunnen meetellen. Ze worden elk over hun eigen
   * dagen gerekend en bij elkaar opgeteld, zodat een wijziging halverwege het
   * jaar klopt en een regel die buiten het dienstverband valt vanzelf op nul
   * uitkomt.
   */
  contracten: ContractPeriode[];
  /** Bepaalt de berekening naar rato in het eerste jaar. */
  inDienstVanaf?: string | null;
  uitDienstPer?: string | null;
  /** Uren met status `voltooid` plus alle handmatige urenregels. */
  gerealiseerdeUren: number;
  /** Uren met status `gepland` of `voltooid`, ook toekomstige. */
  geplandeUren: number;
}

export interface JaarnormUitkomst {
  werktijdfactor: number;
  /** Norm over een heel jaar. */
  persoonlijkeJaarnorm: number;
  /** Norm over de periode dat de medewerker dit jaar in dienst is — naar rato. */
  normPeriode: number;
  /** Eerste en laatste dag van die periode, ISO. */
  periodeStart: string;
  periodeEind: string;
  dagenPeriode: number;
  dagenJaar: number;
  gerealiseerdeUren: number;
  geplandeUren: number;
  /** Norm min gerealiseerd. Negatief betekent: meer gewerkt dan de norm. */
  nogTeGaan: number;
}

function laatste(a: string, b: string): string {
  return a > b ? a : b;
}

function eerste(a: string, b: string): string {
  return a < b ? a : b;
}

/** Stand van zaken ten opzichte van de jaarurennorm. */
export function berekenJaarnorm(invoer: JaarnormInvoer): JaarnormUitkomst {
  const jaarStart = `${invoer.jaar}-01-01`;
  const jaarEind = `${invoer.jaar}-12-31`;
  const dagenJaar = kalenderdagen(jaarStart, jaarEind);

  // Per contract het stuk jaar waarin hij én geldt én de medewerker in dienst
  // is. De laatste startdatum en de eerste einddatum winnen; blijft er niets
  // over, dan telt dat contract dit jaar niet mee.
  const stukken = invoer.contracten
    .map((contract) => {
      let start = laatste(jaarStart, contract.vanaf);
      if (invoer.inDienstVanaf) start = laatste(start, invoer.inDienstVanaf);

      let eind = contract.tot ? eerste(jaarEind, contract.tot) : jaarEind;
      if (invoer.uitDienstPer) eind = eerste(eind, invoer.uitDienstPer);

      return { contract, start, eind, dagen: kalenderdagen(start, eind) };
    })
    .filter((stuk) => stuk.dagen > 0)
    .sort((a, b) => a.start.localeCompare(b.start));

  const dagenPeriode = stukken.reduce((som, stuk) => som + stuk.dagen, 0);

  // Het contract dat het jaar het meest bepaalt; bij gelijk aantal dagen de
  // laatste. Daarmee worden de deeltijdfactor en de jaarnorm getoond.
  const bepalend = stukken.reduce<(typeof stukken)[number] | null>(
    (beste, stuk) => (beste && beste.dagen > stuk.dagen ? beste : stuk),
    null,
  );

  const jaarnorm = bepalend
    ? persoonlijkeJaarnorm(
        bepalend.contract.normFulltime,
        bepalend.contract.urenPerWeek,
      )
    : 0;

  // Een volledig jaar op één contract levert exact de jaarnorm op; delen en
  // weer vermenigvuldigen zou daar een afrondingsverschil in brengen.
  const normPeriode =
    stukken.length === 1 && dagenPeriode >= dagenJaar
      ? jaarnorm
      : afrondUren(
          stukken.reduce(
            (som, stuk) =>
              som +
              (persoonlijkeJaarnorm(
                stuk.contract.normFulltime,
                stuk.contract.urenPerWeek,
              ) *
                stuk.dagen) /
                dagenJaar,
            0,
          ),
        );

  const gerealiseerdeUren = afrondUren(invoer.gerealiseerdeUren);

  return {
    werktijdfactor: bepalend
      ? werktijdfactor(bepalend.contract.urenPerWeek)
      : 0,
    persoonlijkeJaarnorm: jaarnorm,
    normPeriode,
    periodeStart: stukken[0]?.start ?? jaarStart,
    periodeEind: stukken[stukken.length - 1]?.eind ?? jaarEind,
    dagenPeriode,
    dagenJaar,
    gerealiseerdeUren,
    geplandeUren: afrondUren(invoer.geplandeUren),
    nogTeGaan: afrondUren(normPeriode - gerealiseerdeUren),
  };
}
