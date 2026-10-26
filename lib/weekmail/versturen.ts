import type { SupabaseClient } from "@supabase/supabase-js";

import { leesTrainingsboekhouding } from "@/lib/data/trainingen";
import {
  naarActiviteitsoort,
  naarAfspraak,
  naarKlant,
  naarProfiel,
  type Rij,
} from "@/lib/data/werkset";
import {
  aantalTrainingen,
  gedaneTrainingen,
  nogNietGemeld,
} from "@/lib/trainingen/gedaan";
import { weekmailBericht } from "./bericht";
import { mailFoutMelding, mailInstellingen, verstuurMail } from "./smtp";
import { weekInNederland } from "./tijd";

/**
 * De weekmail samenstellen, versturen en vastleggen (SPEC.md 4.13 en 6.6).
 *
 * Werkt met de verbinding die je meegeeft: die met de geheime sleutel voor de
 * vaste mail op maandagochtend, of die van de ingelogde beheerder voor de
 * knop "Nu versturen". In beide gevallen ziet de verbinding de afspraken van
 * alle medewerkers.
 *
 * Volgorde, zodat er nooit twee keer dezelfde mail gaat en een mislukte mail
 * niets kwijtraakt:
 *  1. een rij in `weekmails` maken. Voor de vaste mail kan dat één keer per
 *     week; een tweede poging stuit op de unieke index en stopt hier;
 *  2. de mail versturen. Mislukt dat, dan gaat de rij weer weg en kan het
 *     opnieuw;
 *  3. vastleggen welke trainingen erin stonden.
 */

export type WeekmailUitkomst =
  | { status: "verstuurd"; aantal: number }
  | { status: "al-verstuurd" }
  | { status: "niet-ingesteld"; ontbreekt: string[] }
  | { status: "fout"; melding: string };

/** Postgres en PostgREST zeggen allebei op hun eigen manier "deze tabel bestaat niet". */
function tabelOntbreekt(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

export async function verstuurWeekmail(
  supabase: SupabaseClient,
  opties: { automatisch: boolean; nu: Date; portaalAdres: string | null },
): Promise<WeekmailUitkomst> {
  const { instellingen, ontbreekt } = mailInstellingen();
  if (!instellingen) return { status: "niet-ingesteld", ontbreekt };

  const [profielen, klanten, soorten, afspraken, boekhouding] = await Promise.all([
    supabase.from("profielen").select("*"),
    supabase.from("klanten").select("*"),
    supabase.from("activiteitsoorten").select("*"),
    supabase.from("afspraken").select("*").eq("status", "voltooid"),
    leesTrainingsboekhouding(supabase),
  ]);

  const leesFout = [profielen.error, klanten.error, soorten.error, afspraken.error].find(
    Boolean,
  );
  if (leesFout) {
    return {
      status: "fout",
      melding: `De gegevens konden niet worden opgehaald (${leesFout.code ?? "onbekend"}).`,
    };
  }
  if (!boekhouding.beschikbaar) {
    return {
      status: "fout",
      melding:
        "De tabellen voor de weekmail staan nog niet in de database. Draai de SQL uit PUBLICEREN.md, stap 4e.",
    };
  }

  const lijst = gedaneTrainingen({
    afspraken: (afspraken.data ?? []).map((rij) => naarAfspraak(rij as Rij)),
    klanten: (klanten.data ?? []).map((rij) => naarKlant(rij as Rij)),
    soorten: (soorten.data ?? []).map((rij) => naarActiviteitsoort(rij as Rij)),
    medewerkers: (profielen.data ?? []).map((rij) => {
      const profiel = naarProfiel(rij as Rij);
      return {
        id: profiel.id,
        naam: `${profiel.voornaam} ${profiel.achternaam}`.trim(),
        actief: profiel.actief,
        rol: profiel.rol,
      };
    }),
    facturen: boekhouding.facturen,
    gemeld: boekhouding.gemeld,
  });
  const nieuw = nogNietGemeld(lijst);
  const aantal = aantalTrainingen(nieuw);
  const week = weekInNederland(opties.nu);

  // 1. Vastleggen dat deze mail gaat.
  const { data: mail, error: claimFout } = await supabase
    .from("weekmails")
    .insert({ week, automatisch: opties.automatisch })
    .select("id")
    .single();

  if (claimFout || !mail) {
    if (claimFout?.code === "23505") return { status: "al-verstuurd" };
    if (tabelOntbreekt(claimFout?.code)) {
      return {
        status: "fout",
        melding:
          "De tabellen voor de weekmail staan nog niet in de database. Draai de SQL uit PUBLICEREN.md, stap 4e.",
      };
    }
    return {
      status: "fout",
      melding: `De weekmail kon niet worden vastgelegd (${claimFout?.code ?? "onbekend"}).`,
    };
  }

  // 2. Versturen.
  try {
    await verstuurMail(
      instellingen,
      weekmailBericht({
        nieuw,
        week,
        eerste: boekhouding.laatsteWeekmail === null,
        portaalAdres: opties.portaalAdres,
      }),
    );
  } catch (fout) {
    await supabase.from("weekmails").delete().eq("id", mail.id);
    return { status: "fout", melding: mailFoutMelding(fout) };
  }

  // 3. Vastleggen wat erin stond. Mislukt dit, dan is de mail wel weg; de
  // trainingen staan dan volgende week nog een keer in de mail.
  const afspraakIds = nieuw.flatMap((medewerker) =>
    medewerker.trainingen.map((training) => training.afspraakId),
  );
  if (afspraakIds.length > 0) {
    await supabase.from("weekmail_trainingen").upsert(
      afspraakIds.map((afspraakId) => ({ weekmail_id: mail.id, afspraak_id: afspraakId })),
      { onConflict: "afspraak_id", ignoreDuplicates: true },
    );
  }
  await supabase
    .from("weekmails")
    .update({ verzonden_op: opties.nu.toISOString(), aantal_trainingen: aantal })
    .eq("id", mail.id);

  return { status: "verstuurd", aantal };
}
