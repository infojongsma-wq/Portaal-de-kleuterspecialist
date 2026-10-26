import { getISOWeek, getISOWeekYear } from "date-fns";

/**
 * Wanneer de weekmail gaat (SPEC.md 6.6): maandag om 08:00 Nederlandse tijd.
 *
 * Vercel rekent in UTC en kent geen zomer- en wintertijd. Daarom roept Vercel
 * het adres op maandag twee keer aan, om 06:00 en 07:00 UTC (`vercel.json`).
 * In de zomer is 06:00 UTC 08:00 in Nederland, in de winter is dat 07:00 UTC.
 * Alleen de aanroep waarbij het in Nederland tussen 08:00 en 09:00 is,
 * verstuurt de mail. Op het gratis Vercel-abonnement komt een aanroep ergens
 * binnen het uur; ook dan valt hij in dat venster.
 *
 * Pure functies: de klok komt als argument binnen.
 */

const UUR_VAN_DE_WEEKMAIL = 8;

interface NederlandseTijd {
  jaar: number;
  maand: number;
  dag: number;
  uur: number;
  /** 1 is maandag, 7 is zondag. */
  weekdag: number;
}

function nederlandseTijd(nu: Date): NederlandseTijd {
  const delen = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(nu);
  const deel = (soort: Intl.DateTimeFormatPartTypes) =>
    delen.find((onderdeel) => onderdeel.type === soort)?.value ?? "";
  const weekdagen = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return {
    jaar: Number(deel("year")),
    maand: Number(deel("month")),
    dag: Number(deel("day")),
    uur: Number(deel("hour")),
    weekdag: weekdagen.indexOf(deel("weekday")) + 1,
  };
}

/** Is dit het moment voor de vaste weekmail? */
export function isWeekmailMoment(nu: Date): boolean {
  const tijd = nederlandseTijd(nu);
  return tijd.weekdag === 1 && tijd.uur === UUR_VAN_DE_WEEKMAIL;
}

/** De ISO-week in Nederland, zoals `2026-W44`. De week begint op maandag. */
export function weekInNederland(nu: Date): string {
  const tijd = nederlandseTijd(nu);
  // Midden op de dag, zodat de tijdzone van de server niet uitmaakt.
  const datum = new Date(tijd.jaar, tijd.maand - 1, tijd.dag, 12);
  return `${getISOWeekYear(datum)}-W${String(getISOWeek(datum)).padStart(2, "0")}`;
}

/** `2026-W44` wordt `44`. */
export function weeknummerUit(week: string): number {
  return Number(week.slice(-2));
}

/** Een tijdstip in Nederlandse tijd: `maandag 26-10-2026 om 08:04`. */
export function tijdstipInNederland(iso: string): string {
  const delen = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const deel = (soort: Intl.DateTimeFormatPartTypes) =>
    delen.find((onderdeel) => onderdeel.type === soort)?.value ?? "";
  return `${deel("weekday")} ${deel("day")}-${deel("month")}-${deel("year")} om ${deel("hour")}:${deel("minute")}`;
}
