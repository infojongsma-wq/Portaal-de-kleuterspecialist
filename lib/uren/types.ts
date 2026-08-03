/** Status van een afspraak (SPEC.md 4.6). */
export type AfspraakStatus = "gepland" | "voltooid" | "geannuleerd" | "verzet";

/** Categorie van een urenregel (SPEC.md 4.7). */
export type UrenCategorie =
  | "op_locatie"
  | "voorbereiding"
  | "reistijd"
  | "administratie"
  | "overleg"
  | "scholing"
  | "acquisitie"
  | "overig"
  // Nog niet in scope (SPEC.md 4.7 en 10), wel alvast toegestaan in het model.
  | "verlof"
  | "ziekte"
  | "feestdag";

/**
 * Welke kolom wordt berekend (SPEC.md 5.4, "Gepland versus gerealiseerd").
 *
 * - `gepland`      — alle afspraken met status `gepland` of `voltooid`
 * - `gerealiseerd` — alleen status `voltooid`; telt mee voor het saldo
 */
export type Telwijze = "gepland" | "gerealiseerd";

/** De velden van een afspraak die de urenberekening nodig heeft. */
export interface AfspraakInvoer {
  id: string;
  /** Dag van het bezoek, ISO `jjjj-mm-dd`. */
  datum: string;
  /** Dag waarop de voorbereiding wordt geboekt, ISO `jjjj-mm-dd`. */
  voorbereidingDatum: string;
  /** Overgenomen uit de activiteitsoort. */
  urenOpLocatie: number;
  /** Overgenomen uit de activiteitsoort. */
  urenVoorbereiding: number;
  /** Enkele reis vanaf de standplaats van de medewerker, in minuten. */
  reistijdEnkelMinuten: number | null;
  status: AfspraakStatus;
  voorbereidingGedaan: boolean;
}

/** Een handmatig geboekte urenregel (SPEC.md 4.7). */
export interface UrenregelInvoer {
  /** ISO `jjjj-mm-dd`. */
  datum: string;
  categorie: UrenCategorie;
  uren: number;
}
