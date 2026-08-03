import { describe, expect, it } from "vitest";
import { berekenDag, berekenDagen, totaalUren } from "../dag";
import { maakAfspraak } from "./hulp";

/** Uit `instellingen`. */
const INSTELLINGEN = {
  eigenReistijdUrenPerDag: 2.0,
  maxUrenPerDagWaarschuwing: 12.0,
};

describe("uren per dag (SPEC.md 5.3)", () => {
  it("training in Zwolle, enkele reis 60 minuten, telt op tot 6,00 uur", () => {
    const dag = berekenDag({
      datum: "2027-03-10",
      afspraken: [
        maakAfspraak({
          datum: "2027-03-10",
          urenOpLocatie: 3.0,
          urenVoorbereiding: 3.0,
          reistijdEnkelMinuten: 60,
        }),
      ],
      handmatigeUrenregels: [],
      ...INSTELLINGEN,
    });

    expect(dag.urenOpLocatie).toBe(3.0);
    expect(dag.urenVoorbereiding).toBe(3.0);
    expect(dag.reistijdUren).toBe(0.0);
    expect(dag.totaalUren).toBe(6.0);
  });

  it("training in Utrecht, enkele reis 110 minuten, telt op tot 7,67 uur", () => {
    const dag = berekenDag({
      datum: "2027-03-10",
      afspraken: [
        maakAfspraak({
          datum: "2027-03-10",
          urenOpLocatie: 3.0,
          urenVoorbereiding: 3.0,
          reistijdEnkelMinuten: 110,
        }),
      ],
      handmatigeUrenregels: [],
      ...INSTELLINGEN,
    });

    expect(dag.brutoReistijdUren).toBe(3.67);
    expect(dag.reistijdUren).toBe(1.67);
    expect(dag.totaalUren).toBe(7.67);
  });

  it("observatie in Hengelo boekt de voorbereiding op de dag ervoor", () => {
    const afspraak = maakAfspraak({
      datum: "2027-03-10",
      voorbereidingDatum: "2027-03-09",
      urenOpLocatie: 3.5,
      urenVoorbereiding: 0.5,
      reistijdEnkelMinuten: 15,
    });
    const basis = {
      afspraken: [afspraak],
      handmatigeUrenregels: [],
      ...INSTELLINGEN,
    };

    const dagVanObservatie = berekenDag({ ...basis, datum: "2027-03-10" });
    expect(dagVanObservatie.urenOpLocatie).toBe(3.5);
    expect(dagVanObservatie.urenVoorbereiding).toBe(0.0);
    expect(dagVanObservatie.reistijdUren).toBe(0.0);
    expect(dagVanObservatie.totaalUren).toBe(3.5);

    const dagErvoor = berekenDag({ ...basis, datum: "2027-03-09" });
    expect(dagErvoor.urenVoorbereiding).toBe(0.5);
    expect(dagErvoor.urenOpLocatie).toBe(0.0);
    expect(dagErvoor.totaalUren).toBe(0.5);
  });
});

describe("meerdere afspraken op één dag (SPEC.md 5.2)", () => {
  it("trekt de eigen reistijd één keer af, van de verste bestemming", () => {
    const dag = berekenDag({
      datum: "2027-03-10",
      afspraken: [
        maakAfspraak({
          id: "a",
          datum: "2027-03-10",
          urenOpLocatie: 3.0,
          urenVoorbereiding: 0.0,
          reistijdEnkelMinuten: 30,
        }),
        maakAfspraak({
          id: "b",
          datum: "2027-03-10",
          urenOpLocatie: 3.5,
          urenVoorbereiding: 0.0,
          reistijdEnkelMinuten: 90,
        }),
      ],
      handmatigeUrenregels: [],
      ...INSTELLINGEN,
    });

    expect(dag.langsteEnkeleReisMinuten).toBe(90);
    // 2 × 90 ÷ 60 = 3,00 − 2,00 eigen tijd = 1,00 (niet twee keer aftrekken).
    expect(dag.reistijdUren).toBe(1.0);
    expect(dag.totaalUren).toBe(7.5);
    expect(dag.meerdereBestemmingen).toBe(true);
  });

  it("meldt niets bij één bestemming", () => {
    const dag = berekenDag({
      datum: "2027-03-10",
      afspraken: [
        maakAfspraak({ datum: "2027-03-10", reistijdEnkelMinuten: 90 }),
      ],
      handmatigeUrenregels: [],
      ...INSTELLINGEN,
    });
    expect(dag.meerdereBestemmingen).toBe(false);
  });
});

describe("dagen zonder klantbezoek (SPEC.md 5.2)", () => {
  it("kent geen aftrek van eigen reistijd", () => {
    const dag = berekenDag({
      datum: "2027-03-11",
      afspraken: [],
      handmatigeUrenregels: [
        { datum: "2027-03-11", categorie: "overleg", uren: 1.5 },
        { datum: "2027-03-11", categorie: "reistijd", uren: 0.75 },
        { datum: "2027-03-12", categorie: "administratie", uren: 2.0 },
      ],
      ...INSTELLINGEN,
    });

    expect(dag.eigenReistijdUren).toBe(0);
    expect(dag.reistijdUren).toBe(0);
    expect(dag.urenHandmatig).toBe(2.25);
    expect(dag.totaalUren).toBe(2.25);
  });
});

describe("waarschuwing Arbeidstijdenwet (SPEC.md 5.3)", () => {
  it("waarschuwt boven de grens uit de instellingen", () => {
    const basis = {
      datum: "2027-03-10",
      afspraken: [],
      ...INSTELLINGEN,
    };

    const netNiet = berekenDag({
      ...basis,
      handmatigeUrenregels: [
        { datum: "2027-03-10", categorie: "overig", uren: 12.0 },
      ],
    });
    expect(netNiet.overschrijdtMaximum).toBe(false);

    const eroverheen = berekenDag({
      ...basis,
      handmatigeUrenregels: [
        { datum: "2027-03-10", categorie: "overig", uren: 12.25 },
      ],
    });
    expect(eroverheen.overschrijdtMaximum).toBe(true);
  });
});

describe("meerdere dagen optellen", () => {
  it("verdeelt locatie- en voorbereidingsuren over de juiste dagen", () => {
    const dagen = berekenDagen({
      afspraken: [
        maakAfspraak({
          datum: "2027-03-10",
          voorbereidingDatum: "2027-03-09",
          urenOpLocatie: 3.5,
          urenVoorbereiding: 0.5,
          reistijdEnkelMinuten: 15,
        }),
      ],
      handmatigeUrenregels: [
        { datum: "2027-03-11", categorie: "administratie", uren: 1.0 },
      ],
      ...INSTELLINGEN,
    });

    expect(dagen.map((dag) => dag.datum)).toEqual([
      "2027-03-09",
      "2027-03-10",
      "2027-03-11",
    ]);
    expect(totaalUren(dagen)).toBe(5.0);
  });
});
