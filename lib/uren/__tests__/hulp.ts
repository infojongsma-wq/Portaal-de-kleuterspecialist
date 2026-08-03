import type { AfspraakInvoer } from "../types";

/**
 * Bouwt een afspraak voor de tests. Standaard een training van 3,0 + 3,0 uur
 * met status `gepland` en zonder reistijd; overschrijf wat de test nodig heeft.
 *
 * De uren staan hier als testgegeven, niet als rekenregel — in de app komen ze
 * uit `activiteitsoorten`.
 */
export function maakAfspraak(
  velden: Partial<AfspraakInvoer> = {},
): AfspraakInvoer {
  const datum = velden.datum ?? "2027-03-10";
  return {
    id: "afspraak-1",
    datum,
    voorbereidingDatum: datum,
    urenOpLocatie: 3.0,
    urenVoorbereiding: 3.0,
    reistijdEnkelMinuten: null,
    status: "gepland",
    voorbereidingGedaan: false,
    ...velden,
  };
}
