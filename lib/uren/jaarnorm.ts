import { eachDayOfInterval, format, isAfter, isWeekend, parseISO } from "date-fns";
import { afrondOpDecimalen, afrondUren } from "./afronding";
import {
  FULLTIME_UREN_PER_WEEK,
  INZETBARE_DAGEN_AFWIJKING_DREMPEL,
  VERWACHTE_INZETBARE_DAGEN,
} from "./constants";

/** Werktijdfactor: contracturen gedeeld door een fulltime week (SPEC.md 5.4). */
export function werktijdfactor(urenPerWeek: number): number {
  // Vier decimalen, gelijk aan `contracten.werktijdfactor numeric(5,4)`.
  return afrondOpDecimalen(urenPerWeek / FULLTIME_UREN_PER_WEEK, 4);
}

/**
 * Persoonlijke jaarnorm (SPEC.md 5.4). Wordt altijd berekend uit de
 * fulltimenorm en de contracturen, nooit los ingevoerd.
 */
export function persoonlijkeJaarnorm(
  normFulltime: number,
  urenPerWeek: number,
): number {
  return afrondUren(normFulltime * werktijdfactor(urenPerWeek));
}

/**
 * Aantal inzetbare dagen in een periode: alle dagen maandag tot en met vrijdag,
 * min de dagen die in `niet_inzetbare_dagen` staan (SPEC.md 5.4).
 *
 * Weekenddagen worden eerst overgeslagen, daarna pas de niet-inzetbare dagen
 * afgetrokken. Een schoolvakantie die in het weekend valt kost dus geen dag,
 * en een dag die zowel schoolvakantie als feestdag is telt maar één keer —
 * `Set` ontdubbelt.
 */
export function inzetbareDagen(
  vanafIso: string,
  totEnMetIso: string,
  nietInzetbareDatums: Iterable<string>,
): number {
  const vanaf = parseISO(vanafIso);
  const totEnMet = parseISO(totEnMetIso);
  if (isAfter(vanaf, totEnMet)) return 0;

  const uitgesloten = new Set(nietInzetbareDatums);
  let aantal = 0;

  for (const dag of eachDayOfInterval({ start: vanaf, end: totEnMet })) {
    if (isWeekend(dag)) continue;
    if (uitgesloten.has(format(dag, "yyyy-MM-dd"))) continue;
    aantal += 1;
  }

  return aantal;
}

/**
 * Controle op de volledigheid van `niet_inzetbare_dagen` (SPEC.md 5.4).
 * Geeft `true` als het aantal inzetbare dagen te ver afwijkt van 207,4 en de
 * vakantiedata dus waarschijnlijk niet compleet zijn ingevoerd.
 */
export function vakantiegegevensLijkenOnvolledig(
  inzetbareDagenJaar: number,
): boolean {
  const afwijking =
    Math.abs(inzetbareDagenJaar - VERWACHTE_INZETBARE_DAGEN) /
    VERWACHTE_INZETBARE_DAGEN;
  return afwijking > INZETBARE_DAGEN_AFWIJKING_DREMPEL;
}

export interface JaarnormInvoer {
  jaar: number;
  /** Uit het geldende contract. */
  urenPerWeek: number;
  /** Uit `contracten.norm_fulltime`, standaard 1659. */
  normFulltime: number;
  /** Datums uit `niet_inzetbare_dagen`, ISO `jjjj-mm-dd`. */
  nietInzetbareDatums: Iterable<string>;
  /** Bepaalt de berekening naar rato in het eerste jaar (SPEC.md 5.4 stap 3). */
  inDienstVanaf?: string | null;
  uitDienstPer?: string | null;
  /** Tot en met welke dag er is gewerkt, ISO `jjjj-mm-dd`. */
  peildatum: string;
  /** Uren met status `voltooid` plus alle handmatige urenregels. */
  gerealiseerdeUren: number;
  /** Uren met status `gepland` of `voltooid`, ook toekomstige. */
  geplandeUren: number;
}

export interface JaarnormUitkomst {
  werktijdfactor: number;
  /** Norm over een heel jaar. */
  persoonlijkeJaarnorm: number;
  /** Norm over de periode dat de medewerker in dienst is — naar rato. */
  normPeriode: number;
  inzetbareDagenJaar: number;
  inzetbareDagenPeriode: number;
  inzetbareDagenVerstreken: number;
  /** Verstreken deel van het jaar, gemeten in inzetbare dagen. */
  verstrekenDeel: number;
  /** Verstreken deel van de eigen periode; voor de voortgangsbalk. */
  verstrekenDeelPeriode: number;
  verwachteUren: number;
  gerealiseerdeUren: number;
  geplandeUren: number;
  /** Gerealiseerd min verwacht. Negatief is achterstand. */
  saldo: number;
  vakantiegegevensOnvolledig: boolean;
}

function laatste(a: string, b: string): string {
  return a > b ? a : b;
}

function eerste(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Balans ten opzichte van de jaarurennorm (SPEC.md 5.4).
 *
 * De norm wordt uitgesmeerd over **inzetbare dagen**, niet over kalenderweken.
 * Daardoor staat de normlijn stil tijdens schoolvakanties en ontstaat er in
 * juli geen schijnbare achterstand.
 */
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

  const datums = new Set(invoer.nietInzetbareDatums);

  const inzetbareDagenJaar = inzetbareDagen(jaarStart, jaarEind, datums);
  const inzetbareDagenPeriode = inzetbareDagen(
    periodeStart,
    periodeEind,
    datums,
  );
  const inzetbareDagenVerstreken = inzetbareDagen(
    periodeStart,
    eerste(invoer.peildatum, periodeEind),
    datums,
  );

  const jaarnorm = persoonlijkeJaarnorm(invoer.normFulltime, invoer.urenPerWeek);

  const verstrekenDeel =
    inzetbareDagenJaar === 0 ? 0 : inzetbareDagenVerstreken / inzetbareDagenJaar;
  const verstrekenDeelPeriode =
    inzetbareDagenPeriode === 0
      ? 0
      : inzetbareDagenVerstreken / inzetbareDagenPeriode;

  const normPeriode =
    inzetbareDagenJaar === 0
      ? 0
      : afrondUren((jaarnorm * inzetbareDagenPeriode) / inzetbareDagenJaar);

  const verwachteUren = afrondUren(jaarnorm * verstrekenDeel);
  const gerealiseerdeUren = afrondUren(invoer.gerealiseerdeUren);

  return {
    werktijdfactor: werktijdfactor(invoer.urenPerWeek),
    persoonlijkeJaarnorm: jaarnorm,
    normPeriode,
    inzetbareDagenJaar,
    inzetbareDagenPeriode,
    inzetbareDagenVerstreken,
    verstrekenDeel,
    verstrekenDeelPeriode,
    verwachteUren,
    gerealiseerdeUren,
    geplandeUren: afrondUren(invoer.geplandeUren),
    saldo: afrondUren(gerealiseerdeUren - verwachteUren),
    vakantiegegevensOnvolledig:
      vakantiegegevensLijkenOnvolledig(inzetbareDagenJaar),
  };
}
