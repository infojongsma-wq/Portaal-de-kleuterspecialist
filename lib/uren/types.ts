/** Status van een afspraak (SPEC.md 4.6). */
export type AfspraakStatus = "gepland" | "voltooid" | "geannuleerd" | "verzet";

/** Categorie van een urenregel (SPEC.md 4.7). */
export type UrenCategorie =
  // Afgeleid uit afspraken; niet handmatig te boeken.
  | "op_locatie"
  | "voorbereiding"
  | "reistijd"
  // Handmatig te boeken door de medewerker.
  | "inlezen_trainingen"
  | "literatuur_lezen"
  | "overleg"
  | "overig"
  // Bestaande categorieën; blijven geldig voor eerder geboekte uren.
  | "administratie"
  | "scholing"
  | "acquisitie"
  // Nog niet in scope (SPEC.md 4.7 en 10), wel alvast toegestaan in het model.
  | "verlof"
  | "ziekte"
  | "feestdag";

/**
 * De categorieën die de medewerker zelf kan boeken, met hun label.
 *
 * Reistijd staat er als "boven het uur enkele reis" in: de eerste 60 minuten
 * heen en de eerste 60 minuten terug zijn eigen tijd (SPEC.md 5.2, waar dat
 * als 2,0 uur per dag staat).
 */
export const HANDMATIGE_CATEGORIEEN = [
  { waarde: "inlezen_trainingen", label: "Inlezen trainingen" },
  { waarde: "literatuur_lezen", label: "Literatuur lezen" },
  { waarde: "overleg", label: "Overleg" },
  { waarde: "reistijd", label: "Reistijd boven het uur enkele reis" },
  { waarde: "overig", label: "Overig" },
] as const satisfies ReadonlyArray<{ waarde: UrenCategorie; label: string }>;

/** Alle labels, ook van categorieën die niet handmatig te boeken zijn. */
export const CATEGORIELABELS: Record<UrenCategorie, string> = {
  op_locatie: "Op locatie",
  voorbereiding: "Voorbereiding",
  reistijd: "Reistijd boven het uur enkele reis",
  inlezen_trainingen: "Inlezen trainingen",
  literatuur_lezen: "Literatuur lezen",
  overleg: "Overleg",
  overig: "Overig",
  administratie: "Administratie",
  scholing: "Scholing",
  acquisitie: "Acquisitie",
  verlof: "Verlof",
  ziekte: "Ziekte",
  feestdag: "Feestdag",
};

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
  /**
   * Dag van het bezoek, ISO `jjjj-mm-dd`.
   *
   * `null` betekent "nog in te plannen": de school heeft de training
   * afgesproken maar er staat nog geen datum. Zulke afspraken tellen nergens
   * mee — niet in gepland en niet in gerealiseerd — tot er een datum is.
   */
  datum: string | null;
  /** Dag waarop de voorbereiding wordt geboekt, ISO `jjjj-mm-dd`. */
  voorbereidingDatum: string | null;
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
