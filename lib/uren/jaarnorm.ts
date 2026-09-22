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

export interface JaarnormInvoer {
  jaar: number;
  /** Uit het geldende contract. */
  urenPerWeek: number;
  /** Uit `contracten.norm_fulltime`, door de beheerder per contract in te vullen. */
  normFulltime: number;
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

  // De periode dat de medewerker dit jaar in dienst is.
  const periodeStart = invoer.inDienstVanaf
    ? laatste(jaarStart, invoer.inDienstVanaf)
    : jaarStart;
  const periodeEind = invoer.uitDienstPer
    ? eerste(jaarEind, invoer.uitDienstPer)
    : jaarEind;

  const dagenJaar = kalenderdagen(jaarStart, jaarEind);
  const dagenPeriode = kalenderdagen(periodeStart, periodeEind);

  const jaarnorm = persoonlijkeJaarnorm(invoer.normFulltime, invoer.urenPerWeek);

  // Een volledig jaar levert exact de jaarnorm op; delen en weer
  // vermenigvuldigen zou daar een afrondingsverschil in brengen.
  const normPeriode =
    dagenPeriode >= dagenJaar
      ? jaarnorm
      : afrondUren((jaarnorm * dagenPeriode) / dagenJaar);

  const gerealiseerdeUren = afrondUren(invoer.gerealiseerdeUren);

  return {
    werktijdfactor: werktijdfactor(invoer.urenPerWeek),
    persoonlijkeJaarnorm: jaarnorm,
    normPeriode,
    periodeStart,
    periodeEind,
    dagenPeriode,
    dagenJaar,
    gerealiseerdeUren,
    geplandeUren: afrondUren(invoer.geplandeUren),
    nogTeGaan: afrondUren(normPeriode - gerealiseerdeUren),
  };
}
