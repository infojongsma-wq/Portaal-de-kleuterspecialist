"use server";

import { revalidatePath } from "next/cache";

import { rittenset, rittenVan } from "@/lib/data/ritten";
import { werkset } from "@/lib/data/werkset";
import { formatteerDatum } from "@/lib/formatteer";
import {
  afstandInMeters,
  googleSleutel,
  RouteplannerFout,
} from "@/lib/ritten/google";
import {
  isThuis,
  onthoudenAfstand,
  routeAdres,
  THUIS,
  zelfdeRoutepunt,
} from "@/lib/ritten/plaatsen";
import { supabaseServer } from "@/lib/supabase/server";
import { afrondKm, metersNaarKm } from "@/lib/uren";
import {
  leesDecimaal,
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
  };

  const supabase = await supabaseServer();

  if (bestaande) {
    const { error } = await supabase
      .from("ritten")
      .update(rij)
      .eq("id", bestaande.id);
    if (error) return fout("De rit kon niet worden bijgewerkt.", error);
    revalidatePath("/ritten");
    return { gelukt: true, id: bestaande.id, melding: "Rit bijgewerkt." };
  }

  const { data, error } = await supabase
    .from("ritten")
    .insert(rij)
    .select("id")
    .single();
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
// Afstand
// ---------------------------------------------------------------------------

export interface Afstand {
  /** Kilometers van de enkele reis, of `null` als de medewerker ze zelf invult. */
  kmEnkel: number | null;
  /** Waar het getal vandaan komt; `null` als er geen getal is. */
  bron: "onthouden" | "berekend" | null;
  /** Uitleg voor onder het veld. */
  melding: string | null;
}

/**
 * Zoekt de afstand van een route op (SPEC.md 5.7):
 *
 * 1. Is deze route eerder gereden, in een van beide richtingen? Dan de
 *    afstand van de meest recente rit. Zo blijft een eigen verbetering
 *    bewaard, en is er geen externe dienst nodig.
 * 2. Anders rekent Google Maps de afstand over de weg uit, tussen de
 *    plaatsen. Voor Thuis alleen de woonplaats.
 * 3. Lukt dat niet, dan vult de medewerker de kilometers zelf in.
 */
export async function zoekAfstand(
  van: string,
  naar: string,
): Promise<Afstand> {
  const geen = (melding: string | null): Afstand => ({
    kmEnkel: null,
    bron: null,
    melding,
  });

  if (!van.trim() || !naar.trim()) return geen(null);

  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);

  const eerder = onthoudenAfstand(
    rittenVan(ritten.ritten, gegevens.ik.id),
    van,
    naar,
  );
  if (eerder) {
    return {
      kmEnkel: eerder.kmEnkel,
      bron: "onthouden",
      melding: `Zelfde afstand als bij je rit van ${formatteerDatum(eerder.datum)}.`,
    };
  }

  const woonplaats = gegevens.ik.standplaatsPlaats;
  if ((isThuis(van) || isThuis(naar)) && !woonplaats?.trim()) {
    return geen(
      "Stel bovenaan eerst je thuisadres in; dan rekent de app de afstand vanaf Thuis uit. Of vul de kilometers zelf in.",
    );
  }

  if (zelfdeRoutepunt(van, naar, woonplaats)) {
    return geen(
      "Van en naar liggen in dezelfde plaats. Vul de kilometers zelf in.",
    );
  }

  const sleutel = googleSleutel();
  if (!sleutel) {
    return geen(
      "Automatisch berekenen staat nog niet aan. Vul de kilometers zelf in.",
    );
  }

  const vanAdres = routeAdres(van, woonplaats);
  const naarAdres = routeAdres(naar, woonplaats);
  if (!vanAdres || !naarAdres) return geen(null);

  try {
    const meters = await afstandInMeters(vanAdres, naarAdres, sleutel);
    if (meters === null) {
      return geen(
        "Google Maps vond geen route tussen deze plaatsen. Controleer de plaatsnamen, of vul de kilometers zelf in.",
      );
    }

    const km = metersNaarKm(meters);
    if (km === 0) {
      return geen(
        "Van en naar liggen in dezelfde plaats. Vul de kilometers zelf in.",
      );
    }

    return { kmEnkel: km, bron: "berekend", melding: null };
  } catch (oorzaak) {
    // Alleen de statuscode in het logboek; plaatsnamen en adressen niet.
    const status = oorzaak instanceof RouteplannerFout ? oorzaak.status : null;
    console.error(
      `Afstand berekenen mislukt${status ? ` (HTTP ${status})` : ""}.`,
    );
    return geen(
      status === 403 || status === 401
        ? "Google Maps weigert de sleutel. De beheerder kan dat nakijken op de pagina Diagnose. Vul de kilometers nu zelf in."
        : "De afstand kon nu niet worden berekend. Vul de kilometers zelf in.",
    );
  }
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
