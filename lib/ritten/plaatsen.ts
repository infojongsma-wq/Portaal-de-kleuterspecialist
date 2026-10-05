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

export interface Adres {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
}

/** "Schoolstraat 5, 7551 AB Hengelo", of `null` zonder plaats. */
export function adresInEenRegel(adres: Adres): string | null {
  if (!adres.plaats?.trim()) return null;
  const plaatsregel = [adres.postcode?.trim(), adres.plaats.trim()]
    .filter(Boolean)
    .join(" ");
  return [adres.adres?.trim(), plaatsregel].filter(Boolean).join(", ");
}

/** Een school uit Klanten, zoals hij in de keuzelijst van Van en Naar staat. */
export interface School extends Adres {
  naam: string;
}

/**
 * Hoe een school in een rit komt te staan: naam en adres samen, zodat het
 * overzicht en de Excel ook later nog laten zien waar de rit heen ging.
 * "De Zonnebloem, Schoolstraat 5, 7551 AB Hengelo".
 */
export function schoolLabel(school: School): string {
  const adres = adresInEenRegel(school);
  return adres ? `${school.naam.trim()}, ${adres}` : school.naam.trim();
}

/**
 * Wat de routeplanner nodig heeft om de afstand te bepalen: het thuisadres en
 * de adressen van de scholen.
 */
export interface Adresboek {
  thuis: Adres | null;
  scholen: School[];
}

/**
 * Het adres zoals het naar de routeplanner gaat, of `null` als dat nog niet te
 * bepalen is.
 *
 * - Thuis: het volledige thuisadres, zonder naam. Op verzoek van de
 *   opdrachtgever is dat een uitzondering op de privacyafspraak (CLAUDE.md,
 *   "Privacy"; SPEC.md 5.7): zo klopt de afstand van deur tot deur.
 * - Een school uit Klanten: het adres van de school.
 * - "Hengelo (Gelderland)" wordt "Hengelo, Gelderland", zodat de routeplanner
 *   de goede Hengelo neemt.
 * - Al het andere, zoals een getypt adres, gaat zoals het er staat.
 */
export function routeAdres(plaats: string, boek: Adresboek): string | null {
  if (isThuis(plaats)) return boek.thuis ? adresInEenRegel(boek.thuis) : null;

  const school = boek.scholen.find((kandidaat) =>
    zelfdePlaats(schoolLabel(kandidaat), plaats),
  );
  if (school) return adresInEenRegel(school) ?? school.naam;

  const metToevoeging = plaats.trim().match(/^(.+?)\s*\(([^)]+)\)$/);
  if (metToevoeging) return `${metToevoeging[1].trim()}, ${metToevoeging[2].trim()}`;

  return plaats.trim() || null;
}

/**
 * Liggen van en naar op hetzelfde punt voor de routeplanner? Dan valt er niets
 * te berekenen, bijvoorbeeld van Enschede naar Enschede.
 */
export function zelfdeRoutepunt(
  van: string,
  naar: string,
  boek: Adresboek,
): boolean {
  const a = routeAdres(van, boek);
  const b = routeAdres(naar, boek);
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
  /** Een woonplaats, of een adres met huisnummer. */
  soort: "woonplaats" | "adres";
}

/** "7551AB" wordt "7551 AB", zoals een postcode op een envelop staat. */
function netjesPostcode(tekst: string): string {
  return tekst.replace(/\b(\d{4})\s?([A-Za-z]{2})\b/g, (_, cijfers: string, letters: string) =>
    `${cijfers} ${letters.toUpperCase()}`,
  );
}

/**
 * Leest de suggesties van de PDOK Locatieserver: woonplaatsen en adressen.
 * Adressen komen eerst; wie een huisnummer typt, zoekt een adres.
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

  // Adressen: PDOK schrijft ze als "Schoolstraat 5, 7551AB Hengelo". Die
  // nemen we over zoals ze zijn, met een spatie in de postcode.
  const adressen: PlaatsSuggestie[] = documenten.flatMap((document) => {
    const { type, weergavenaam } = (document ?? {}) as {
      type?: unknown;
      weergavenaam?: unknown;
    };
    if (type !== "adres" || typeof weergavenaam !== "string") return [];
    const label = netjesPostcode(weergavenaam.trim());
    if (!label) return [];
    return [
      {
        label,
        plaats: label,
        gemeente: null,
        provincie: null,
        soort: "adres" as const,
      },
    ];
  });

  const ruw = documenten.flatMap((document) => {
    const { type, weergavenaam } = (document ?? {}) as {
      type?: unknown;
      weergavenaam?: unknown;
    };
    if (type === "adres" || typeof weergavenaam !== "string") return [];
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

  const woonplaatsen = uniek.map((suggestie): PlaatsSuggestie => {
    const naamgenoten = uniek.filter((ander) =>
      zelfdePlaats(ander.plaats, suggestie.plaats),
    );
    if (naamgenoten.length === 1) {
      return { ...suggestie, label: suggestie.plaats, soort: "woonplaats" };
    }

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
      soort: "woonplaats",
    };
  });

  return [...adressen, ...woonplaatsen];
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
