import { describe, expect, it } from "vitest";

import {
  bedragVanRit,
  kmVanRit,
  metersNaarKm,
  rittenTotaal,
} from "../ritten";

/**
 * Rekenregels voor ritten (SPEC.md 5.7). De vergoeding komt als argument
 * binnen; € 0,25 is de waarde die de opdrachtgever heeft opgegeven.
 */

const VERGOEDING = 0.25;

describe("kilometers van een rit (SPEC.md 5.7)", () => {
  it("telt een enkele reis één keer", () => {
    expect(kmVanRit({ kmEnkel: 23.4, heenEnTerug: false })).toBe(23.4);
  });

  it("telt heen en terug dubbel", () => {
    expect(kmVanRit({ kmEnkel: 23.4, heenEnTerug: true })).toBe(46.8);
  });

  it("rekent meters van de routeplanner om naar kilometers op één decimaal", () => {
    expect(metersNaarKm(10_437)).toBe(10.4);
    expect(metersNaarKm(10_450)).toBe(10.5);
    expect(metersNaarKm(0)).toBe(0);
  });
});

describe("vergoeding van een rit (SPEC.md 5.7)", () => {
  it("rekent kilometers × vergoeding", () => {
    expect(
      bedragVanRit({ kmEnkel: 23.4, heenEnTerug: true, vergoedingPerKm: VERGOEDING }),
    ).toBe(11.7);
  });

  it("rondt af op hele centen, halve centen naar boven", () => {
    // 10,1 km × € 0,25 = € 2,525 → € 2,53
    expect(
      bedragVanRit({ kmEnkel: 10.1, heenEnTerug: false, vergoedingPerKm: VERGOEDING }),
    ).toBe(2.53);
  });

  it("rekent met de vergoeding die bij de rit staat", () => {
    expect(
      bedragVanRit({ kmEnkel: 10, heenEnTerug: false, vergoedingPerKm: 0.23 }),
    ).toBe(2.3);
  });
});

describe("maandtotaal (SPEC.md 5.7)", () => {
  // Voorbeeldmaand uit SPEC.md 5.7.
  const maand = [
    { kmEnkel: 23.4, heenEnTerug: true, vergoedingPerKm: VERGOEDING }, // 46,8 km  € 11,70
    { kmEnkel: 10.1, heenEnTerug: false, vergoedingPerKm: VERGOEDING }, // 10,1 km  €  2,53
    { kmEnkel: 10.1, heenEnTerug: false, vergoedingPerKm: VERGOEDING }, // 10,1 km  €  2,53
  ];

  it("telt de kilometers op", () => {
    expect(rittenTotaal(maand).km).toBe(67);
  });

  it("telt de afgeronde bedragen per rit op, zodat de regels precies kloppen", () => {
    // 11,70 + 2,53 + 2,53 = 16,76. Rekenen over het totaal zou 67 × 0,25 =
    // 16,75 geven: dan tellen de regels in de Excel niet op tot het totaal.
    expect(rittenTotaal(maand).bedrag).toBe(16.76);
  });

  it("telt het aantal ritten", () => {
    expect(rittenTotaal(maand).aantal).toBe(3);
  });

  it("geeft nul bij een maand zonder ritten", () => {
    expect(rittenTotaal([])).toEqual({ aantal: 0, km: 0, bedrag: 0 });
  });

  it("houdt een tariefwijziging halverwege de maand per rit apart", () => {
    const totaal = rittenTotaal([
      { kmEnkel: 10, heenEnTerug: false, vergoedingPerKm: 0.23 }, // € 2,30
      { kmEnkel: 10, heenEnTerug: false, vergoedingPerKm: 0.25 }, // € 2,50
    ]);
    expect(totaal.bedrag).toBe(4.8);
  });
});
