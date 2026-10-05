import { z } from "zod";

/**
 * Wat er van een medewerkersprofiel wordt vastgelegd (SPEC.md 4.1 en 6.6).
 *
 * De standplaats staat erbij omdat de eigen reistijd per dag daarvandaan
 * wordt gerekend (SPEC.md 5.6). Rol, dienstverband en e-mailadres kunnen
 * alleen door een beheerder worden gewijzigd; dat bewaakt de database zelf met
 * een trigger, niet dit schema.
 */

const datumOfLeeg = z
  .union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vul een geldige datum in."),
  ])
  .optional();

export const medewerkerSchema = z
  .object({
    id: z.string().uuid().optional(),
    voornaam: z
      .string()
      .trim()
      .min(1, "Vul de voornaam in.")
      .max(100, "De voornaam is te lang."),
    achternaam: z.string().trim().max(100, "De achternaam is te lang."),
    email: z.email("Vul een geldig e-mailadres in."),
    rol: z.enum(["beheerder", "medewerker"], {
      message: "Kies beheerder of medewerker.",
    }),
    inDienstVanaf: datumOfLeeg,
    uitDienstPer: datumOfLeeg,
    standplaatsAdres: z.string().trim().max(200).optional(),
    standplaatsPostcode: z.string().trim().max(10).optional(),
    standplaatsPlaats: z.string().trim().max(100).optional(),
    telefoon: z.string().trim().max(30).optional(),
    actief: z.boolean(),
  })
  .refine(
    (waarden) =>
      !waarden.inDienstVanaf ||
      !waarden.uitDienstPer ||
      waarden.uitDienstPer >= waarden.inDienstVanaf,
    {
      message: "De einddatum ligt vóór de datum van indiensttreding.",
      path: ["uitDienstPer"],
    },
  );

export type MedewerkerFormulier = z.infer<typeof medewerkerSchema>;
