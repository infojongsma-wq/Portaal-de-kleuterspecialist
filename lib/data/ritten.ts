import { cache } from "react";

import { supabaseServer } from "@/lib/supabase/server";
import type { Rit } from "./types";
import { getal } from "./werkset";

/**
 * De ritten die de ingelogde gebruiker mag zien. Row Level Security bepaalt
 * wat er terugkomt: een medewerker krijgt alleen de eigen ritten, de
 * beheerder alles.
 *
 * Bewust los van de werkset. Bestaat de tabel nog niet, omdat de SQL-stap
 * nog niet is gedraaid, dan geeft dit een lege lijst met `beschikbaar:
 * false`. Zo blijft de rest van het portaal gewoon werken, en kan het
 * tabblad Ritten uitleggen wat er nog moet gebeuren.
 */

export interface Rittenset {
  beschikbaar: boolean;
  ritten: Rit[];
}

type Rij = Record<string, unknown>;

function naarRit(rij: Rij): Rit {
  return {
    id: rij.id as string,
    medewerkerId: rij.medewerker_id as string,
    datum: rij.datum as string,
    doel: rij.doel as string,
    vanPlaats: rij.van_plaats as string,
    naarPlaats: rij.naar_plaats as string,
    heenEnTerug: Boolean(rij.heen_en_terug),
    kmEnkel: getal(rij.km_enkel),
    vergoedingPerKm: getal(rij.vergoeding_per_km),
    aangemaaktOp: rij.aangemaakt_op as string,
  };
}

/** Postgres en PostgREST zeggen allebei op hun eigen manier "deze tabel bestaat niet". */
function tabelOntbreekt(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

export const rittenset = cache(async (): Promise<Rittenset> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("ritten")
    .select("*")
    .order("datum")
    .order("aangemaakt_op");

  if (error) {
    if (tabelOntbreekt(error.code)) return { beschikbaar: false, ritten: [] };
    throw new Error(`De ritten konden niet worden opgehaald: ${error.message}.`);
  }

  return { beschikbaar: true, ritten: (data ?? []).map(naarRit) };
});

/** De ritten van één medewerker, op datum en daarna op volgorde van invoer. */
export function rittenVan(ritten: Rit[], medewerkerId: string): Rit[] {
  return ritten.filter((rit) => rit.medewerkerId === medewerkerId);
}
