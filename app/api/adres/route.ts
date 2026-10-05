import { NextResponse, type NextRequest } from "next/server";

import {
  huisnummerGetal,
  isPostcode,
  leesPdokAdres,
} from "@/lib/ritten/plaatsen";

/**
 * Straat en plaats bij een postcode en huisnummer (SPEC.md 6.7), zoals bij
 * een webwinkel.
 *
 * Het antwoord komt van de PDOK Locatieserver: de officiële adressen van de
 * Nederlandse overheid, gratis en zonder account. De vraag gaat via onze
 * server, zodat de browser van de medewerker niet zelf met een externe dienst
 * praat.
 *
 * Alleen voor ingelogde gebruikers: `proxy.ts` stuurt iedereen zonder sessie
 * door naar het inlogscherm, ook bij dit adres.
 */

const PDOK_ZOEKEN = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export async function GET(verzoek: NextRequest) {
  const postcode = (verzoek.nextUrl.searchParams.get("postcode") ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const huisnummer = huisnummerGetal(
    verzoek.nextUrl.searchParams.get("huisnummer") ?? "",
  );

  if (!isPostcode(postcode) || huisnummer === null) {
    return NextResponse.json(
      { melding: "Vul een postcode zoals 7514 AB en een huisnummer in." },
      { status: 400 },
    );
  }

  const adres = new URL(PDOK_ZOEKEN);
  adres.searchParams.set("q", `${postcode} ${huisnummer}`);
  adres.searchParams.set("fq", "type:adres");
  adres.searchParams.set(
    "fl",
    "straatnaam,woonplaatsnaam,postcode,huisnummer,weergavenaam",
  );
  adres.searchParams.set("rows", "10");

  try {
    const antwoord = await fetch(adres, {
      // Adressen veranderen zelden; een week bewaren scheelt vragen.
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(5000),
    });
    if (!antwoord.ok) {
      return NextResponse.json({ melding: "Opzoeken lukte niet." }, { status: 502 });
    }

    const gevonden = leesPdokAdres(await antwoord.json(), postcode, huisnummer);
    return gevonden
      ? NextResponse.json(gevonden)
      : NextResponse.json({ melding: "Adres niet gevonden." }, { status: 404 });
  } catch {
    return NextResponse.json({ melding: "Opzoeken lukte niet." }, { status: 502 });
  }
}
