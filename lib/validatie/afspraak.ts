import { z } from "zod";

/**
 * Validatie van het afspraakformulier (SPEC.md 6.2). Wordt zowel in de browser
 * gebruikt door react-hook-form als opnieuw in de server action — invoer die
 * van de client komt wordt nooit vertrouwd.
 *
 * Alle meldingen in het Nederlands.
 */

const isoDatum = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een geldige datum.");

const vrijeTekst = z
  .string()
  .trim()
  .max(2000, "Deze tekst is te lang; maximaal 2000 tekens.");

export const afspraakSchema = z
  .object({
    id: z.string().optional(),
    klantId: z.string().min(1, "Kies een school."),
    contactpersoonId: z.string().optional(),
    activiteitsoortId: z.string().min(1, "Kies een soort activiteit."),
    titel: z
      .string()
      .trim()
      .min(1, "Vul de naam van de training in.")
      .max(200, "De naam is te lang; maximaal 200 tekens."),
    datum: isoDatum,
    dagdeel: z.enum(["ochtend", "middag", "hele_dag", "anders"], {
      message: "Kies een dagdeel.",
    }),
    andersOmschrijving: z.string().trim().max(200).optional(),
    starttijd: z.string().optional(),
    eindtijd: z.string().optional(),
    voorbereidingDatum: isoDatum,
    // Geen `z.coerce` hier: het formulier levert deze velden al als getal aan
    // (`valueAsNumber`), en coercion zou het invoertype op `unknown` zetten
    // waardoor react-hook-form zijn typen niet meer rond krijgt.
    urenOpLocatie: z
      .number({ message: "Vul een aantal uren in." })
      .min(0, "Uren kunnen niet negatief zijn.")
      .max(24, "Meer dan 24 uur op één dag kan niet."),
    urenVoorbereiding: z
      .number({ message: "Vul een aantal uren in." })
      .min(0, "Uren kunnen niet negatief zijn.")
      .max(24, "Meer dan 24 uur op één dag kan niet."),
    reistijdEnkelMinuten: z
      .number({ message: "Vul de reistijd in minuten in." })
      .int("Vul hele minuten in.")
      .min(0, "Reistijd kan niet negatief zijn.")
      .max(600, "Meer dan 600 minuten enkele reis lijkt een vergissing."),
    afsprakenMetKlant: vrijeTekst.optional(),
    notitie: vrijeTekst.optional(),
    voltooid: z.boolean(),
    voorbereidingGedaan: z.boolean(),
  })
  // "Anders, namelijk" is verplicht zodra het dagdeel op "Anders" staat.
  .refine(
    (waarden) =>
      waarden.dagdeel !== "anders" ||
      (waarden.andersOmschrijving?.length ?? 0) > 0,
    {
      message: "Vul in wat de afwijkende tijd is.",
      path: ["andersOmschrijving"],
    },
  )
  .refine(
    (waarden) =>
      !waarden.starttijd ||
      !waarden.eindtijd ||
      waarden.eindtijd > waarden.starttijd,
    {
      message: "De eindtijd moet na de starttijd liggen.",
      path: ["eindtijd"],
    },
  );

export type AfspraakFormulier = z.infer<typeof afspraakSchema>;

export const klantSchema = z.object({
  naam: z
    .string()
    .trim()
    .min(1, "Vul de naam van de school in.")
    .max(200, "De naam is te lang."),
  plaats: z.string().trim().min(1, "Vul de plaats in.").max(100),
  adres: z.string().trim().max(200).optional(),
  postcode: z.string().trim().max(10).optional(),
  reistijdEnkelMinuten: z.coerce
    .number({ message: "Vul de reistijd in minuten in." })
    .int("Vul hele minuten in.")
    .min(0, "Reistijd kan niet negatief zijn.")
    .max(600, "Meer dan 600 minuten enkele reis lijkt een vergissing."),
  reisafstandEnkelKm: z.coerce
    .number({ message: "Vul de afstand in kilometers in." })
    .min(0, "Afstand kan niet negatief zijn.")
    .max(1000)
    .optional(),
  telefoonAlgemeen: z.string().trim().max(30).optional(),
  emailAlgemeen: z
    .union([z.literal(""), z.email("Vul een geldig e-mailadres in.")])
    .optional(),
  contactpersoonNaam: z.string().trim().max(100).optional(),
  contactpersoonFunctie: z.string().trim().max(100).optional(),
  contactpersoonEmail: z
    .union([z.literal(""), z.email("Vul een geldig e-mailadres in.")])
    .optional(),
});

export type KlantFormulier = z.infer<typeof klantSchema>;

export const urenregelSchema = z.object({
  datum: isoDatum,
  categorie: z.enum(
    [
      "administratie",
      "overleg",
      "scholing",
      "acquisitie",
      "reistijd",
      "overig",
    ],
    { message: "Kies een categorie." },
  ),
  uren: z.coerce
    .number({ message: "Vul een aantal uren in." })
    .min(0.01, "Vul een aantal uren groter dan nul in.")
    .max(24, "Meer dan 24 uur op één dag kan niet."),
  toelichting: z.string().trim().max(500).optional(),
});

export type UrenregelFormulier = z.infer<typeof urenregelSchema>;
