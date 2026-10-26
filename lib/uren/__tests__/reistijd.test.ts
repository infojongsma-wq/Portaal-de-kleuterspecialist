import { describe, expect, it } from "vitest";
import {
  afrondAutomatischeReistijdMinuten,
  reistijdVanDag,
  reistijdVanRitMinuten,
  reistijdVanRitten,
  secondenNaarReisduurMinuten,
} from "../reistijd";
import { maakRit } from "./hulp";

/** Uit `instellingen.eigen_reistijd_uren_per_dag`, standaardwaarde. */
const EIGEN_REISTIJD = 2.0;
const DAG = "2027-03-10";

describe("reistijd van een rit (SPEC.md 5.2)", () => {
  it("telt de berekende reisduur dubbel bij vice versa", () => {
    expect(reistijdVanRitMinuten(maakRit({ reisduurEnkelMinuten: 45 }))).toBe(90);
    expect(
      reistijdVanRitMinuten(maakRit({ reisduurEnkelMinuten: 45, heenEnTerug: false })),
    ).toBe(45);
  });

  it("neemt de afwijkende reistijd als die is ingevuld, zonder te verdubbelen", () => {
    // Berekend 2 × 60 minuten, maar door files 2 uur en 45 minuten in totaal.
    expect(
      reistijdVanRitMinuten(maakRit({ reisduurEnkelMinuten: 60, afwijkendeReistijdMinuten: 165 })),
    ).toBe(165);
  });

  it("is onbekend zonder berekende en zonder afwijkende reistijd", () => {
    expect(reistijdVanRitMinuten(maakRit({ reisduurEnkelMinuten: null }))).toBeNull();
  });
});

describe("reistijd per dag (SPEC.md 5.2)", () => {
  // De tabel uit SPEC.md 5.2.
  const testgevallen: Array<{
    omschrijving: string;
    ritten: ReturnType<typeof maakRit>[];
    bruto: number;
    eigen: number;
    werktijd: number;
  }> = [
    {
      omschrijving: "vice versa, 2 × 35 minuten",
      ritten: [maakRit({ reisduurEnkelMinuten: 35 })],
      bruto: 1.17,
      eigen: 1.17,
      werktijd: 0,
    },
    {
      omschrijving: "vice versa, 2 × 60 minuten",
      ritten: [maakRit({ reisduurEnkelMinuten: 60 })],
      bruto: 2.0,
      eigen: 2.0,
      werktijd: 0,
    },
    {
      omschrijving: "vice versa, afwijkende reistijd 2 uur en 2 minuten",
      ritten: [maakRit({ afwijkendeReistijdMinuten: 122 })],
      bruto: 2.03,
      eigen: 2.0,
      werktijd: 0.03,
    },
    {
      omschrijving: "vice versa, 2 × 90 minuten",
      ritten: [maakRit({ reisduurEnkelMinuten: 90 })],
      bruto: 3.0,
      eigen: 2.0,
      werktijd: 1.0,
    },
    {
      omschrijving: "vice versa, 2 × 135 minuten",
      ritten: [maakRit({ reisduurEnkelMinuten: 135 })],
      bruto: 4.5,
      eigen: 2.0,
      werktijd: 2.5,
    },
    {
      omschrijving: "vice versa, berekend 2 × 60 minuten, door files 2 uur en 45 minuten",
      ritten: [maakRit({ reisduurEnkelMinuten: 60, afwijkendeReistijdMinuten: 165 })],
      bruto: 2.75,
      eigen: 2.0,
      werktijd: 0.75,
    },
    {
      omschrijving: "één enkele reis van 90 minuten: een uur eigen tijd",
      ritten: [maakRit({ reisduurEnkelMinuten: 90, heenEnTerug: false })],
      bruto: 1.5,
      eigen: 1.0,
      werktijd: 0.5,
    },
    {
      omschrijving: "drie enkele reizen, 30 + 90 + 30 minuten: hooguit 2 uur eigen tijd",
      ritten: [
        maakRit({ reisduurEnkelMinuten: 30, heenEnTerug: false }),
        maakRit({ reisduurEnkelMinuten: 90, heenEnTerug: false }),
        maakRit({ reisduurEnkelMinuten: 30, heenEnTerug: false }),
      ],
      bruto: 2.5,
      eigen: 2.0,
      werktijd: 0.5,
    },
    {
      omschrijving: "twee ritten vice versa, 2 × 45 en 2 × 30 minuten",
      ritten: [
        maakRit({ reisduurEnkelMinuten: 45 }),
        maakRit({ reisduurEnkelMinuten: 30 }),
      ],
      bruto: 2.5,
      eigen: 2.0,
      werktijd: 0.5,
    },
  ];

  for (const { omschrijving, ritten, bruto, eigen, werktijd } of testgevallen) {
    it(omschrijving, () => {
      const dag = reistijdVanDag(DAG, ritten, EIGEN_REISTIJD);
      expect(dag.brutoUren).toBe(bruto);
      expect(dag.eigenTijdUren).toBe(eigen);
      expect(dag.werktijdUren).toBe(werktijd);
    });
  }

  it("telt alleen de ritten van die dag", () => {
    const dag = reistijdVanDag(
      DAG,
      [maakRit({ reisduurEnkelMinuten: 90 }), maakRit({ datum: "2027-03-11", reisduurEnkelMinuten: 90 })],
      EIGEN_REISTIJD,
    );
    expect(dag.werktijdUren).toBe(1.0);
    expect(dag.aantalRitten).toBe(1);
  });

  it("laat een rit zonder reistijd buiten de berekening, ook bij de eigen tijd", () => {
    const dag = reistijdVanDag(
      DAG,
      [
        maakRit({ reisduurEnkelMinuten: 90, heenEnTerug: false }),
        maakRit({ reisduurEnkelMinuten: null }),
      ],
      EIGEN_REISTIJD,
    );
    // Alleen de enkele reis van 90 minuten: 1,50 − 1,00 eigen tijd.
    expect(dag.werktijdUren).toBe(0.5);
    expect(dag.aantalRitten).toBe(1);
    expect(dag.aantalZonderReistijd).toBe(1);
  });

  it("geeft niets op een dag zonder ritten", () => {
    expect(reistijdVanDag(DAG, [], EIGEN_REISTIJD)).toEqual({
      brutoUren: 0,
      eigenTijdUren: 0,
      werktijdUren: 0,
      aantalRitten: 0,
      aantalZonderReistijd: 0,
    });
  });

  it("volgt een gewijzigde eigen reistijd uit de instellingen", () => {
    // De 2 uur is instelbaar en staat daarom niet in de code.
    const ritten = [maakRit({ reisduurEnkelMinuten: 90 })];
    expect(reistijdVanDag(DAG, ritten, 1.0).werktijdUren).toBe(2.0);
    expect(reistijdVanDag(DAG, ritten, 0).werktijdUren).toBe(3.0);
  });
});

describe("reistijd van een maand (SPEC.md 5.2 en 6.7)", () => {
  it("trekt de eigen tijd per dag af en telt de dagen op", () => {
    const maand = reistijdVanRitten(
      [
        // 10 maart: 2 × 90 = 3,00 − 2,00 = 1,00
        maakRit({ datum: "2027-03-10", reisduurEnkelMinuten: 90 }),
        // 11 maart: 45 + 45 enkele reizen = 1,50 − 1,50 = 0,00
        maakRit({ datum: "2027-03-11", reisduurEnkelMinuten: 45, heenEnTerug: false }),
        maakRit({ datum: "2027-03-11", reisduurEnkelMinuten: 45, heenEnTerug: false }),
        // 12 maart: onbekend
        maakRit({ datum: "2027-03-12", reisduurEnkelMinuten: null }),
      ],
      EIGEN_REISTIJD,
    );
    expect(maand).toEqual({
      brutoUren: 4.5,
      eigenTijdUren: 3.5,
      werktijdUren: 1.0,
      aantalRitten: 3,
      aantalZonderReistijd: 1,
    });
  });
});

describe("afronding van de berekende reisduur (SPEC.md 5.6)", () => {
  it("zet seconden van de routeplanner om naar afgeronde minuten", () => {
    expect(secondenNaarReisduurMinuten(2780, 5)).toBe(45); // 46,3 minuten
    expect(secondenNaarReisduurMinuten(2880, 5)).toBe(50); // 48 minuten
    expect(secondenNaarReisduurMinuten(0, 5)).toBe(0);
  });

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
