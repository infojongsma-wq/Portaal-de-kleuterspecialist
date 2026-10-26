import { NextResponse, type NextRequest } from "next/server";

import { leesPdokSuggesties, type PlaatsSuggestie } from "@/lib/ritten/plaatsen";

/**
 * Plaatsen en adressen voorstellen terwijl de medewerker typt (SPEC.md 6.7).
 *
 * De namen komen van de PDOK Locatieserver: de officiële lijst woonplaatsen
 * en adressen van de Nederlandse overheid, gratis en zonder account. De vraag
 * gaat via onze server, zodat de browser van de medewerker niet zelf met een
 * externe dienst praat.
 *
 * Adressen zoeken we pas zodra er een cijfer in de zoekterm staat: wie
 * "Schoolweg 5" typt, zoekt een adres; wie "Heng" typt, een plaats.
 *
 * Alleen voor ingelogde gebruikers: `proxy.ts` stuurt iedereen zonder sessie
 * door naar het inlogscherm, ook bij dit adres.
 */

const PDOK_SUGGEST =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

async function vraagPdok(
  term: string,
  soort: "woonplaats" | "adres",
  aantal: number,
): Promise<PlaatsSuggestie[]> {
  const adres = new URL(PDOK_SUGGEST);
  adres.searchParams.set("q", term);
  adres.searchParams.set("fq", `type:${soort}`);
  adres.searchParams.set("rows", String(aantal));

  try {
    const antwoord = await fetch(adres, {
      // Woonplaatsen en adressen veranderen zelden; een week bewaren scheelt
      // vragen.
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(5000),
    });
    if (!antwoord.ok) return [];
    return leesPdokSuggesties(await antwoord.json());
  } catch {
    // Geen suggesties is geen ramp: de medewerker kan het ook gewoon typen.
    return [];
  }
}

export async function GET(verzoek: NextRequest) {
  const term = verzoek.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (term.length < 2 || term.length > 120) {
    return NextResponse.json({ suggesties: [] });
  }

  const zoektAdres = /\d/.test(term);
  const [adressen, woonplaatsen] = await Promise.all([
    zoektAdres ? vraagPdok(term, "adres", 6) : Promise.resolve([]),
    vraagPdok(term, "woonplaats", 5),
  ]);

  return NextResponse.json({ suggesties: [...adressen, ...woonplaatsen] });
}
