/**
 * Plaatsen en routes van de rittenregistratie (SPEC.md 5.7 en 6.7).
 *
 * Pure functies zonder databasetoegang of netwerk, zodat ze los te testen zijn.
 * De ritten zelf worden als argument meegegeven.
 */

/** De naam van de eigen woonplek in de keuzelijst en in het overzicht. */
export const THUIS = "Thuis";

/** Plaatsnamen vergelijken zonder op hoofdletters of extra spaties te letten. */
export function normaliseerPlaats(plaats: string): string {
  return plaats.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl");
}

export function isThuis(plaats: string): boolean {
  return normaliseerPlaats(plaats) === normaliseerPlaats(THUIS);
}

/** Zelfde plaats, ongeacht hoofdletters of spaties. */
export function zelfdePlaats(a: string, b: string): boolean {
  return normaliseerPlaats(a) === normaliseerPlaats(b);
}

/**
 * Het adres zoals het naar de routeplanner gaat, of `null` als dat nog niet te
 * bepalen is.
 *
 * Voor Thuis is dat alléén de woonplaats. Straat en huisnummer gaan nooit naar
 * een externe dienst (CLAUDE.md, "Privacy"). "Hengelo (Gelderland)" wordt
 * "Hengelo, Gelderland", zodat de routeplanner de goede Hengelo neemt.
 */
export function routeAdres(
  plaats: string,
  thuisWoonplaats: string | null,
): string | null {
  if (isThuis(plaats)) return thuisWoonplaats?.trim() || null;

  const metToevoeging = plaats.trim().match(/^(.+?)\s*\(([^)]+)\)$/);
  if (metToevoeging) return `${metToevoeging[1].trim()}, ${metToevoeging[2].trim()}`;

  return plaats.trim() || null;
}

/**
 * Liggen twee plaatsen op hetzelfde punt voor de routeplanner? Dan valt er
 * niets te berekenen, bijvoorbeeld van Thuis in Enschede naar Enschede.
 */
export function zelfdeRoutepunt(
  van: string,
  naar: string,
  thuisWoonplaats: string | null,
): boolean {
  const a = routeAdres(van, thuisWoonplaats);
  const b = routeAdres(naar, thuisWoonplaats);
  return a !== null && b !== null && zelfdePlaats(a, b);
}

export interface EerdereRit {
  datum: string;
  aangemaaktOp: string;
  vanPlaats: string;
  naarPlaats: string;
  kmEnkel: number;
}

/**
 * De afstand die de medewerker eerder voor deze route gebruikte, in een van
 * beide richtingen. De meest recente rit telt: een afstand die zij ooit met de
 * hand heeft verbeterd, komt zo vanzelf terug.
 */
export function onthoudenAfstand(
  ritten: EerdereRit[],
  van: string,
  naar: string,
): EerdereRit | null {
  const passend = ritten.filter(
    (rit) =>
      (zelfdePlaats(rit.vanPlaats, van) && zelfdePlaats(rit.naarPlaats, naar)) ||
      (zelfdePlaats(rit.vanPlaats, naar) && zelfdePlaats(rit.naarPlaats, van)),
  );

  return (
    passend.sort(
      (a, b) =>
        b.datum.localeCompare(a.datum) ||
        b.aangemaaktOp.localeCompare(a.aangemaaktOp),
    )[0] ?? null
  );
}

/**
 * De plaatsen die eerder zijn ingevoerd, voor de keuzelijst. De vaakst
 * gebruikte eerst; bij gelijke stand op alfabet. Thuis zit er niet bij: die
 * staat altijd los bovenaan.
 */
export function eerderGebruiktePlaatsen(
  ritten: Pick<EerdereRit, "vanPlaats" | "naarPlaats">[],
): string[] {
  const telling = new Map<string, { naam: string; aantal: number }>();

  for (const rit of ritten) {
    for (const plaats of [rit.vanPlaats, rit.naarPlaats]) {
      if (!plaats.trim() || isThuis(plaats)) continue;
      const sleutel = normaliseerPlaats(plaats);
      const huidig = telling.get(sleutel);
      if (huidig) huidig.aantal += 1;
      else telling.set(sleutel, { naam: plaats.trim(), aantal: 1 });
    }
  }

  return [...telling.values()]
    .sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam, "nl"))
    .map((plaats) => plaats.naam);
}

// ---------------------------------------------------------------------------
// Antwoorden van externe diensten lezen
// ---------------------------------------------------------------------------

export interface PlaatsSuggestie {
  /** Zoals de plaats in de keuzelijst en in de rit komt te staan. */
  label: string;
  plaats: string;
  gemeente: string | null;
  provincie: string | null;
}

/**
 * Leest de suggesties van de PDOK Locatieserver (type woonplaats).
 *
 * PDOK noemt een woonplaats "Hengelo, Hengelo, Overijssel": plaats, gemeente,
 * provincie. Bestaat dezelfde plaatsnaam vaker, dan krijgt het label de
 * provincie erbij: "Hengelo (Overijssel)" en "Hengelo (Gelderland)". Liggen ze
 * ook nog in dezelfde provincie, dan de gemeente.
 */
export function leesPdokSuggesties(antwoord: unknown): PlaatsSuggestie[] {
  const documenten = (antwoord as { response?: { docs?: unknown } } | null)
    ?.response?.docs;
  if (!Array.isArray(documenten)) return [];

  const ruw = documenten.flatMap((document) => {
    const weergavenaam = (document as { weergavenaam?: unknown })?.weergavenaam;
    if (typeof weergavenaam !== "string") return [];
    const delen = weergavenaam.split(",").map((deel) => deel.trim());
    const plaats = delen[0];
    if (!plaats) return [];
    return [
      {
        plaats,
        gemeente: delen.length >= 3 ? delen[1] : null,
        provincie: delen.length >= 2 ? delen[delen.length - 1] : null,
      },
    ];
  });

  // Dubbele treffers weg: dezelfde plaats in dezelfde gemeente.
  const uniek = ruw.filter(
    (suggestie, positie) =>
      ruw.findIndex(
        (ander) =>
          zelfdePlaats(ander.plaats, suggestie.plaats) &&
          ander.gemeente === suggestie.gemeente &&
          ander.provincie === suggestie.provincie,
      ) === positie,
  );

  return uniek.map((suggestie) => {
    const naamgenoten = uniek.filter((ander) =>
      zelfdePlaats(ander.plaats, suggestie.plaats),
    );
    if (naamgenoten.length === 1) return { ...suggestie, label: suggestie.plaats };

    const zelfdeProvincie = naamgenoten.filter(
      (ander) => ander.provincie === suggestie.provincie,
    );
    const toevoeging =
      zelfdeProvincie.length > 1 || !suggestie.provincie
        ? (suggestie.gemeente ?? suggestie.provincie)
        : suggestie.provincie;

    return {
      ...suggestie,
      label: toevoeging ? `${suggestie.plaats} (${toevoeging})` : suggestie.plaats,
    };
  });
}

/**
 * Leest de afstand in meters uit het antwoord van de Google Routes API
 * (`computeRoutes`), of `null` als er geen route is gevonden.
 *
 * Google laat een waarde van nul weg uit het antwoord. Een route zonder
 * `distanceMeters` is dus een route van 0 meter: begin en eind liggen op
 * hetzelfde punt.
 */
export function leesGoogleAfstand(antwoord: unknown): number | null {
  const routes = (antwoord as { routes?: unknown } | null)?.routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;

  const meters = (routes[0] as { distanceMeters?: unknown })?.distanceMeters;
  if (meters === undefined) return 0;
  return typeof meters === "number" && Number.isFinite(meters) && meters >= 0
    ? meters
    : null;
}
