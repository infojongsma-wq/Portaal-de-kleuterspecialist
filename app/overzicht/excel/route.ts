import ExcelJS from "exceljs";

import { huidigeMedewerker, urenVanAfspraakSync } from "@/lib/data/queries";
import { formatteerDatum } from "@/lib/formatteer";
import {
  haalOverzicht,
  leesFilters,
  STATUSLABELS,
} from "@/lib/export/overzicht";

/**
 * Excel-export van het overzicht (SPEC.md 6.3).
 *
 * Let op: `CLAUDE.md` noemt SheetJS voor Excel-export, maar dat pakket is niet
 * meer via npm te installeren — de makers zijn naar hun eigen distributie
 * gegaan en wat er op npm achterbleef staat sinds 2022 stil met bekende lekken.
 * Daarom `exceljs`, dat wél wordt onderhouden. Dit is de enige afwijking van de
 * vaste bibliotheken.
 *
 * De uren gaan als getal het bestand in, met een Nederlandse opmaak. Zo kun je
 * er in Excel mee rekenen, en zie je toch een komma als decimaalteken.
 */
export async function GET(verzoek: Request) {
  const parameters = Object.fromEntries(
    new URL(verzoek.url).searchParams.entries(),
  );
  const filters = leesFilters(parameters);
  const medewerker = await huidigeMedewerker();
  const { afspraken, instellingen } = await haalOverzicht(
    medewerker.id,
    filters,
  );

  const werkboek = new ExcelJS.Workbook();
  werkboek.creator = "Portaal De Kleuterspecialist";
  werkboek.created = new Date();

  const blad = werkboek.addWorksheet("Overzicht", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  blad.columns = [
    { header: "Datum", key: "datum", width: 14 },
    { header: "School", key: "school", width: 34 },
    { header: "Plaats", key: "plaats", width: 16 },
    { header: "Soort", key: "soort", width: 18 },
    { header: "Titel", key: "titel", width: 38 },
    { header: "Op locatie", key: "opLocatie", width: 12 },
    { header: "Voorbereiding", key: "voorbereiding", width: 14 },
    { header: "Reistijd", key: "reistijd", width: 11 },
    { header: "Totaal uren", key: "totaal", width: 13 },
    { header: "Status", key: "status", width: 14 },
  ];

  const kop = blad.getRow(1);
  kop.font = { bold: true, color: { argb: "FFFFFFFF" } };
  kop.fill = {
    type: "pattern",
    pattern: "solid",
    // Donker turquoise uit de huisstijl.
    fgColor: { argb: "FF026666" },
  };
  kop.alignment = { vertical: "middle" };
  kop.height = 20;

  for (const afspraak of afspraken) {
    const uren = urenVanAfspraakSync(instellingen, afspraak);
    blad.addRow({
      datum: afspraak.datum
        ? formatteerDatum(afspraak.datum)
        : "Nog in te plannen",
      school: afspraak.klant.naam,
      plaats: afspraak.klant.plaats,
      soort: afspraak.activiteitsoort.naam,
      titel: afspraak.titel,
      opLocatie: uren.opLocatie,
      voorbereiding: uren.voorbereiding,
      reistijd: uren.reistijd,
      totaal: uren.totaal,
      status: STATUSLABELS[afspraak.status],
    });
  }

  // Urenkolommen als getal met twee decimalen.
  for (const kolom of ["opLocatie", "voorbereiding", "reistijd", "totaal"]) {
    blad.getColumn(kolom).numFmt = "0.00";
    blad.getColumn(kolom).alignment = { horizontal: "right" };
  }

  // Totaalregel onderaan.
  if (afspraken.length > 0) {
    const laatste = blad.rowCount;
    const totaalregel = blad.addRow({
      titel: "Totaal",
      opLocatie: { formula: `SUM(F2:F${laatste})` },
      voorbereiding: { formula: `SUM(G2:G${laatste})` },
      reistijd: { formula: `SUM(H2:H${laatste})` },
      totaal: { formula: `SUM(I2:I${laatste})` },
    });
    totaalregel.font = { bold: true };
    totaalregel.border = { top: { style: "thin" } };
  }

  blad.autoFilter = { from: "A1", to: `J${Math.max(blad.rowCount, 1)}` };

  const inhoud = await werkboek.xlsx.writeBuffer();
  const bestandsnaam = `urenoverzicht-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(inhoud as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
      "Cache-Control": "no-store",
    },
  });
}
