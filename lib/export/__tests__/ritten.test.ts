import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { Rit } from "@/lib/data/types";
import {
  KOLOMKOPPEN,
  KOPREGEL,
  rittenBestandsnaam,
  rittenWerkboek,
  type RittenExport,
} from "../ritten";

/** Verzonnen ritten, zoals in de ontwikkelomgeving afgesproken (CLAUDE.md). */
function rit(velden: Partial<Rit>): Rit {
  return {
    id: "rit",
    medewerkerId: "proef",
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

const INVOER: RittenExport = {
  maand: "2026-10",
  naam: "Proef Medewerker",
  thuisadres: "Voorbeeldstraat 1, 1234 AB Proefdorp",
  ritten: [
    rit({ id: "1" }),
    rit({ id: "2", datum: "2026-10-12", naarPlaats: "Zwolle", heenEnTerug: false, kmEnkel: 10.1 }),
    rit({ id: "3", datum: "2026-10-19", naarPlaats: "Zwolle", heenEnTerug: false, kmEnkel: 10.1 }),
  ],
  huidigeVergoeding: 0.25,
  vandaag: "2026-10-20",
};

/** Schrijft het werkboek weg en leest het terug, zoals Excel het zou openen. */
async function heenEnWeer(invoer: RittenExport) {
  const inhoud = await rittenWerkboek(invoer).xlsx.writeBuffer();
  const terug = new ExcelJS.Workbook();
  await terug.xlsx.load(inhoud as ArrayBuffer);
  return terug.worksheets[0];
}

describe("Excel met ritten (SPEC.md 6.7)", () => {
  it("noemt maand, medewerker, thuisadres en vergoeding bovenaan", async () => {
    const blad = await heenEnWeer(INVOER);
    expect(blad.name).toBe("Ritten oktober 2026");
    expect(blad.getCell("A1").value).toBe("Rittenregistratie oktober 2026");
    expect(blad.getCell("B2").value).toBe("Proef Medewerker");
    expect(blad.getCell("B3").value).toBe("Voorbeeldstraat 1, 1234 AB Proefdorp");
    expect(String(blad.getCell("B4").value)).toMatch(/^€\s0,25 per km$/);
    expect(blad.getCell("B5").value).toBe("20-10-2026");
  });

  it("zet de kolomkoppen op de afgesproken regel", async () => {
    const blad = await heenEnWeer(INVOER);
    const koppen = (blad.getRow(KOPREGEL).values as unknown[]).slice(1);
    expect(koppen).toEqual([...KOLOMKOPPEN]);
  });

  it("zet per rit de kilometers en het bedrag als getal", async () => {
    const blad = await heenEnWeer(INVOER);
    const eerste = blad.getRow(KOPREGEL + 1);
    expect(eerste.getCell(1).value).toEqual(new Date(Date.UTC(2026, 9, 5)));
    expect(eerste.getCell(1).numFmt).toBe("dd-mm-yyyy");
    expect(eerste.getCell(3).value).toBe("Thuis");
    expect(eerste.getCell(5).value).toBe("ja");
    expect(eerste.getCell(6).value).toBe(23.4);
    expect(eerste.getCell(7).value).toBe(46.8);
    expect(eerste.getCell(8).value).toBe(0.25);
    expect(eerste.getCell(9).value).toBe(11.7);
    expect(eerste.getCell(9).numFmt).toBe('"€" #,##0.00');
  });

  it("telt onderaan de kilometers en de bedragen op", async () => {
    const blad = await heenEnWeer(INVOER);
    const totaal = blad.getRow(KOPREGEL + 4);
    expect(totaal.getCell(2).value).toBe("Totaal oktober 2026 (3 ritten)");
    expect(totaal.getCell(7).value).toMatchObject({
      formula: `SUM(G${KOPREGEL + 1}:G${KOPREGEL + 3})`,
      result: 67,
    });
    // 11,70 + 2,53 + 2,53: de som van de afgeronde ritbedragen (SPEC.md 5.7).
    expect(totaal.getCell(9).value).toMatchObject({
      formula: `SUM(I${KOPREGEL + 1}:I${KOPREGEL + 3})`,
      result: 16.76,
    });
  });

  it("is ingesteld om op één A4 in de breedte te printen", async () => {
    const blad = await heenEnWeer(INVOER);
    expect(blad.pageSetup.paperSize).toBe(9);
    expect(blad.pageSetup.orientation).toBe("landscape");
    expect(blad.pageSetup.fitToWidth).toBe(1);
  });

  it("meldt een maand zonder ritten in plaats van een lege tabel", async () => {
    const blad = await heenEnWeer({ ...INVOER, ritten: [] });
    expect(blad.getRow(KOPREGEL + 1).getCell(2).value).toBe(
      "Geen ritten in oktober 2026.",
    );
  });

  it("zegt het als de vergoeding binnen de maand verschilt", async () => {
    const blad = await heenEnWeer({
      ...INVOER,
      ritten: [rit({ id: "a", vergoedingPerKm: 0.23 }), rit({ id: "b" })],
    });
    expect(blad.getCell("B4").value).toBe(
      "verschilt per rit, zie de kolom Vergoeding per km",
    );
  });

  it("maakt een bestandsnaam zonder spaties of accenten", () => {
    expect(rittenBestandsnaam("2026-10", "Zoë van den Berg")).toBe(
      "ritten-2026-10-zoe-van-den-berg.xlsx",
    );
  });
});
