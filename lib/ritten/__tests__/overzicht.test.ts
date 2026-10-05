import { describe, expect, it } from "vitest";

import type { Rit } from "@/lib/data/types";
import { rittenmaand } from "../overzicht";

/** Verzonnen ritten en medewerkers (CLAUDE.md). */
function rit(velden: Partial<Rit>): Rit {
  return {
    id: "rit",
    medewerkerId: "a",
    datum: "2026-10-05",
    doel: "Training bij een school",
    vanPlaats: "Thuis",
    naarPlaats: "Hengelo",
    heenEnTerug: true,
    kmEnkel: 23.4,
    vergoedingPerKm: 0.25,
    aangemaaktOp: "2026-10-05T08:00:00Z",
    ...velden,
  };
}

const MEDEWERKERS = [
  { id: "b", naam: "Proef Bakker", actief: true },
  { id: "a", naam: "Proef Aalders", actief: true },
  { id: "c", naam: "Proef Claassen", actief: false },
];

describe("ritten-overzicht in Beheer (SPEC.md 6.6)", () => {
  const ritten = [
    rit({ id: "1" }), // a: 46,8 km, € 11,70
    rit({ id: "2", kmEnkel: 10.1, heenEnTerug: false }), // a: 10,1 km, € 2,53
    rit({ id: "3", medewerkerId: "b", kmEnkel: 10, heenEnTerug: false }), // b: 10 km, € 2,50
    rit({ id: "4", datum: "2026-09-30" }), // andere maand
  ];

  it("telt per medewerker de ritten van de maand", () => {
    const { regels } = rittenmaand(ritten, "2026-10", MEDEWERKERS);
    expect(regels.map((regel) => [regel.naam, regel.totaal])).toEqual([
      ["Proef Aalders", { aantal: 2, km: 56.9, bedrag: 14.23 }],
      ["Proef Bakker", { aantal: 1, km: 10, bedrag: 2.5 }],
    ]);
  });

  it("telt iedereen samen op", () => {
    expect(rittenmaand(ritten, "2026-10", MEDEWERKERS).totaal).toEqual({
      aantal: 3,
      km: 66.9,
      bedrag: 16.73,
    });
  });

  it("toont een actieve medewerker ook zonder ritten", () => {
    const { regels } = rittenmaand([], "2026-10", MEDEWERKERS);
    expect(regels.map((regel) => regel.naam)).toEqual(["Proef Aalders", "Proef Bakker"]);
  });

  it("toont iemand die niet meer actief is alleen als er ritten zijn", () => {
    const { regels } = rittenmaand(
      [rit({ medewerkerId: "c" })],
      "2026-10",
      MEDEWERKERS,
    );
    expect(regels.map((regel) => regel.naam)).toContain("Proef Claassen");
  });
});
