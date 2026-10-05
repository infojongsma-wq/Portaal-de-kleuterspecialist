import { z } from "zod";

/**
 * Validatie van de rittenregistratie (SPEC.md 6.7). Wordt in de browser én
 * opnieuw in de server action gebruikt; invoer van de client wordt nooit
 * vertrouwd. Alle meldingen in het Nederlands.
 */

/**
 * Leest een getal zoals het invoerveld het aanlevert: "23,4" en "23.4" worden
 * allebei 23,4. Een leeg veld geeft `null`, onzin geeft `NaN`.
 */
export function leesDecimaal(tekst: string | undefined): number | null {
  const schoon = (tekst ?? "").trim().replace(",", ".");
  if (schoon === "") return null;
  return Number(schoon);
}

const isoDatum = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een geldige datum.");

const plaats = (melding: string) =>
  z
    .string()
    .trim()
    .min(1, melding)
    .max(100, "Deze plaatsnaam is te lang; maximaal 100 tekens.");

export const ritSchema = z
  .object({
    id: z.string().optional(),
    datum: isoDatum,
    doel: z
      .string()
      .trim()
      .min(1, "Vul het doel van de rit in.")
      .max(200, "Het doel is te lang; maximaal 200 tekens."),
    vanPlaats: plaats("Kies waar je vertrekt."),
    naarPlaats: plaats("Kies waar je naartoe gaat."),
    heenEnTerug: z.boolean(),
    // Als tekst, zoals het invoerveld hem aanlevert; zie `leesDecimaal`.
    kmEnkel: z.string(),
  })
  .refine(
    (waarden) => {
      const km = leesDecimaal(waarden.kmEnkel);
      return km !== null && km > 0 && km <= 1500;
    },
    {
      message: "Vul het aantal kilometers in: meer dan 0 en hooguit 1500.",
      path: ["kmEnkel"],
    },
  );

export type RitFormulier = z.infer<typeof ritSchema>;

/** Postcode zoals 7514 AB; spatie en hoofdletters maken niet uit. */
const POSTCODE = /^\d{4}\s?[a-zA-Z]{2}$/;

export const thuisadresSchema = z.object({
  adres: z.string().trim().max(200, "Dit adres is te lang."),
  postcode: z
    .string()
    .trim()
    .refine((waarde) => waarde === "" || POSTCODE.test(waarde), {
      message: "Vul een postcode in zoals 7514 AB, of laat het veld leeg.",
    }),
  plaats: z
    .string()
    .trim()
    .min(1, "Vul je woonplaats in; daarmee rekent de app de afstanden uit.")
    .max(100, "Deze plaatsnaam is te lang."),
});

export type ThuisadresFormulier = z.infer<typeof thuisadresSchema>;

/** `7514ab` wordt `7514 AB`. */
export function netjesPostcode(postcode: string): string {
  const schoon = postcode.replace(/\s+/g, "").toUpperCase();
  return schoon.length === 6 ? `${schoon.slice(0, 4)} ${schoon.slice(4)}` : schoon;
}

export const kilometervergoedingSchema = z.object({
  vergoeding: z.string().refine(
    (tekst) => {
      const bedrag = leesDecimaal(tekst);
      return bedrag !== null && bedrag >= 0 && bedrag <= 2;
    },
    { message: "Vul een bedrag per km in tussen € 0,00 en € 2,00." },
  ),
});
