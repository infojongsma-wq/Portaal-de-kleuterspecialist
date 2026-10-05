import { NextResponse, type NextRequest } from "next/server";

import { leesPdokSuggesties } from "@/lib/ritten/plaatsen";

/**
 * Plaatsnamen voorstellen terwijl de medewerker typt (SPEC.md 6.7).
 *
 * De namen komen van de PDOK Locatieserver: de officiële lijst woonplaatsen
 * van de Nederlandse overheid, gratis en zonder account. De vraag gaat via
 * onze server, zodat de browser van de medewerker niet zelf met een externe
 * dienst praat.
 *
 * Alleen voor ingelogde gebruikers: `proxy.ts` stuurt iedereen zonder sessie
 * door naar het inlogscherm, ook bij dit adres.
 */

const PDOK_SUGGEST =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

export async function GET(verzoek: NextRequest) {
  const term = verzoek.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (term.length < 2 || term.length > 80) {
    return NextResponse.json({ suggesties: [] });
  }

  const adres = new URL(PDOK_SUGGEST);
  adres.searchParams.set("q", term);
  adres.searchParams.set("fq", "type:woonplaats");
  adres.searchParams.set("rows", "8");

  try {
    const antwoord = await fetch(adres, {
      // Woonplaatsen veranderen zelden; een week bewaren scheelt vragen.
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(5000),
    });
    if (!antwoord.ok) return NextResponse.json({ suggesties: [] });

    return NextResponse.json({
      suggesties: leesPdokSuggesties(await antwoord.json()),
    });
  } catch {
    // Geen suggesties is geen ramp: de medewerker kan de plaats gewoon typen.
    return NextResponse.json({ suggesties: [] });
  }
}
