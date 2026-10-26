import { describe, expect, it } from "vitest";

import type { Activiteitsoort, Afspraak, Klant } from "@/lib/data/types";
import {
  aantalTrainingen,
  gedaneTrainingen,
  voorDeWeekmail,
  type TrainingenInvoer,
} from "../gedaan";

/** Verzonnen scholen, soorten en medewerkers (CLAUDE.md). */
function afspraak(velden: Partial<Afspraak>): Afspraak {
  return {
    id: "afspraak",
    klantId: "school-1",
    contactpersoonId: null,
    medewerkerId: "a",
    activiteitsoortId: "training",
    titel: "Proeftraining",
    datum: "2026-10-20",
    dagdelen: ["ochtend"],
    andersOmschrijving: null,
    starttijd: null,
    eindtijd: null,
    voorbereidingDatum: "2026-10-20",
    urenOpLocatie: 3,
    urenVoorbereiding: 3,
    reistijdEnkelMinuten: null,
    reisafstandEnkelKm: null,
    reisgegevensBron: null,
    status: "voltooid",
    voltooidOp: "2026-10-20T14:00:00Z",
    voorbereidingGedaan: true,
    verzetNaarId: null,
    afsprakenMetKlant: null,
    notitie: null,
    ...velden,
  };
}

function soort(velden: Partial<Activiteitsoort>): Activiteitsoort {
  return {
    id: "training",
    naam: "Training",
    urenOpLocatie: 3,
    urenVoorbereiding: 3,
    kleur: "#3b82f6",
    volgorde: 10,
    handmatigeUren: false,
    urencategorie: null,
    teltAlsWerktijd: true,
    actief: true,
    ...velden,
  };
}

function school(id: string, naam: string, plaats: string): Klant {
  return {
    id,
    naam,
    plaats,
    adres: null,
    postcode: null,
    land: "NL",
    reistijdEnkelMinuten: null,
    reisafstandEnkelKm: null,
    telefoonAlgemeen: null,
    emailAlgemeen: null,
    website: null,
    notitie: null,
    actief: true,
  };
}

function invoer(velden: Partial<TrainingenInvoer>): TrainingenInvoer {
  return {
    afspraken: [],
    klanten: [
      school("school-1", "Basisschool De Proef", "Testdorp"),
      school("school-2", "Kindcentrum Voorbeeld", "Proefstad"),
    ],
    soorten: [
      soort({}),
      soort({ id: "observatie", naam: "Observatie" }),
      soort({ id: "literatuur", naam: "Literatuurstudie", handmatigeUren: true }),
    ],
    medewerkers: [
      { id: "b", naam: "Proef Bakker", actief: true, rol: "medewerker" },
      { id: "a", naam: "Proef Aalders", actief: true, rol: "medewerker" },
      { id: "c", naam: "Proef Claassen", actief: false, rol: "medewerker" },
      { id: "z", naam: "Proef Beheer", actief: true, rol: "beheerder" },
    ],
    facturen: new Map(),
    gemeld: new Set(),
    ...velden,
  };
}

describe("trainingen gedaan in Beheer (SPEC.md 6.6)", () => {
  it("neemt alleen afgevinkte afspraken op school op", () => {
    const lijst = gedaneTrainingen(
      invoer({
        afspraken: [
          afspraak({ id: "1" }),
          afspraak({ id: "2", status: "gepland", voltooidOp: null }),
          afspraak({ id: "3", status: "geannuleerd" }),
          afspraak({ id: "4", activiteitsoortId: "observatie", klantId: "school-2" }),
          afspraak({ id: "5", activiteitsoortId: "literatuur", klantId: null }),
        ],
      }),
    );
    const aalders = lijst.find((regel) => regel.id === "a");
    expect(aalders?.trainingen.map((training) => training.afspraakId).sort()).toEqual([
      "1",
      "4",
    ]);
    expect(aalders?.trainingen.find((t) => t.afspraakId === "4")).toMatchObject({
      school: "Kindcentrum Voorbeeld",
      plaats: "Proefstad",
      soort: "Observatie",
    });
  });

  it("ook trainingen die al eerder zijn afgevinkt", () => {
    const lijst = gedaneTrainingen(
      invoer({ afspraken: [afspraak({ id: "1", datum: "2026-01-12" })] }),
    );
    expect(aantalTrainingen(lijst)).toBe(1);
  });

  it("zet de nieuwste bovenaan, zonder datum onderaan", () => {
    const lijst = gedaneTrainingen(
      invoer({
        afspraken: [
          afspraak({ id: "oud", datum: "2026-09-01" }),
          afspraak({ id: "zonder", datum: null }),
          afspraak({ id: "nieuw", datum: "2026-10-22" }),
        ],
      }),
    );
    expect(lijst.find((r) => r.id === "a")?.trainingen.map((t) => t.afspraakId)).toEqual([
      "nieuw",
      "oud",
      "zonder",
    ]);
  });

  it("geeft per training aan of de factuur is verstuurd en of hij al gemeld is", () => {
    const lijst = gedaneTrainingen(
      invoer({
        afspraken: [afspraak({ id: "1" }), afspraak({ id: "2" })],
        facturen: new Map([["1", "2026-10-26"]]),
        gemeld: new Set(["2"]),
      }),
    );
    const trainingen = lijst.find((r) => r.id === "a")!.trainingen;
    expect(trainingen.find((t) => t.afspraakId === "1")).toMatchObject({
      factuurVerstuurdOp: "2026-10-26",
      gemeld: false,
    });
    expect(trainingen.find((t) => t.afspraakId === "2")).toMatchObject({
      factuurVerstuurdOp: null,
      gemeld: true,
    });
  });

  it("toont actieve medewerkers altijd, anderen alleen met trainingen", () => {
    const leeg = gedaneTrainingen(invoer({}));
    expect(leeg.map((regel) => regel.naam)).toEqual(["Proef Aalders", "Proef Bakker"]);

    const met = gedaneTrainingen(
      invoer({
        afspraken: [
          afspraak({ id: "1", medewerkerId: "c" }),
          afspraak({ id: "2", medewerkerId: "z" }),
        ],
      }),
    );
    expect(met.map((regel) => regel.naam)).toEqual([
      "Proef Aalders",
      "Proef Bakker",
      "Proef Beheer",
      "Proef Claassen",
    ]);
  });

  it("de weekmail krijgt alleen wat nog niet gemeld is", () => {
    const lijst = gedaneTrainingen(
      invoer({
        afspraken: [
          afspraak({ id: "1" }),
          afspraak({ id: "2" }),
          afspraak({ id: "3", medewerkerId: "b" }),
        ],
        gemeld: new Set(["2", "3"]),
      }),
    );
    const nieuw = voorDeWeekmail(lijst);
    expect(nieuw.map((regel) => regel.naam)).toEqual(["Proef Aalders"]);
    expect(nieuw[0].trainingen.map((t) => t.afspraakId)).toEqual(["1"]);
    expect(aantalTrainingen(nieuw)).toBe(1);
  });

  it("de weekmail slaat trainingen over waarvan de factuur al is verstuurd", () => {
    const lijst = gedaneTrainingen(
      invoer({
        afspraken: [afspraak({ id: "1" }), afspraak({ id: "2" })],
        facturen: new Map([["2", "2026-10-26"]]),
      }),
    );
    const nieuw = voorDeWeekmail(lijst);
    expect(nieuw[0].trainingen.map((t) => t.afspraakId)).toEqual(["1"]);
  });
});
