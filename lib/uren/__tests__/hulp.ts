import type { RitReistijdInvoer } from "../reistijd";
import type { AfspraakInvoer } from "../types";

/**
 * Bouwt een afspraak voor de tests. Standaard een training van 3,0 + 3,0 uur
 * met status `gepland`; overschrijf wat de test nodig heeft. Reistijd hoort
 * niet bij een afspraak maar bij een rit; zie `maakRit`.
 *
 * De uren staan hier als testgegeven, niet als rekenregel — in de app komen ze
 * uit `activiteitsoorten`.
 */
export function maakAfspraak(
  velden: Partial<AfspraakInvoer> = {},
): AfspraakInvoer {
  // Niet `??` gebruiken: een test die bewust `datum: null` doorgeeft — een
  // afspraak die nog ingepland moet worden — zou dan de standaarddatum krijgen.
  const datum = "datum" in velden ? velden.datum! : "2027-03-10";
  return {
    id: "afspraak-1",
    datum,
    voorbereidingDatum: datum,
    urenOpLocatie: 3.0,
    urenVoorbereiding: 3.0,
    status: "gepland",
    voorbereidingGedaan: false,
    ...velden,
  };
}

/**
 * Bouwt een rit voor de tests: standaard heen en terug, met een berekende
 * reisduur van 60 minuten per enkele reis en zonder afwijkende reistijd.
 */
export function maakRit(
  velden: Partial<RitReistijdInvoer> = {},
): RitReistijdInvoer {
  return {
    datum: "2027-03-10",
    heenEnTerug: true,
    reisduurEnkelMinuten: 60,
    afwijkendeReistijdMinuten: null,
    ...velden,
  };
}
