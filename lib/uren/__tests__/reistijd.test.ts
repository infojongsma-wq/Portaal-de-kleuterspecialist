import { describe, expect, it } from "vitest";
import {
  afrondAutomatischeReistijdMinuten,
  brutoReistijdUren,
  declarabeleReistijdUren,
  langsteEnkeleReisMinuten,
} from "../reistijd";
import { maakAfspraak } from "./hulp";

/** Uit `instellingen.eigen_reistijd_uren_per_dag`, standaardwaarde. */
const EIGEN_REISTIJD = 2.0;

describe("reistijd per dag (SPEC.md 5.2)", () => {
  // Exact de tabel uit SPEC.md 5.2.
  const testgevallen: Array<{
    enkeleReis: number;
    bruto: number;
    declarabel: number;
  }> = [
    { enkeleReis: 0, bruto: 0.0, declarabel: 0.0 },
    { enkeleReis: 35, bruto: 1.17, declarabel: 0.0 },
    { enkeleReis: 60, bruto: 2.0, declarabel: 0.0 },
    { enkeleReis: 61, bruto: 2.03, declarabel: 0.03 },
    { enkeleReis: 90, bruto: 3.0, declarabel: 1.0 },
    { enkeleReis: 135, bruto: 4.5, declarabel: 2.5 },
    { enkeleReis: 160, bruto: 5.33, declarabel: 3.33 },
  ];

  for (const { enkeleReis, bruto, declarabel } of testgevallen) {
    it(`enkele reis van ${enkeleReis} minuten geeft ${bruto} bruto en ${declarabel} declarabel`, () => {
      expect(brutoReistijdUren(enkeleReis)).toBe(bruto);
      expect(declarabeleReistijdUren(enkeleReis, EIGEN_REISTIJD)).toBe(
        declarabel,
      );
    });
  }

  it("wordt nooit negatief", () => {
    expect(declarabeleReistijdUren(5, EIGEN_REISTIJD)).toBe(0);
  });

  it("volgt een gewijzigde eigen reistijd uit de instellingen", () => {
    // De 2 uur is instelbaar en staat daarom niet in de code.
    expect(declarabeleReistijdUren(90, 1.0)).toBe(2.0);
    expect(declarabeleReistijdUren(90, 0)).toBe(3.0);
  });
});

describe("langste enkele reis van een dag (SPEC.md 5.2)", () => {
  it("neemt de verste bestemming, niet de som", () => {
    const afspraken = [
      maakAfspraak({ id: "a", reistijdEnkelMinuten: 25 }),
      maakAfspraak({ id: "b", reistijdEnkelMinuten: 90 }),
      maakAfspraak({ id: "c", reistijdEnkelMinuten: 40 }),
    ];
    expect(langsteEnkeleReisMinuten(afspraken)).toBe(90);
  });

  it("geeft 0 zonder afspraken met reistijd", () => {
    expect(langsteEnkeleReisMinuten([])).toBe(0);
    expect(
      langsteEnkeleReisMinuten([maakAfspraak({ reistijdEnkelMinuten: null })]),
    ).toBe(0);
  });
});

describe("afronding van automatisch bepaalde reistijd (SPEC.md 5.6)", () => {
  it("rondt af op hele stappen van 5 minuten", () => {
    expect(afrondAutomatischeReistijdMinuten(61, 5)).toBe(60);
    expect(afrondAutomatischeReistijdMinuten(63, 5)).toBe(65);
    expect(afrondAutomatischeReistijdMinuten(87, 5)).toBe(85);
  });

  it("volgt een andere afrondingsinstelling", () => {
    expect(afrondAutomatischeReistijdMinuten(61, 15)).toBe(60);
    expect(afrondAutomatischeReistijdMinuten(61, 1)).toBe(61);
  });
});
