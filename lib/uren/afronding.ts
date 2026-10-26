import { UREN_DECIMALEN } from "./constants";

/**
 * Rondt af op een vast aantal decimalen, halve waarden van nul af.
 *
 * De naïeve variant `Math.round(x * 100) / 100` gaat mis bij waarden die
 * binair niet exact zijn: `1.005 * 100` is `100.49999999999999` en zou dus
 * naar 1,00 afronden in plaats van naar 1,01. Door de komma te verschuiven
 * via de exponentnotatie van het getal zelf treedt die fout niet op.
 *
 * Bij urenregistratie telt dit: een cent per afspraak is een uur per jaar.
 */
export function afrondOpDecimalen(waarde: number, decimalen: number): number {
  if (!Number.isFinite(waarde)) return waarde;

  const teken = waarde < 0 ? -1 : 1;
  const absoluut = Math.abs(waarde);

  const [mantisse, exponent] = `${absoluut}e`.split("e");
  const verschoven = Math.round(
    Number(`${mantisse}e${Number(exponent) + decimalen}`),
  );

  const [mantisseTerug, exponentTerug] = `${verschoven}e`.split("e");
  return teken * Number(`${mantisseTerug}e${Number(exponentTerug) - decimalen}`);
}

/** Rondt uren af op twee decimalen (SPEC.md 5.6). */
export function afrondUren(uren: number): number {
  return afrondOpDecimalen(uren, UREN_DECIMALEN);
}

/**
 * Rondt minuten af op hele stappen.
 *
 * Geldt alleen voor **automatisch bepaalde** reistijd (SPEC.md 5.6).
 * Handmatig ingevoerde reistijd blijft exact zoals ingevoerd en loopt
 * daarom niet door deze functie heen.
 */
export function afrondMinuten(minuten: number, stapMinuten: number): number {
  if (!Number.isFinite(minuten)) return minuten;
  if (stapMinuten <= 0) return Math.round(minuten);
  return Math.round(minuten / stapMinuten) * stapMinuten;
}
