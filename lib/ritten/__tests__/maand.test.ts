import { describe, expect, it } from "vitest";

import {
  inMaand,
  isMaand,
  maandNaam,
  vandaagInNederland,
  verschuifMaand,
} from "../maand";

describe("maanden van de rittenregistratie", () => {
  it("herkent een geldige maand", () => {
    expect(isMaand("2026-10")).toBe(true);
    expect(isMaand("2026-13")).toBe(false);
    expect(isMaand("2026-1")).toBe(false);
    expect(isMaand(null)).toBe(false);
  });

  it("schuift over de jaargrens", () => {
    expect(verschuifMaand("2026-12", 1)).toBe("2027-01");
    expect(verschuifMaand("2027-01", -1)).toBe("2026-12");
  });

  it("geeft de maand een Nederlandse naam", () => {
    expect(maandNaam("2026-10")).toBe("oktober 2026");
  });

  it("weet of een datum in een maand valt", () => {
    expect(inMaand("2026-10-31", "2026-10")).toBe(true);
    expect(inMaand("2026-11-01", "2026-10")).toBe(false);
  });

  it("neemt de Nederlandse datum, ook als het in UTC nog gisteren is", () => {
    // 1 november 2026, 00:30 in Nederland = 31 oktober, 23:30 UTC.
    expect(vandaagInNederland(new Date("2026-10-31T23:30:00Z"))).toBe(
      "2026-11-01",
    );
    // Zomertijd: 1 juli 2026, 01:30 in Nederland = 30 juni, 23:30 UTC.
    expect(vandaagInNederland(new Date("2026-06-30T23:30:00Z"))).toBe(
      "2026-07-01",
    );
  });
});
