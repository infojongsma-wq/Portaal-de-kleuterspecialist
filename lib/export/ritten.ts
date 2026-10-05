import ExcelJS from "exceljs";

import type { Rit } from "@/lib/data/types";
import { formatteerBedrag, formatteerDatum } from "@/lib/formatteer";
import { maandNaam } from "@/lib/ritten/maand";
import { bedragVanRit, kmVanRit, rittenTotaal } from "@/lib/uren";

/**
 * Het Excel-bestand met de ritten van één maand (SPEC.md 6.7).
 *
 * Los van de route, zonder database, zodat het met verzonnen ritten te testen
 * is. Getallen gaan als getal het bestand in, met een Nederlandse opmaak: zo
 * kun je er in Excel mee rekenen, en zie je toch een komma en een euroteken.
 * Het blad is ingesteld om op één A4 in de breedte te printen.
 */

/** Op deze regel staan de kolomkoppen; daarboven de gegevens van de maand. */
export const KOPREGEL = 7;

export const KOLOMKOPPEN = [
  "Datum",
  "Doel van de rit",
  "Van",
  "Naar",
  "Heen en terug",
  "Km enkele reis",
  "Km totaal",
  "Vergoeding per km",
  "Bedrag",
] as const;

export interface RittenExport {
  /** `jjjj-mm` */
  maand: string;
  naam: string;
  /** In één regel, of `null` als het nog niet is ingesteld. */
  thuisadres: string | null;
  /** De ritten van die maand, in volgorde. */
  ritten: Rit[];
  /** De vergoeding die nu geldt; voor de kop als er nog geen ritten zijn. */
  huidigeVergoeding: number | null;
  /** `jjjj-mm-dd` */
  vandaag: string;
}

/** Een ISO-datum als echte Excel-datum, zonder tijdzoneverschuiving. */
function excelDatum(iso: string): Date {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  return new Date(Date.UTC(jaar, maand - 1, dag));
}

/** "Claudia Neef" wordt "claudia-neef", voor in de bestandsnaam. */
function bestandsdeel(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function rittenBestandsnaam(maand: string, naam: string): string {
  return `ritten-${maand}-${bestandsdeel(naam) || "medewerker"}.xlsx`;
}

function vergoedingTekst(invoer: RittenExport): string {
  const vergoedingen = [
    ...new Set(invoer.ritten.map((rit) => rit.vergoedingPerKm)),
  ];
  if (vergoedingen.length === 1) {
    return `${formatteerBedrag(vergoedingen[0])} per km`;
  }
  if (vergoedingen.length > 1) {
    return "verschilt per rit, zie de kolom Vergoeding per km";
  }
  return invoer.huidigeVergoeding != null
    ? `${formatteerBedrag(invoer.huidigeVergoeding)} per km`
    : "niet ingesteld";
}

export function rittenWerkboek(invoer: RittenExport): ExcelJS.Workbook {
  const naamVanMaand = maandNaam(invoer.maand);
  const totaal = rittenTotaal(invoer.ritten);

  const werkboek = new ExcelJS.Workbook();
  werkboek.creator = "Portaal De Kleuterspecialist";
  werkboek.created = new Date();

  const blad = werkboek.addWorksheet(`Ritten ${naamVanMaand}`, {
    views: [{ state: "frozen", ySplit: KOPREGEL }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
      // De kolomkoppen komen op elke bladzijde terug.
      printTitlesRow: `${KOPREGEL}:${KOPREGEL}`,
    },
    headerFooter: {
      oddFooter: `&LRittenregistratie ${naamVanMaand} — ${invoer.naam}&RPagina &P van &N`,
    },
  });

  blad.columns = [
    { key: "datum", width: 12 },
    { key: "doel", width: 40 },
    // Ruim, want hier kan een volledig adres staan.
    { key: "van", width: 34 },
    { key: "naar", width: 34 },
    { key: "heenEnTerug", width: 14 },
    { key: "kmEnkel", width: 15 },
    { key: "kmTotaal", width: 12 },
    { key: "vergoeding", width: 18 },
    { key: "bedrag", width: 13 },
  ];

  // Kop: waar gaat dit over.
  blad.getCell("A1").value = `Rittenregistratie ${naamVanMaand}`;
  blad.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF026666" } };

  const kopgegevens: [string, string][] = [
    ["Medewerker", invoer.naam],
    ["Thuisadres", invoer.thuisadres ?? "niet ingesteld"],
    ["Vergoeding", vergoedingTekst(invoer)],
    ["Gemaakt op", formatteerDatum(invoer.vandaag)],
  ];
  kopgegevens.forEach(([label, waarde], positie) => {
    const rij = blad.getRow(2 + positie);
    rij.getCell(1).value = label;
    rij.getCell(1).font = { bold: true };
    rij.getCell(2).value = waarde;
  });

  // Kolomkoppen.
  const kop = blad.getRow(KOPREGEL);
  kop.values = [...KOLOMKOPPEN];
  kop.font = { bold: true, color: { argb: "FFFFFFFF" } };
  kop.fill = {
    type: "pattern",
    pattern: "solid",
    // Donker turquoise uit de huisstijl.
    fgColor: { argb: "FF026666" },
  };
  kop.alignment = { vertical: "middle", wrapText: true };
  kop.height = 22;

  for (const rit of invoer.ritten) {
    blad.addRow({
      datum: excelDatum(rit.datum),
      doel: rit.doel,
      van: rit.vanPlaats,
      naar: rit.naarPlaats,
      heenEnTerug: rit.heenEnTerug ? "ja" : "nee",
      kmEnkel: rit.kmEnkel,
      kmTotaal: kmVanRit(rit),
      vergoeding: rit.vergoedingPerKm,
      bedrag: bedragVanRit(rit),
    });
  }

  const eersteRit = KOPREGEL + 1;
  const laatsteRit = KOPREGEL + invoer.ritten.length;

  if (invoer.ritten.length > 0) {
    // De formules rekenen in Excel mee als er iets wordt aangepast. De
    // uitkomst staat er alvast in voor programma's die zelf niet rekenen,
    // zoals een voorbeeldweergave op de telefoon.
    const totaalregel = blad.addRow({
      doel: `Totaal ${naamVanMaand} (${totaal.aantal} ${totaal.aantal === 1 ? "rit" : "ritten"})`,
      kmTotaal: {
        formula: `SUM(G${eersteRit}:G${laatsteRit})`,
        result: totaal.km,
      },
      bedrag: {
        formula: `SUM(I${eersteRit}:I${laatsteRit})`,
        result: totaal.bedrag,
      },
    });
    totaalregel.font = { bold: true };
    totaalregel.border = { top: { style: "thin" } };
    blad.autoFilter = { from: `A${KOPREGEL}`, to: `I${laatsteRit}` };
  } else {
    blad.addRow({ doel: `Geen ritten in ${naamVanMaand}.` });
  }

  // Opmaak per kolom, onder de kolomkoppen.
  const opmaak: Record<string, string> = {
    datum: "dd-mm-yyyy",
    kmEnkel: "0.0",
    kmTotaal: "0.0",
    vergoeding: '"€" #,##0.00#',
    bedrag: '"€" #,##0.00',
  };
  for (const [kolom, numFmt] of Object.entries(opmaak)) {
    blad.getColumn(kolom).eachCell({ includeEmpty: false }, (cel, rijnummer) => {
      if (rijnummer > KOPREGEL) cel.numFmt = numFmt;
    });
  }
  // Lange adressen en doelen lopen door op de volgende regel, zodat alles
  // leesbaar op papier komt.
  for (const kolom of ["doel", "van", "naar"]) {
    blad.getColumn(kolom).eachCell({ includeEmpty: false }, (cel, rijnummer) => {
      if (rijnummer > KOPREGEL) {
        cel.alignment = { ...cel.alignment, wrapText: true, vertical: "top" };
      }
    });
  }
  for (const kolom of ["heenEnTerug", "kmEnkel", "kmTotaal", "vergoeding", "bedrag"]) {
    blad.getColumn(kolom).eachCell({ includeEmpty: false }, (cel, rijnummer) => {
      if (rijnummer >= KOPREGEL) {
        cel.alignment = {
          ...cel.alignment,
          horizontal: kolom === "heenEnTerug" ? "center" : "right",
        };
      }
    });
  }

  return werkboek;
}
