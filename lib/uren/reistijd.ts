import { afrondMinuten, afrondUren } from "./afronding";
import type { AfspraakInvoer } from "./types";

/**
 * Bruto reistijd voor een dag met klantbezoek: heen en terug (SPEC.md 5.2).
 * Alleen bedoeld voor weergave — voor de declarabele uren wordt de onafgeronde
 * waarde gebruikt, zodat er niet twee keer wordt afgerond.
 */
export function brutoReistijdUren(reistijdEnkelMinuten: number): number {
  return afrondUren(brutoReistijdUrenExact(reistijdEnkelMinuten));
}

function brutoReistijdUrenExact(reistijdEnkelMinuten: number): number {
  return (2 * reistijdEnkelMinuten) / 60;
}

/**
 * Declarabele reistijd voor een dag met klantbezoek (SPEC.md 5.2):
 *
 *     declarabel = MAX(0 ; 2 × enkele reis ÷ 60 − eigen reistijd per dag)
 *
 * De eigen tijd gaat er **één keer per dag** af, niet één keer per afspraak.
 * Bij meerdere afspraken op één dag geeft de aanroeper daarom de langste
 * enkele reis door, niet de som — zie `langsteEnkeleReisMinuten`.
 *
 * Op dagen zonder klantbezoek geldt de aftrek niet; reistijd naar bijvoorbeeld
 * een netwerkbijeenkomst wordt als handmatige urenregel geboekt.
 */
export function declarabeleReistijdUren(
  reistijdEnkelMinuten: number,
  eigenReistijdUrenPerDag: number,
): number {
  const bruto = brutoReistijdUrenExact(reistijdEnkelMinuten);
  return afrondUren(Math.max(0, bruto - eigenReistijdUrenPerDag));
}

/**
 * De langste enkele reis van een dag. Geeft `0` als er geen afspraak met
 * reistijd is.
 */
export function langsteEnkeleReisMinuten(afspraken: AfspraakInvoer[]): number {
  return afspraken.reduce(
    (langste, afspraak) => Math.max(langste, afspraak.reistijdEnkelMinuten ?? 0),
    0,
  );
}

/**
 * Rondt automatisch bepaalde reistijd af vóór opslag (SPEC.md 5.6).
 * Roep dit niet aan voor handmatig ingevoerde reistijd.
 */
export function afrondAutomatischeReistijdMinuten(
  minuten: number,
  afrondingMinuten: number,
): number {
  return afrondMinuten(minuten, afrondingMinuten);
}
