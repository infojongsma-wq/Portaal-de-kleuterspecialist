import { rittenset, rittenVan } from "@/lib/data/ritten";
import { werkset } from "@/lib/data/werkset";
import { rittenBestandsnaam, rittenWerkboek } from "@/lib/export/ritten";
import {
  inMaand,
  isMaand,
  maandVan,
  vandaagInNederland,
} from "@/lib/ritten/maand";

/**
 * Excel-download van de ritten van één maand (SPEC.md 6.7). Kan op elk
 * moment, ook halverwege de maand; dan staan de ritten tot nu toe erin. De
 * opbouw van het bestand staat in `lib/export/ritten.ts`.
 *
 * Een medewerker krijgt altijd de eigen ritten. Alleen de beheerder kan met
 * `?medewerker=` die van een ander opvragen; Row Level Security in Postgres
 * bewaakt dat ook nog eens.
 */
export async function GET(verzoek: Request) {
  const parameters = new URL(verzoek.url).searchParams;
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  const { ik } = gegevens;

  if (!ritten.beschikbaar) {
    return new Response(
      "De rittenregistratie staat nog niet in de database. Zie PUBLICEREN.md.",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const gevraagd = parameters.get("medewerker");
  const medewerker =
    (ik.rol === "beheerder" &&
      gegevens.profielen.find((profiel) => profiel.id === gevraagd)) ||
    ik;
  const naam = `${medewerker.voornaam} ${medewerker.achternaam}`.trim();

  const vandaag = vandaagInNederland();
  const maandParameter = parameters.get("maand");
  const maand = isMaand(maandParameter) ? maandParameter : maandVan(vandaag);

  const plaatsregel = [medewerker.standplaatsPostcode, medewerker.standplaatsPlaats]
    .filter(Boolean)
    .join(" ");
  const thuisadres =
    [medewerker.standplaatsAdres, plaatsregel].filter(Boolean).join(", ") || null;

  const werkboek = rittenWerkboek({
    maand,
    naam,
    thuisadres,
    ritten: rittenVan(ritten.ritten, medewerker.id).filter((rit) =>
      inMaand(rit.datum, maand),
    ),
    huidigeVergoeding: gegevens.instellingen.kilometervergoedingPerKm,
    vandaag,
  });

  const inhoud = await werkboek.xlsx.writeBuffer();

  return new Response(inhoud as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${rittenBestandsnaam(maand, naam)}"`,
      "Cache-Control": "no-store",
    },
  });
}
