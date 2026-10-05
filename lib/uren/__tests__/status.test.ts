import { describe, expect, it } from "vitest";
import {
  teltLocatieUren,
  teltReistijd,
  teltVoorbereidingUren,
} from "../afspraak";
import { berekenDag } from "../dag";
import type { AfspraakStatus, Telwijze } from "../types";
import { maakAfspraak } from "./hulp";

const INSTELLINGEN = {
  eigenReistijdUrenPerDag: 2.0,
  maxUrenPerDagWaarschuwing: 12.0,
};

interface Verwachting {
  status: AfspraakStatus;
  voorbereidingGedaan: boolean;
  locatie: boolean;
  voorbereiding: boolean;
  reistijd: boolean;
}

/**
 * De statusmatrix uit SPEC.md 5.5, uitgeschreven per telwijze en met en zonder
 * `voorbereiding_gedaan` (SPEC.md hoofdstuk 9, testeis 4).
 */
const MATRIX: Record<Telwijze, Verwachting[]> = {
  gepland: [
    { status: "gepland", voorbereidingGedaan: false, locatie: true, voorbereiding: true, reistijd: true },
    { status: "gepland", voorbereidingGedaan: true, locatie: true, voorbereiding: true, reistijd: true },
    { status: "voltooid", voorbereidingGedaan: false, locatie: true, voorbereiding: true, reistijd: true },
    { status: "voltooid", voorbereidingGedaan: true, locatie: true, voorbereiding: true, reistijd: true },
    { status: "geannuleerd", voorbereidingGedaan: false, locatie: false, voorbereiding: false, reistijd: false },
    { status: "geannuleerd", voorbereidingGedaan: true, locatie: false, voorbereiding: true, reistijd: false },
    { status: "verzet", voorbereidingGedaan: false, locatie: false, voorbereiding: false, reistijd: false },
    { status: "verzet", voorbereidingGedaan: true, locatie: false, voorbereiding: true, reistijd: false },
  ],
  gerealiseerd: [
    { status: "gepland", voorbereidingGedaan: false, locatie: false, voorbereiding: false, reistijd: false },
    { status: "gepland", voorbereidingGedaan: true, locatie: false, voorbereiding: false, reistijd: false },
    { status: "voltooid", voorbereidingGedaan: false, locatie: true, voorbereiding: true, reistijd: true },
    { status: "voltooid", voorbereidingGedaan: true, locatie: true, voorbereiding: true, reistijd: true },
    { status: "geannuleerd", voorbereidingGedaan: false, locatie: false, voorbereiding: false, reistijd: false },
    { status: "geannuleerd", voorbereidingGedaan: true, locatie: false, voorbereiding: true, reistijd: false },
    { status: "verzet", voorbereidingGedaan: false, locatie: false, voorbereiding: false, reistijd: false },
    { status: "verzet", voorbereidingGedaan: true, locatie: false, voorbereiding: true, reistijd: false },
  ],
};

describe("statusmatrix (SPEC.md 5.5)", () => {
  for (const telwijze of Object.keys(MATRIX) as Telwijze[]) {
    describe(`telwijze ${telwijze}`, () => {
      for (const verwacht of MATRIX[telwijze]) {
        const omschrijving = `${verwacht.status}, voorbereiding ${
          verwacht.voorbereidingGedaan ? "gedaan" : "niet gedaan"
        }`;

        it(omschrijving, () => {
          expect(teltLocatieUren(verwacht.status, telwijze)).toBe(
            verwacht.locatie,
          );
          expect(
            teltVoorbereidingUren(
              verwacht.status,
              verwacht.voorbereidingGedaan,
              telwijze,
            ),
          ).toBe(verwacht.voorbereiding);
          expect(teltReistijd(verwacht.status, telwijze)).toBe(
            verwacht.reistijd,
          );
        });
      }
    });
  }
});

describe("statusmatrix doorgerekend in een dagtotaal", () => {
  function dagVoor(
    status: AfspraakStatus,
    voorbereidingGedaan: boolean,
    telwijze: Telwijze,
  ) {
    return berekenDag({
      datum: "2027-03-10",
      afspraken: [
        maakAfspraak({
          datum: "2027-03-10",
          urenOpLocatie: 3.0,
          urenVoorbereiding: 3.0,
          reistijdEnkelMinuten: 90,
          status,
          voorbereidingGedaan,
        }),
      ],
      handmatigeUrenregels: [],
      telwijze,
      ...INSTELLINGEN,
    });
  }

  it("een geplande afspraak telt wel in gepland, niet in gerealiseerd", () => {
    expect(dagVoor("gepland", false, "gepland").totaalUren).toBe(7.0);
    expect(dagVoor("gepland", false, "gerealiseerd").totaalUren).toBe(0);
  });

  it("een voltooide afspraak telt in beide kolommen", () => {
    expect(dagVoor("voltooid", false, "gepland").totaalUren).toBe(7.0);
    expect(dagVoor("voltooid", false, "gerealiseerd").totaalUren).toBe(7.0);
  });

  it("een geannuleerde afspraak telt alleen de gedane voorbereiding", () => {
    expect(dagVoor("geannuleerd", false, "gerealiseerd").totaalUren).toBe(0);

    const metVoorbereiding = dagVoor("geannuleerd", true, "gerealiseerd");
    expect(metVoorbereiding.urenVoorbereiding).toBe(3.0);
    expect(metVoorbereiding.urenOpLocatie).toBe(0);
    expect(metVoorbereiding.reistijdUren).toBe(0);
    expect(metVoorbereiding.totaalUren).toBe(3.0);
  });

  it("een verzette afspraak telt niet op locatie — die uren horen bij de nieuwe afspraak", () => {
    const verzet = dagVoor("verzet", true, "gerealiseerd");
    expect(verzet.urenOpLocatie).toBe(0);
    expect(verzet.urenVoorbereiding).toBe(3.0);
    expect(verzet.reistijdUren).toBe(0);
  });
});
