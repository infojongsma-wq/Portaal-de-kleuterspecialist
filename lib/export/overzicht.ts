import {
  haalAfsprakenMetContext,
  haalInstellingen,
  urenVanAfspraakSync,
} from "@/lib/data/queries";
import type { AfspraakMetContext, Instellingen } from "@/lib/data/types";
import type { AfspraakStatus } from "@/lib/uren";

/**
 * De selectie en de kolommen van het overzicht, op één plek.
 *
 * Zowel het scherm als de Excel-export gebruikt dit, zodat wat je exporteert
 * altijd gelijk is aan wat je op het scherm ziet staan.
 */

export const STATUSLABELS: Record<AfspraakStatus, string> = {
  gepland: "Gepland",
  voltooid: "Voltooid",
  geannuleerd: "Geannuleerd",
  verzet: "Verzet",
};

export type Sorteerveld =
  | "datum"
  | "klant"
  | "soort"
  | "titel"
  | "uren"
  | "status";

export interface OverzichtFilters {
  vanaf: string;
  totEnMet: string;
  klantId: string;
  soortId: string;
  status: string;
  sorteer: Sorteerveld;
  aflopend: boolean;
}

export function leesFilters(
  parameters: Record<string, string | string[] | undefined>,
): OverzichtFilters {
  const tekst = (waarde: string | string[] | undefined) =>
    Array.isArray(waarde) ? (waarde[0] ?? "") : (waarde ?? "");

  return {
    vanaf: tekst(parameters.vanaf),
    totEnMet: tekst(parameters.tot),
    klantId: tekst(parameters.klant),
    soortId: tekst(parameters.soort),
    status: tekst(parameters.status),
    sorteer: (tekst(parameters.sorteer) || "datum") as Sorteerveld,
    aflopend: tekst(parameters.richting) === "af",
  };
}

export interface Overzicht {
  afspraken: AfspraakMetContext[];
  instellingen: Instellingen;
  totaalUren: number;
}

export async function haalOverzicht(
  medewerkerId: string,
  filters: OverzichtFilters,
): Promise<Overzicht> {
  const [alle, instellingen] = await Promise.all([
    haalAfsprakenMetContext(medewerkerId),
    haalInstellingen(),
  ]);

  const afspraken = alle
    // Een afspraak zonder datum valt buiten elke periode; is er geen
    // periodefilter, dan hoort hij er wel gewoon bij te staan.
    .filter(
      (afspraak) => !filters.vanaf || (afspraak.datum ?? "") >= filters.vanaf,
    )
    .filter(
      (afspraak) =>
        !filters.totEnMet ||
        (!!afspraak.datum && afspraak.datum <= filters.totEnMet),
    )
    .filter(
      (afspraak) => !filters.klantId || afspraak.klantId === filters.klantId,
    )
    .filter(
      (afspraak) =>
        !filters.soortId || afspraak.activiteitsoortId === filters.soortId,
    )
    .filter((afspraak) => !filters.status || afspraak.status === filters.status)
    .sort(vergelijker(instellingen, filters.sorteer, filters.aflopend));

  const totaal = afspraken.reduce(
    (som, afspraak) =>
      som + urenVanAfspraakSync(instellingen, afspraak).totaal,
    0,
  );

  return { afspraken, instellingen, totaalUren: totaal };
}

function vergelijker(
  instellingen: Instellingen,
  veld: Sorteerveld,
  aflopend: boolean,
) {
  const richting = aflopend ? -1 : 1;
  return (a: AfspraakMetContext, b: AfspraakMetContext) => {
    const uitkomst = (() => {
      switch (veld) {
        case "klant":
          return a.klant.naam.localeCompare(b.klant.naam, "nl");
        case "soort":
          return a.activiteitsoort.naam.localeCompare(
            b.activiteitsoort.naam,
            "nl",
          );
        case "titel":
          return a.titel.localeCompare(b.titel, "nl");
        case "uren":
          return (
            urenVanAfspraakSync(instellingen, a).totaal -
            urenVanAfspraakSync(instellingen, b).totaal
          );
        case "status":
          return a.status.localeCompare(b.status, "nl");
        default:
          // Afspraken zonder datum achteraan.
          if (!a.datum) return b.datum ? 1 : 0;
          if (!b.datum) return -1;
          return a.datum.localeCompare(b.datum);
      }
    })();
    return uitkomst * richting;
  };
}

/** Bouwt de zoekreeks voor een sorteerlink of voor de exportknop. */
export function zoekreeks(
  filters: OverzichtFilters,
  overschrijf: Partial<Pick<OverzichtFilters, "sorteer" | "aflopend">> = {},
): string {
  const reeks = new URLSearchParams();
  if (filters.vanaf) reeks.set("vanaf", filters.vanaf);
  if (filters.totEnMet) reeks.set("tot", filters.totEnMet);
  if (filters.klantId) reeks.set("klant", filters.klantId);
  if (filters.soortId) reeks.set("soort", filters.soortId);
  if (filters.status) reeks.set("status", filters.status);
  reeks.set("sorteer", overschrijf.sorteer ?? filters.sorteer);
  reeks.set(
    "richting",
    (overschrijf.aflopend ?? filters.aflopend) ? "af" : "op",
  );
  return reeks.toString();
}
