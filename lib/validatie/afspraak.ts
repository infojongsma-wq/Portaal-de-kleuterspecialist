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

/**
 * Het afspraakformulier van de medewerker.
 *
 * De uren en de reistijd staan hier bewust niet in: die leidt de server af uit
 * de activiteitsoort en de school. Wat de browser daarover zou meesturen wordt
 * genegeerd, zodat een medewerker de urenregistratie niet kan sturen.
 *
 * De datum mag leeg zijn. Dat betekent "nog in te plannen": met de school
 * afgesproken, maar er staat nog geen dag voor.
 */
export const afspraakSchema = z
  .object({
    id: z.string().optional(),
    klantId: z.string().min(1, "Kies een school."),
    contactpersoonId: z.string().optional(),
    activiteitsoortId: z.string().min(1, "Kies een soort training."),
    titel: z
      .string()
      .trim()
      .min(1, "Vul de naam van de training in.")
      .max(200, "De naam is te lang; maximaal 200 tekens."),
    datum: z.union([isoDatum, z.literal("")]),
    dagdelen: z
      .array(z.enum(["ochtend", "middag", "anders"]))
      .min(1, "Kies minstens één dagdeel."),
    andersOmschrijving: z.string().trim().max(200).optional(),
    starttijd: z.string().optional(),
    eindtijd: z.string().optional(),
    afsprakenMetKlant: vrijeTekst.optional(),
    notitie: vrijeTekst.optional(),
    voltooid: z.boolean(),
  })
  // "Anders, namelijk" is verplicht zodra "Anders" is aangevinkt.
  .refine(
    (waarden) =>
      !waarden.dagdelen.includes("anders") ||
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
  )
  // Zonder datum valt er niets af te vinken als voltooid.
  .refine((waarden) => !waarden.voltooid || waarden.datum !== "", {
    message: "Vul eerst een datum in voordat je de training afvinkt.",
    path: ["datum"],
  });

/** Trainingen in één keer aan een school hangen, zonder datum. */
export const afgesprokenTrainingenSchema = z.object({
  klantId: z.string().min(1, "Kies een school."),
  activiteitsoortIds: z
    .array(z.string().min(1))
    .min(1, "Kies minstens één soort training."),
});

/** Beheer: een soort training aanmaken of wijzigen (SPEC.md 4.5). */
export const activiteitsoortSchema = z.object({
  id: z.string().optional(),
  naam: z
    .string()
    .trim()
    .min(1, "Vul een naam in.")
    .max(100, "De naam is te lang."),
  urenOpLocatie: z.coerce
    .number({ message: "Vul de uren op locatie in." })
    .min(0, "Uren kunnen niet negatief zijn.")
    .max(24, "Meer dan 24 uur op één dag kan niet."),
  urenVoorbereiding: z.coerce
    .number({ message: "Vul de voorbereidingsuren in." })
    .min(0, "Uren kunnen niet negatief zijn.")
    .max(24, "Meer dan 24 uur op één dag kan niet."),
  kleur: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Kies een kleur.")
    .default("#3b82f6"),
  volgorde: z.coerce.number().int().min(0).max(999).default(0),
  actief: z.boolean().default(true),
});

export type ActiviteitsoortFormulier = z.infer<typeof activiteitsoortSchema>;

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
