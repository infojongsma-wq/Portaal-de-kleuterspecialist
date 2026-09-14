"use server";

import { revalidatePath } from "next/cache";

import { werkset } from "@/lib/data/werkset";
import { supabaseServer } from "@/lib/supabase/server";
import { medewerkerSchema } from "@/lib/validatie/medewerker";

/**
 * Beheerdersacties: medewerkers vastleggen (SPEC.md 6.6).
 *
 * De controle op de rol staat hier voor een begrijpelijke melding. De
 * werkelijke beveiliging zit in Postgres: de policies op `profielen` laten
 * toevoegen en verwijderen alleen toe aan een beheerder, en een trigger bewaakt
 * dat rol, dienstverband en e-mailadres niet door een medewerker zelf worden
 * gewijzigd.
 */

export interface BeheerResultaat {
  gelukt: boolean;
  melding?: string;
  velden?: Record<string, string>;
  id?: string;
}

function ververs() {
  revalidatePath("/beheer");
  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
}

function leeg(waarde: string | undefined | null): string | null {
  const opgeschoond = (waarde ?? "").trim();
  return opgeschoond === "" ? null : opgeschoond;
}

export async function bewaarMedewerker(
  invoer: unknown,
): Promise<BeheerResultaat> {
  const gecontroleerd = medewerkerSchema.safeParse(invoer);

  if (!gecontroleerd.success) {
    const velden: Record<string, string> = {};
    for (const probleem of gecontroleerd.error.issues) {
      const veld = String(probleem.path[0] ?? "");
      if (veld && !velden[veld]) velden[veld] = probleem.message;
    }
    return { gelukt: false, velden, melding: "Niet alles is goed ingevuld." };
  }

  const gegevens = await werkset();

  if (gegevens.ik.rol !== "beheerder") {
    return { gelukt: false, melding: "Alleen de beheerder kan dit wijzigen." };
  }

  const waarden = gecontroleerd.data;
  const isZichzelf = waarden.id === gegevens.ik.id;

  // Zonder deze twee controles kan de enige beheerder zichzelf buitensluiten.
  if (isZichzelf && waarden.rol !== "beheerder") {
    return {
      gelukt: false,
      melding:
        "Je kunt je eigen beheerdersrol niet afnemen. Laat een andere beheerder dat doen.",
    };
  }
  if (isZichzelf && !waarden.actief) {
    return {
      gelukt: false,
      melding: "Je kunt jezelf niet op niet-actief zetten.",
    };
  }

  const rij = {
    voornaam: waarden.voornaam,
    achternaam: waarden.achternaam,
    email: waarden.email.trim().toLowerCase(),
    rol: waarden.rol,
    telefoon: leeg(waarden.telefoon),
    standplaats_adres: leeg(waarden.standplaatsAdres),
    standplaats_postcode: leeg(waarden.standplaatsPostcode),
    standplaats_plaats: leeg(waarden.standplaatsPlaats),
    in_dienst_vanaf: leeg(waarden.inDienstVanaf),
    uit_dienst_per: leeg(waarden.uitDienstPer),
    actief: waarden.actief,
  };

  const supabase = await supabaseServer();

  if (waarden.id) {
    const { error } = await supabase
      .from("profielen")
      .update({ ...rij, gewijzigd_op: new Date().toISOString() })
      .eq("id", waarden.id);

    if (error) {
      return {
        gelukt: false,
        melding:
          error.code === "23505"
            ? "Dat e-mailadres is al aan een andere medewerker gekoppeld."
            : `De medewerker kon niet worden bijgewerkt. (${error.message})`,
      };
    }

    ververs();
    return { gelukt: true, melding: "Gegevens bijgewerkt.", id: waarden.id };
  }

  const { data, error } = await supabase
    .from("profielen")
    .insert(rij)
    .select("id")
    .single();

  if (error) {
    return {
      gelukt: false,
      melding:
        error.code === "23505"
          ? "Er bestaat al een medewerker met dit e-mailadres."
          : `De medewerker kon niet worden toegevoegd. (${error.message})`,
    };
  }

  ververs();
  return {
    gelukt: true,
    melding:
      "Medewerker toegevoegd. Hij kan nog niet inloggen; stuur daarvoor een uitnodiging.",
    id: data.id as string,
  };
}
