import { afrondUren } from "./afronding";
import type { AfspraakStatus, Telwijze } from "./types";

/** Basisuren van één afspraak: op locatie plus voorbereiding (SPEC.md 5.1). */
export function basisUren(
  urenOpLocatie: number,
  urenVoorbereiding: number,
): number {
  return afrondUren(urenOpLocatie + urenVoorbereiding);
}

/**
 * Telt de afspraak mee in deze kolom op grond van de status alleen?
 *
 * | Telwijze     | Statussen die meetellen |
 * |--------------|-------------------------|
 * | gepland      | `gepland`, `voltooid`   |
 * | gerealiseerd | `voltooid`              |
 */
function statusTelt(status: AfspraakStatus, telwijze: Telwijze): boolean {
  return telwijze === "gepland"
    ? status === "gepland" || status === "voltooid"
    : status === "voltooid";
}

/**
 * Tellen de locatie-uren mee? (statusmatrix SPEC.md 5.5)
 *
 * Bij `verzet` tellen ze niet — die uren horen bij de nieuwe afspraak.
 *
 * LET OP — tegenstrijdigheid in SPEC.md, hier opgelost ten gunste van 5.5:
 * de formule in 5.3 zegt "status ≠ geannuleerd", wat `verzet` zou meetellen,
 * terwijl de statusmatrix in 5.5 `verzet` expliciet uitsluit. De matrix is
 * specifieker en voorkomt dubbeltelling met de vervangende afspraak.
 */
export function teltLocatieUren(
  status: AfspraakStatus,
  telwijze: Telwijze,
): boolean {
  return statusTelt(status, telwijze);
}

/**
 * Tellen de voorbereidingsuren mee? (statusmatrix SPEC.md 5.5)
 *
 * Bij `geannuleerd` en `verzet` alleen als de voorbereiding daadwerkelijk is
 * gedaan. Die uren zijn dan echt gewerkt, dus ze tellen in beide kolommen.
 */
export function teltVoorbereidingUren(
  status: AfspraakStatus,
  voorbereidingGedaan: boolean,
  telwijze: Telwijze,
): boolean {
  if (statusTelt(status, telwijze)) return true;
  return (
    (status === "geannuleerd" || status === "verzet") && voorbereidingGedaan
  );
}

/** Telt de reistijd van deze afspraak mee? (statusmatrix SPEC.md 5.5) */
export function teltReistijd(
  status: AfspraakStatus,
  telwijze: Telwijze,
): boolean {
  return statusTelt(status, telwijze);
}
