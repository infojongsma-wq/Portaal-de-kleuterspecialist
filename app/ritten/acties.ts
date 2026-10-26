"use server";

import { revalidatePath } from "next/cache";

import { rittenset, rittenVan } from "@/lib/data/ritten";
import type { Klant, Profiel, Rit } from "@/lib/data/types";
import { werkset } from "@/lib/data/werkset";
import { formatteerDatum } from "@/lib/formatteer";
import {
  googleSleutel,
  RouteplannerFout,
  routeVan,
} from "@/lib/ritten/google";
import {
  isThuis,
  onthoudenAfstand,
  routeAdres,
  THUIS,
  zelfdeRoutepunt,
  type Adresboek,
} from "@/lib/ritten/plaatsen";
import { supabaseServer } from "@/lib/supabase/server";
import { afrondKm, metersNaarKm, secondenNaarReisduurMinuten } from "@/lib/uren";
import {
  afwijkendeReistijdMinuten,
  leesDecimaal,
  leesReisduur,
  netjesPostcode,
  ritSchema,
  thuisadresSchema,
} from "@/lib/validatie/rit";

/**
 * Schrijfacties van de rittenregistratie (SPEC.md 6.7). Zoals overal in het
 * portaal: via server actions met een zod-schema, met de sessie van de
 * ingelogde gebruiker. Row Level Security in Postgres bepaalt wat er
 * werkelijk mag; de controles hieronder zijn er voor begrijpelijke meldingen.
 */

export interface ActieResultaat {
  gelukt: boolean;
  melding?: string;
  /** Foutmeldingen per veld, voor het formulier. */
  velden?: Record<string, string>;
  id?: string;
}

const NOG_GEEN_TABEL =
  "De ritten staan nog niet in de database: de SQL-stap voor de rittenregistratie is nog niet gedraaid. Zie PUBLICEREN.md.";

const NOG_GEEN_REISTIJD =
  "De reistijd kan nog niet worden opgeslagen: de SQL-stap voor de reistijd bij de ritten is nog niet gedraaid. Zie PUBLICEREN.md, stap 4f.";

/** PostgREST kent een kolom niet: de SQL voor de reistijd is nog niet gedraaid. */
function kolommenOntbreken(fout: { code?: string } | null): boolean {
  return fout?.code === "PGRST204" || fout?.code === "42703";
}

function veldfouten(fouten: { path: PropertyKey[]; message: string }[]) {
  const velden: Record<string, string> = {};
  for (const fout of fouten) {
    const veld = String(fout.path[0] ?? "");
    if (veld && !velden[veld]) velden[veld] = fout.message;
  }
  return velden;
}

function fout(melding: string, oorzaak?: { message: string }): ActieResultaat {
  return {
    gelukt: false,
    melding: oorzaak ? `${melding} (${oorzaak.message})` : melding,
  };
}

/**
 * Plaatsnamen netjes en eenduidig opslaan: dubbele spaties weg, en "thuis"
 * altijd als "Thuis". Anders herkent de keuzelijst ze later niet als dezelfde
 * plaats.
 */
function netjesPlaats(plaats: string): string {
  const schoon = plaats.trim().replace(/\s+/g, " ");
  return isThuis(schoon) ? THUIS : schoon;
}

// ---------------------------------------------------------------------------
// Ritten
// ---------------------------------------------------------------------------

export async function bewaarRit(invoer: unknown): Promise<ActieResultaat> {
  const gecontroleerd = ritSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  if (!ritten.beschikbaar) return fout(NOG_GEEN_TABEL);

  const bestaande = waarden.id
    ? ritten.ritten.find((rit) => rit.id === waarden.id)
    : undefined;
  if (waarden.id && !bestaande) return fout("Deze rit is niet gevonden.");
  if (bestaande && bestaande.medewerkerId !== gegevens.ik.id) {
    return fout("Deze rit is niet van jou.");
  }

  // Een bestaande rit houdt de vergoeding waarmee hij is vastgelegd. Een
  // nieuwe rit krijgt de vergoeding die nu in de instellingen staat.
  const vergoeding =
    bestaande?.vergoedingPerKm ?? gegevens.instellingen.kilometervergoedingPerKm;
  if (vergoeding == null) {
    return fout(
      "De kilometervergoeding is nog niet ingesteld. De beheerder vult die in bij Beheer → Instellingen.",
    );
  }

  const rij = {
    medewerker_id: gegevens.ik.id,
    datum: waarden.datum,
    doel: waarden.doel,
    van_plaats: netjesPlaats(waarden.vanPlaats),
    naar_plaats: netjesPlaats(waarden.naarPlaats),
    heen_en_terug: waarden.heenEnTerug,
    km_enkel: afrondKm(leesDecimaal(waarden.kmEnkel) ?? 0),
    vergoeding_per_km: vergoeding,
    reisduur_enkel_minuten: leesReisduur(waarden.reisduurEnkelMinuten),
    afwijkende_reistijd_minuten: waarden.afwijkend
      ? afwijkendeReistijdMinuten(waarden.afwijkendUren, waarden.afwijkendMinuten)
      : null,
  };

  const supabase = await supabaseServer();

  if (bestaande) {
    const { error } = await supabase
      .from("ritten")
      .update(rij)
      .eq("id", bestaande.id);
    if (kolommenOntbreken(error)) return fout(NOG_GEEN_REISTIJD);
    if (error) return fout("De rit kon niet worden bijgewerkt.", error);
    revalidatePath("/ritten");
    return { gelukt: true, id: bestaande.id, melding: "Rit bijgewerkt." };
  }

  const { data, error } = await supabase
    .from("ritten")
    .insert(rij)
    .select("id")
    .single();
  if (kolommenOntbreken(error)) return fout(NOG_GEEN_REISTIJD);
  if (error) return fout("De rit kon niet worden opgeslagen.", error);

  revalidatePath("/ritten");
  return { gelukt: true, id: data?.id, melding: "Rit opgeslagen." };
}

export async function verwijderRit(ritId: string): Promise<ActieResultaat> {
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  if (!ritten.beschikbaar) return fout(NOG_GEEN_TABEL);

  const rit = ritten.ritten.find((r) => r.id === ritId);
  if (!rit || rit.medewerkerId !== gegevens.ik.id) {
    return fout("Deze rit is niet gevonden.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.from("ritten").delete().eq("id", ritId);
  if (error) return fout("De rit kon niet worden verwijderd.", error);

  revalidatePath("/ritten");
  return { gelukt: true, melding: "Rit verwijderd." };
}

// ---------------------------------------------------------------------------
// Afstand en reisduur
// ---------------------------------------------------------------------------

export interface Afstand {
  /** Kilometers van de enkele reis, of `null` als de medewerker ze zelf invult. */
  kmEnkel: number | null;
  /**
   * Reisduur van de enkele reis zonder files, in minuten en afgerond (SPEC.md
   * 5.2 en 5.6), of `null` als die niet bekend is.
   */
  reisduurEnkelMinuten: number | null;
  /** Waar de kilometers vandaan komen; `null` als er geen getal is. */
  bron: "onthouden" | "berekend" | null;
  /** Uitleg voor onder het veld. */
  melding: string | null;
}

interface Routegegevens {
  /** De ritten van de medewerker om wie het gaat, voor eerder gereden routes. */
  ritten: Rit[];
  /** Haar profiel: daar staat het thuisadres in. */
  profiel: Profiel;
  klanten: Klant[];
  afrondingMinuten: number;
}

/**
 * Zoekt de afstand en de reisduur van een route op (SPEC.md 5.7):
 *
 * 1. Is deze route eerder gereden, in een van beide richtingen? Dan de
 *    afstand en de reisduur van de meest recente rit. Zo blijft een eigen
 *    verbetering bewaard, en is er geen externe dienst nodig.
 * 2. Anders rekent Google Maps de route uit: van adres tot adres, of tussen
 *    plaatsen als er alleen een plaatsnaam is gekozen. Voor Thuis het
 *    volledige thuisadres, zonder naam (SPEC.md 5.7). Heeft een eerder
 *    gereden route nog geen reisduur, dan komt alleen die van Google.
 * 3. Lukt dat niet, dan vult de medewerker de kilometers en de reistijd zelf
 *    in.
 */
async function bepaalRoute(
  van: string,
  naar: string,
  gegevens: Routegegevens,
): Promise<Afstand> {
  const geen = (melding: string | null): Afstand => ({
    kmEnkel: null,
    reisduurEnkelMinuten: null,
    bron: null,
    melding,
  });

  if (!van.trim() || !naar.trim()) return geen(null);

  const eerder = onthoudenAfstand(gegevens.ritten, van, naar);
  const eerderMelding = eerder
    ? `Zelfde afstand als bij je rit van ${formatteerDatum(eerder.datum)}.`
    : null;
  if (eerder && eerder.reisduurEnkelMinuten != null) {
    return {
      kmEnkel: eerder.kmEnkel,
      reisduurEnkelMinuten: eerder.reisduurEnkelMinuten,
      bron: "onthouden",
      melding: eerderMelding,
    };
  }

  // Lukt het opzoeken bij Google niet, dan blijven de onthouden kilometers
  // wel staan; alleen de reisduur is dan onbekend.
  const zonderGoogle = (melding: string): Afstand =>
    eerder
      ? {
          kmEnkel: eerder.kmEnkel,
          reisduurEnkelMinuten: null,
          bron: "onthouden",
          melding: eerderMelding,
        }
      : geen(melding);

  const { profiel } = gegevens;
  const boek: Adresboek = {
    thuis: {
      adres: profiel.standplaatsAdres,
      postcode: profiel.standplaatsPostcode,
      plaats: profiel.standplaatsPlaats,
    },
    // Ook scholen die op non-actief staan: een oude rit kan er nog heen gaan.
    scholen: gegevens.klanten.map((klant) => ({
      naam: klant.naam,
      adres: klant.adres,
      postcode: klant.postcode,
      plaats: klant.plaats,
    })),
  };

  if ((isThuis(van) || isThuis(naar)) && !profiel.standplaatsPlaats?.trim()) {
    return zonderGoogle(
      "Stel bovenaan eerst je thuisadres in; dan rekent de app de afstand en de reistijd vanaf Thuis uit. Of vul ze zelf in.",
    );
  }

  if (zelfdeRoutepunt(van, naar, boek)) {
    return zonderGoogle(
      "Van en naar liggen in dezelfde plaats. Vul de kilometers en de reistijd zelf in.",
    );
  }

  const sleutel = googleSleutel();
  if (!sleutel) {
    return zonderGoogle(
      "Automatisch berekenen staat nog niet aan. Vul de kilometers en de reistijd zelf in.",
    );
  }

  const vanAdres = routeAdres(van, boek);
  const naarAdres = routeAdres(naar, boek);
  if (!vanAdres || !naarAdres) return zonderGoogle("");

  try {
    const route = await routeVan(vanAdres, naarAdres, sleutel);
    if (route === null) {
      return zonderGoogle(
        "Google Maps vond geen route tussen deze plaatsen. Controleer de plaatsnamen, of vul de kilometers en de reistijd zelf in.",
      );
    }

    const km = metersNaarKm(route.meters);
    if (km === 0) {
      return zonderGoogle(
        "Van en naar liggen in dezelfde plaats. Vul de kilometers en de reistijd zelf in.",
      );
    }

    const reisduur =
      route.seconden === null
        ? null
        : secondenNaarReisduurMinuten(route.seconden, gegevens.afrondingMinuten);

    return eerder
      ? {
          kmEnkel: eerder.kmEnkel,
          reisduurEnkelMinuten: reisduur,
          bron: "onthouden",
          melding: eerderMelding,
        }
      : { kmEnkel: km, reisduurEnkelMinuten: reisduur, bron: "berekend", melding: null };
  } catch (oorzaak) {
    // Alleen de statuscode in het logboek; plaatsnamen en adressen niet.
    const status = oorzaak instanceof RouteplannerFout ? oorzaak.status : null;
    console.error(
      `Route berekenen mislukt${status ? ` (HTTP ${status})` : ""}.`,
    );
    return zonderGoogle(
      status === 403 || status === 401
        ? "Google Maps weigert de sleutel. De beheerder kan dat nakijken op de pagina Diagnose. Vul de kilometers en de reistijd nu zelf in."
        : "De route kon nu niet worden berekend. Vul de kilometers en de reistijd zelf in.",
    );
  }
}

/** Voor het formulier: de route van de ingelogde medewerker. */
export async function zoekAfstand(van: string, naar: string): Promise<Afstand> {
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  return bepaalRoute(van, naar, {
    ritten: rittenVan(ritten.ritten, gegevens.ik.id),
    profiel: gegevens.ik,
    klanten: gegevens.klanten,
    afrondingMinuten: gegevens.instellingen.reistijdAfrondingMinuten,
  });
}

/** Zoveel routes per klik, zodat de knop niet te lang blijft draaien. */
const ROUTES_PER_KEER = 40;

/**
 * "Reistijden aanvullen" (SPEC.md 6.7): geeft ritten zonder reistijd alsnog
 * een berekende reisduur, bijvoorbeeld ritten van vóór de reistijd bij de
 * ritten kwam. Voor de eigen ritten; de beheerder kan het ook voor een
 * medewerker doen.
 */
export async function vulReistijdenAan(
  medewerkerId?: string,
): Promise<ActieResultaat & { bijgewerkt?: number; overgebleven?: number }> {
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  if (!ritten.beschikbaar) return fout(NOG_GEEN_TABEL);

  const voor = medewerkerId ?? gegevens.ik.id;
  if (voor !== gegevens.ik.id && gegevens.ik.rol !== "beheerder") {
    return fout("Je kunt alleen je eigen ritten aanvullen.");
  }
  const profiel = gegevens.profielen.find((p) => p.id === voor);
  if (!profiel) return fout("Deze medewerker is niet gevonden.");

  const vanMedewerker = rittenVan(ritten.ritten, voor);
  const zonder = vanMedewerker.filter(
    (rit) => rit.reisduurEnkelMinuten === null && rit.afwijkendeReistijdMinuten === null,
  );
  if (zonder.length === 0) {
    return { gelukt: true, bijgewerkt: 0, overgebleven: 0, melding: "Alle ritten hebben een reistijd." };
  }

  const routegegevens: Routegegevens = {
    ritten: vanMedewerker,
    profiel,
    klanten: gegevens.klanten,
    afrondingMinuten: gegevens.instellingen.reistijdAfrondingMinuten,
  };

  // Eén vraag per route, in welke richting ook.
  const perRoute = new Map<string, Rit[]>();
  for (const rit of zonder) {
    const sleutel = [rit.vanPlaats, rit.naarPlaats]
      .map((plaats) => plaats.trim().toLowerCase().replace(/\s+/g, " "))
      .sort()
      .join(" ↔ ");
    perRoute.set(sleutel, [...(perRoute.get(sleutel) ?? []), rit]);
  }

  const supabase = await supabaseServer();
  let bijgewerkt = 0;
  let routes = 0;

  for (const groep of perRoute.values()) {
    if (routes >= ROUTES_PER_KEER) break;
    routes += 1;
    const route = await bepaalRoute(groep[0].vanPlaats, groep[0].naarPlaats, routegegevens);
    if (route.reisduurEnkelMinuten === null) continue;

    const { error } = await supabase
      .from("ritten")
      .update({ reisduur_enkel_minuten: route.reisduurEnkelMinuten })
      .in(
        "id",
        groep.map((rit) => rit.id),
      );
    if (kolommenOntbreken(error)) return fout(NOG_GEEN_REISTIJD);
    if (error) return fout("De reistijden konden niet worden opgeslagen.", error);
    bijgewerkt += groep.length;
  }

  const overgebleven = zonder.length - bijgewerkt;
  revalidatePath("/ritten");
  revalidatePath("/mijn-uren");
  revalidatePath("/beheer");
  return {
    gelukt: true,
    bijgewerkt,
    overgebleven,
    melding:
      overgebleven === 0
        ? `Klaar: ${bijgewerkt === 1 ? "1 rit heeft" : `${bijgewerkt} ritten hebben`} nu een reistijd.`
        : `${bijgewerkt === 1 ? "1 rit heeft" : `${bijgewerkt} ritten hebben`} nu een reistijd. Bij ${overgebleven === 1 ? "1 rit" : `${overgebleven} ritten`} lukte het niet${routes >= ROUTES_PER_KEER ? " of nog niet; klik nog een keer" : ""}. Vul die zelf in: klik op de rit en kies Afwijkende reistijd.`,
  };
}

// ---------------------------------------------------------------------------
// Thuisadres
// ---------------------------------------------------------------------------

/**
 * Het thuisadres van de ingelogde medewerker. Staat in de bestaande velden
 * voor de standplaats in `profielen`; die mag een medewerker zelf wijzigen.
 */
export async function bewaarThuisadres(
  invoer: unknown,
): Promise<ActieResultaat> {
  const gecontroleerd = thuisadresSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("profielen")
    .update({
      standplaats_adres: waarden.adres || null,
      standplaats_postcode: waarden.postcode
        ? netjesPostcode(waarden.postcode)
        : null,
      standplaats_plaats: waarden.plaats,
    })
    .eq("id", gegevens.ik.id);
  if (error) return fout("Het thuisadres kon niet worden opgeslagen.", error);

  revalidatePath("/ritten");
  revalidatePath("/beheer");
  return { gelukt: true, melding: "Thuisadres opgeslagen." };
}
