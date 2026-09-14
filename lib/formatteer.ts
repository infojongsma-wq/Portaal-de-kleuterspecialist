import { format, getISOWeek, isValid, parse, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * Weergave in de interface. Nederlandse notatie: datums `dd-mm-jjjj`, tijden in
 * 24-uursnotatie, uren en bedragen met een komma als decimaalteken
 * (CLAUDE.md, "Taal en notatie").
 *
 * Rekenen gebeurt hier niet — dat staat in `lib/uren/`.
 */

/** `2027-03-10` wordt `10-03-2027`. */
export function formatteerDatum(iso: string): string {
  return format(parseISO(iso), "dd-MM-yyyy");
}

/** `2027-03-10` wordt `woensdag 10 maart 2027`. */
export function formatteerDatumVoluit(iso: string): string {
  return format(parseISO(iso), "EEEE d MMMM yyyy", { locale: nl });
}

/** `2027-03-10` wordt `wo 10 mrt`. */
export function formatteerDatumKort(iso: string): string {
  return format(parseISO(iso), "EEEEEE d MMM", { locale: nl });
}

/** ISO-weeknummer; de week begint op maandag. */
export function weeknummer(iso: string): number {
  return getISOWeek(parseISO(iso));
}

/** Een `Date` omzetten naar ISO `jjjj-mm-dd`, zonder tijdzoneverschuiving. */
export function naarIsoDatum(datum: Date): string {
  return format(datum, "yyyy-MM-dd");
}

/** `09:30:00` wordt `09:30`. Geeft een lege string bij geen tijd. */
export function formatteerTijd(tijd: string | null | undefined): string {
  if (!tijd) return "";
  return tijd.slice(0, 5);
}

/** `6.5` wordt `6,50`. */
export function formatteerUren(uren: number): string {
  return uren.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * `6.5` wordt `6u30`. Wordt naast de decimale weergave getoond, omdat een
 * halfuur als `0,50` niet voor iedereen meteen leesbaar is (SPEC.md 5.6).
 */
export function formatteerUrenKlok(uren: number): string {
  const totaalMinuten = Math.round(uren * 60);
  const teken = totaalMinuten < 0 ? "−" : "";
  const absoluut = Math.abs(totaalMinuten);
  const heleUren = Math.floor(absoluut / 60);
  const minuten = absoluut % 60;
  return `${teken}${heleUren}u${String(minuten).padStart(2, "0")}`;
}

/** `6,50 uur (6u30)`. */
export function formatteerUrenVolledig(uren: number): string {
  return `${formatteerUren(uren)} uur (${formatteerUrenKlok(uren)})`;
}

/** `12.5` wordt `€ 12,50`. */
export function formatteerBedrag(bedrag: number): string {
  return bedrag.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

/** `90` wordt `1 uur 30 min`, `45` wordt `45 min`. */
export function formatteerMinuten(minuten: number): string {
  if (minuten < 60) return `${minuten} min`;
  const heleUren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  const uurdeel = `${heleUren} uur`;
  return rest === 0 ? uurdeel : `${uurdeel} ${rest} min`;
}

/** Een getal met komma (`6,5`) omzetten naar een `number`. */
export function leesGetal(waarde: string): number {
  return Number(waarde.replace(",", "."));
}

/**
 * Leest een datum in Nederlandse notatie en geeft ISO `jjjj-mm-dd` terug, of
 * `null` als de tekst nog geen geldige datum is.
 *
 * Accepteert `10-3-2027`, `10-03-2027`, `10/03/2027` en `10.03.2027`.
 */
export function leesNederlandseDatum(tekst: string): string | null {
  const genormaliseerd = tekst.trim().replace(/[/.]/g, "-");
  if (!/^\d{1,2}-\d{1,2}-\d{4}$/.test(genormaliseerd)) return null;

  const datum = parse(genormaliseerd, "d-M-yyyy", new Date());
  if (!isValid(datum)) return null;

  // `parse` rolt een onmogelijke datum door (31-02 wordt 3 maart); door terug
  // te formatteren merken we dat op.
  const terug = format(datum, "d-M-yyyy");
  const ingevoerd = genormaliseerd
    .split("-")
    .map((deel, positie) => (positie < 2 ? String(Number(deel)) : deel))
    .join("-");
  if (terug !== ingevoerd) return null;

  return naarIsoDatum(datum);
}
