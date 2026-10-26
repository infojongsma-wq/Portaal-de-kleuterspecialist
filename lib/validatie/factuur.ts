import { z } from "zod";

/**
 * Het vinkje "Factuur verstuurd" bij een gedane training (SPEC.md 6.6).
 * Wordt in de server action gecontroleerd; invoer van de client wordt nooit
 * vertrouwd.
 */
export const factuurVinkjeSchema = z.object({
  afspraakId: z.uuid("Deze training is niet gevonden."),
  verstuurd: z.boolean(),
});

export type FactuurVinkje = z.infer<typeof factuurVinkjeSchema>;
