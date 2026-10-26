import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Wat de beheerder bijhoudt bij de gedane trainingen (SPEC.md 4.12 en 4.13):
 * bij welke training de factuur is verstuurd, welke trainingen al in een
 * weekmail stonden, en wanneer de laatste weekmail ging.
 *
 * Bewust los van de werkset, net als de ritten. Bestaan de tabellen nog niet,
 * omdat de SQL-stap nog niet is gedraaid, dan geeft dit `beschikbaar: false`
 * en werkt de rest van het portaal gewoon door.
 */

export interface LaatsteWeekmail {
  verzondenOp: string;
  aantalTrainingen: number;
  automatisch: boolean;
}

export interface Trainingsboekhouding {
  beschikbaar: boolean;
  /** Per afspraak de datum waarop de factuur is verstuurd. */
  facturen: Map<string, string>;
  /** De afspraken die al in een weekmail stonden. */
  gemeld: Set<string>;
  laatsteWeekmail: LaatsteWeekmail | null;
}

/** Postgres en PostgREST zeggen allebei op hun eigen manier "deze tabel bestaat niet". */
function tabelOntbreekt(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

const LEEG: Trainingsboekhouding = {
  beschikbaar: false,
  facturen: new Map(),
  gemeld: new Set(),
  laatsteWeekmail: null,
};

/**
 * Leest de boekhouding met een gegeven verbinding: die van de ingelogde
 * beheerder, of die met de geheime sleutel voor de weekmail op maandagochtend.
 */
export async function leesTrainingsboekhouding(
  supabase: SupabaseClient,
): Promise<Trainingsboekhouding> {
  const [facturen, gemeld, laatste] = await Promise.all([
    supabase.from("verstuurde_facturen").select("afspraak_id, verstuurd_op"),
    supabase.from("weekmail_trainingen").select("afspraak_id"),
    supabase
      .from("weekmails")
      .select("verzonden_op, aantal_trainingen, automatisch")
      .not("verzonden_op", "is", null)
      .order("verzonden_op", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const fout = [facturen.error, gemeld.error, laatste.error].find(Boolean);
  if (fout) {
    if (tabelOntbreekt(fout.code)) return LEEG;
    throw new Error(
      `De facturen en weekmails konden niet worden opgehaald: ${fout.message}.`,
    );
  }

  return {
    beschikbaar: true,
    facturen: new Map(
      (facturen.data ?? []).map((rij) => [
        rij.afspraak_id as string,
        rij.verstuurd_op as string,
      ]),
    ),
    gemeld: new Set((gemeld.data ?? []).map((rij) => rij.afspraak_id as string)),
    laatsteWeekmail: laatste.data
      ? {
          verzondenOp: laatste.data.verzonden_op as string,
          aantalTrainingen: Number(laatste.data.aantal_trainingen),
          automatisch: Boolean(laatste.data.automatisch),
        }
      : null,
  };
}

/** Voor de schermen: met de sessie van de ingelogde gebruiker, één keer per aanvraag. */
export const trainingsboekhouding = cache(
  async (): Promise<Trainingsboekhouding> =>
    leesTrainingsboekhouding(await supabaseServer()),
);
