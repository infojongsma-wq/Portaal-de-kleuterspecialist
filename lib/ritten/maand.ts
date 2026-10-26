import { addMonths, format, isValid, parse } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * Maanden voor de rittenregistratie. Een maand schrijven we als `jjjj-mm`,
 * bijvoorbeeld `2026-10`; zo staat hij ook in het adres van de pagina.
 *
 * Pure functies, behalve `vandaagInNederland`, die de klok leest.
 */

const MAAND_PATROON = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMaand(waarde: string | null | undefined): waarde is string {
  return typeof waarde === "string" && MAAND_PATROON.test(waarde);
}

/**
 * De datum van vandaag in Nederland, als `jjjj-mm-dd`.
 *
 * De server draait in UTC. Tussen middernacht en twee uur 's nachts is het
 * daar nog gisteren; zonder deze omrekening zou een rit van net na
 * middernacht op de verkeerde dag, of zelfs in de verkeerde maand, landen.
 */
export function vandaagInNederland(nu: Date = new Date()): string {
  const delen = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nu);
  const deel = (soort: string) =>
    delen.find((onderdeel) => onderdeel.type === soort)?.value ?? "";
  return `${deel("year")}-${deel("month")}-${deel("day")}`;
}

/** De maand waar een datum in valt: `2026-10-12` wordt `2026-10`. */
export function maandVan(datum: string): string {
  return datum.slice(0, 7);
}

function eersteDag(maand: string): Date {
  return parse(`${maand}-01`, "yyyy-MM-dd", new Date());
}

/** Een maand verder of terug: `verschuifMaand("2026-12", 1)` is `2027-01`. */
export function verschuifMaand(maand: string, stappen: number): string {
  return format(addMonths(eersteDag(maand), stappen), "yyyy-MM");
}

/** `2026-10` wordt `oktober 2026`. */
export function maandNaam(maand: string): string {
  const datum = eersteDag(maand);
  return isValid(datum) ? format(datum, "MMMM yyyy", { locale: nl }) : maand;
}

/** Valt een datum in een maand? */
export function inMaand(datum: string, maand: string): boolean {
  return maandVan(datum) === maand;
}
