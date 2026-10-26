import { leesGoogleRoute, type GoogleRoute } from "./plaatsen";

/**
 * Afstand over de weg via de Google Routes API (SPEC.md 5.7).
 *
 * Alleen voor de server. De sleutel staat in de omgevingsvariabele
 * `GOOGLE_MAPS_API_KEY`, nooit in een `NEXT_PUBLIC_*`-variabele: anders zou
 * iedereen hem uit de browser kunnen halen en op onze rekening gebruiken.
 *
 * Naar Google gaan adressen en plaatsnamen, nooit een naam van een persoon.
 * Voor Thuis is dat het volledige thuisadres: op verzoek van de opdrachtgever
 * een bewuste uitzondering op de privacyafspraak (CLAUDE.md, "Privacy";
 * SPEC.md 5.7). Zie `routeAdres` in `plaatsen.ts`. De vraag komt van onze
 * server, niet uit de browser van de medewerker; Google ziet dus ook haar
 * IP-adres niet.
 */

const ROUTES_API = "https://routes.googleapis.com/directions/v2:computeRoutes";

export function googleSleutel(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

export class RouteplannerFout extends Error {
  constructor(
    readonly status: number,
    readonly toelichting: string,
  ) {
    super(`Google Routes API gaf HTTP ${status}`);
    this.name = "RouteplannerFout";
  }
}

/**
 * De afstand in meters en de reisduur zonder files van de snelste route met
 * de auto, of `null` als Google geen route vond. Gooit een `RouteplannerFout`
 * als Google de vraag weigert, bijvoorbeeld omdat de sleutel niet klopt of de
 * Routes API niet aanstaat.
 */
export async function routeVan(
  van: string,
  naar: string,
  sleutel: string,
): Promise<GoogleRoute | null> {
  const antwoord = await fetch(ROUTES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": sleutel,
      // Alleen de afstand en de reisduur opvragen. Zonder verkeersinformatie
      // is de reisduur die zonder files (SPEC.md 5.2), en valt de vraag in het
      // eenvoudigste tarief, met de meeste gratis vragen per maand.
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: { address: van },
      destination: { address: naar },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      languageCode: "nl-NL",
      regionCode: "nl",
      units: "METRIC",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!antwoord.ok) {
    const tekst = await antwoord.text().catch(() => "");
    let toelichting = "";
    try {
      toelichting =
        (JSON.parse(tekst) as { error?: { message?: string } })?.error
          ?.message ?? "";
    } catch {
      // Geen JSON; dan blijft de toelichting leeg.
    }
    throw new RouteplannerFout(antwoord.status, toelichting);
  }

  return leesGoogleRoute(await antwoord.json());
}
