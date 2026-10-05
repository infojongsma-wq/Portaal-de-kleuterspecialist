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
export function netjesPostcode(tekst: string): string {
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

// ---------------------------------------------------------------------------
// Losse adresvelden: postcode, huisnummer, straat, plaats
// ---------------------------------------------------------------------------

/** De vier velden onder Van en Naar (SPEC.md 6.7). */
export interface AdresVelden {
  postcode: string;
  huisnummer: string;
  straat: string;
  plaats: string;
}

export const LEGE_ADRESVELDEN: AdresVelden = {
  postcode: "",
  huisnummer: "",
  straat: "",
  plaats: "",
};

const POSTCODE = /^\d{4}\s?[A-Za-z]{2}$/;

/** Is dit een Nederlandse postcode, zoals 7514 AB of 7514ab? */
export function isPostcode(tekst: string): boolean {
  return POSTCODE.test(tekst.trim());
}

/** Het getal vooraan een huisnummer: "12a" en "12-2" worden 12. */
export function huisnummerGetal(tekst: string): number | null {
  const getal = tekst.trim().match(/^\d+/);
  return getal ? Number(getal[0]) : null;
}

/**
 * "Voorbeeldstraat 1a" wordt straat "Voorbeeldstraat" en huisnummer "1a".
 *
 * Een toevoeging na een spatie bestaat uit letters ("12 A"); cijfers alleen na
 * een streepje ("12-2"). Zo blijft "Plein 1944 3" de straat "Plein 1944" met
 * huisnummer 3.
 */
export function splitsStraat(adres: string | null): {
  straat: string;
  huisnummer: string;
} {
  const schoon = (adres ?? "").trim().replace(/\s+/g, " ");
  const passend = schoon.match(
    /^(.*?\D)\s*(\d+(?:-[A-Za-z0-9]{1,4}|\s?[A-Za-z]{1,4})?)$/,
  );
  return passend
    ? { straat: passend[1].trim(), huisnummer: passend[2].trim() }
    : { straat: schoon, huisnummer: "" };
}

function veldenVan(adres: Adres | null): AdresVelden {
  if (!adres) return LEGE_ADRESVELDEN;
  return {
    ...splitsStraat(adres.adres),
    postcode: netjesPostcode(adres.postcode?.trim() ?? ""),
    plaats: adres.plaats?.trim() ?? "",
  };
}

/**
 * Een opgeslagen Van of Naar terug in losse velden, bijvoorbeeld om een rit te
 * wijzigen. Thuis en een school uit Klanten krijgen hun eigen adres; een
 * getypt adres wordt ontleed; een plaatsnaam komt in het veld Plaats.
 */
export function adresVelden(waarde: string, boek: Adresboek): AdresVelden {
  const schoon = waarde.trim();
  if (!schoon) return LEGE_ADRESVELDEN;
  if (isThuis(schoon)) return veldenVan(boek.thuis);

  const school = boek.scholen.find((kandidaat) =>
    zelfdePlaats(schoolLabel(kandidaat), schoon),
  );
  if (school) return veldenVan(school);

  // "Schoolweg 5, 5678 CD Hengelo"
  const metPostcode = schoon.match(/^(.+?),\s*(\d{4}\s?[A-Za-z]{2})\s+(.+)$/);
  if (metPostcode) {
    return {
      ...splitsStraat(metPostcode[1]),
      postcode: netjesPostcode(metPostcode[2]),
      plaats: metPostcode[3].trim(),
    };
  }

  // "Schoolweg 5, Hengelo": alleen als er een huisnummer in het eerste deel
  // staat. Anders is "Hengelo, Gelderland" ineens een straat.
  const zonderPostcode = schoon.match(/^(.+?\d.*?),\s*(.+)$/);
  if (zonderPostcode) {
    return {
      ...splitsStraat(zonderPostcode[1]),
      postcode: "",
      plaats: zonderPostcode[2].trim(),
    };
  }

  return { ...LEGE_ADRESVELDEN, plaats: schoon };
}

/**
 * De losse velden samen tot één adres, zoals het in de rit komt te staan:
 * "Schoolweg 5, 5678 CD Hengelo". Zonder plaats is het nog geen adres.
 */
export function samengesteldAdres(velden: AdresVelden): string | null {
  const plaats = velden.plaats.trim();
  if (!plaats) return null;
  const straatregel = [velden.straat.trim(), velden.huisnummer.trim()]
    .filter(Boolean)
    .join(" ");
  const plaatsregel = [netjesPostcode(velden.postcode.trim()), plaats]
    .filter(Boolean)
    .join(" ");
  return [straatregel, plaatsregel].filter(Boolean).join(", ");
}

/**
 * Leest straat en plaats uit het antwoord van de PDOK Locatieserver op een
 * vraag naar postcode en huisnummer. Alleen een treffer met precies die
 * postcode en dat huisnummer telt; anders `null`.
 */
export function leesPdokAdres(
  antwoord: unknown,
  postcode: string,
  huisnummer: number,
): { straat: string; plaats: string } | null {
  const documenten = (antwoord as { response?: { docs?: unknown } } | null)
    ?.response?.docs;
  if (!Array.isArray(documenten)) return null;

  const gezochtePostcode = postcode.replace(/\s+/g, "").toUpperCase();

  for (const document of documenten) {
    const velden = (document ?? {}) as Record<string, unknown>;
    const docPostcode = String(velden.postcode ?? "")
      .replace(/\s+/g, "")
      .toUpperCase();
    const docNummer = Number(velden.huisnummer);
    if (docPostcode !== gezochtePostcode || docNummer !== huisnummer) continue;

    const straat = typeof velden.straatnaam === "string" ? velden.straatnaam.trim() : "";
    const plaats =
      typeof velden.woonplaatsnaam === "string" ? velden.woonplaatsnaam.trim() : "";
    if (straat && plaats) return { straat, plaats };
  }

  return null;
}
