import { afrondOpDecimalen } from "./afronding";
import { BEDRAG_DECIMALEN, KM_DECIMALEN } from "./constants";

/**
 * Rekenregels voor ritten en de kilometervergoeding (SPEC.md 5.7).
 *
 * De vergoeding per kilometer komt als argument binnen: die staat per rit
 * vastgelegd, overgenomen uit `instellingen` op het moment van opslaan.
 */

export interface RitInvoer {
  /** Kilometers van de enkele reis. */
  kmEnkel: number;
  /** "Vice versa": heen en terug. De kilometers tellen dan dubbel. */
  heenEnTerug: boolean;
  /** Euro per kilometer, zoals vastgelegd bij de rit. */
  vergoedingPerKm: number;
}

export interface RittenTotaal {
  aantal: number;
  km: number;
  bedrag: number;
}

/** Kilometers op één decimaal, zoals ze in de database staan. */
export function afrondKm(km: number): number {
  return afrondOpDecimalen(km, KM_DECIMALEN);
}

/** Bedragen op hele centen. */
export function afrondBedrag(bedrag: number): number {
  return afrondOpDecimalen(bedrag, BEDRAG_DECIMALEN);
}

/** Meters, zoals de routeplanner ze geeft, naar kilometers. */
export function metersNaarKm(meters: number): number {
  return afrondKm(meters / 1000);
}

/** De gereden kilometers van een rit: bij heen en terug twee keer de enkele reis. */
export function kmVanRit(rit: Pick<RitInvoer, "kmEnkel" | "heenEnTerug">): number {
  return afrondKm(rit.kmEnkel * (rit.heenEnTerug ? 2 : 1));
}

/** De vergoeding van een rit: gereden kilometers × vergoeding per km, op centen. */
export function bedragVanRit(rit: RitInvoer): number {
  return afrondBedrag(kmVanRit(rit) * rit.vergoedingPerKm);
}

/**
 * Het totaal van een reeks ritten, bijvoorbeeld een maand.
 *
 * Het totaalbedrag is de som van de afgeronde bedragen per rit, en niet het
 * totaal aantal kilometers × de vergoeding. Zo tellen de regels in het
 * overzicht en in de Excel precies op tot het totaal, ook als de vergoeding
 * halverwege de maand is gewijzigd.
 */
export function rittenTotaal(ritten: RitInvoer[]): RittenTotaal {
  return {
    aantal: ritten.length,
    km: afrondKm(ritten.reduce((som, rit) => som + kmVanRit(rit), 0)),
    bedrag: afrondBedrag(
      ritten.reduce((som, rit) => som + bedragVanRit(rit), 0),
    ),
  };
}
