"use server";

import { revalidatePath } from "next/cache";
import { huidigeMedewerker } from "@/lib/data/queries";
import { nieuwId, opslag } from "@/lib/data/opslag";
import type { Afspraak, Contactpersoon, Klant } from "@/lib/data/types";
import {
  afspraakSchema,
  klantSchema,
  urenregelSchema,
} from "@/lib/validatie/afspraak";

/**
 * Alle schrijfacties lopen via server actions met een zod-schema (CLAUDE.md,
 * "Architectuur"). De browser schrijft nooit rechtstreeks naar de opslag.
 *
 * Automatische urenregels worden hier niet weggeschreven: die zijn volledig af
 * te leiden uit de afspraken, en `lib/uren` doet dat op het moment van tonen.
 * Alleen handmatige uren worden opgeslagen.
 */

export interface ActieResultaat {
  gelukt: boolean;
  melding?: string;
  /** Foutmeldingen per veld, voor het formulier. */
  velden?: Record<string, string>;
  id?: string;
}

function veldfouten(fouten: { path: PropertyKey[]; message: string }[]) {
  const velden: Record<string, string> = {};
  for (const fout of fouten) {
    const veld = String(fout.path[0] ?? "");
    if (veld && !velden[veld]) velden[veld] = fout.message;
  }
  return velden;
}

export async function bewaarAfspraak(invoer: unknown): Promise<ActieResultaat> {
  const gecontroleerd = afspraakSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();

  if (!gegevens.klanten.some((klant) => klant.id === waarden.klantId)) {
    return { gelukt: false, melding: "Deze school bestaat niet." };
  }
  if (
    !gegevens.activiteitsoorten.some(
      (soort) => soort.id === waarden.activiteitsoortId,
    )
  ) {
    return { gelukt: false, melding: "Deze activiteitsoort bestaat niet." };
  }

  const bestaande = waarden.id
    ? gegevens.afspraken.find((afspraak) => afspraak.id === waarden.id)
    : undefined;

  // Een medewerker komt niet aan de afspraken van een ander (SPEC.md 7).
  if (bestaande && bestaande.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze afspraak is niet van jou." };
  }

  const klant = gegevens.klanten.find((k) => k.id === waarden.klantId);
  const reisgegevensBron =
    waarden.reistijdEnkelMinuten === klant?.reistijdEnkelMinuten
      ? "automatisch"
      : "handmatig";

  const afspraak: Afspraak = {
    id: bestaande?.id ?? nieuwId(),
    klantId: waarden.klantId,
    contactpersoonId: waarden.contactpersoonId || null,
    medewerkerId: medewerker.id,
    activiteitsoortId: waarden.activiteitsoortId,
    titel: waarden.titel,
    datum: waarden.datum,
    dagdeel: waarden.dagdeel,
    andersOmschrijving:
      waarden.dagdeel === "anders" ? waarden.andersOmschrijving || null : null,
    starttijd: waarden.starttijd || null,
    eindtijd: waarden.eindtijd || null,
    voorbereidingDatum: waarden.voorbereidingDatum,
    urenOpLocatie: waarden.urenOpLocatie,
    urenVoorbereiding: waarden.urenVoorbereiding,
    reistijdEnkelMinuten: waarden.reistijdEnkelMinuten,
    reisafstandEnkelKm: klant?.reisafstandEnkelKm ?? null,
    reisgegevensBron,
    status: waarden.voltooid ? "voltooid" : (bestaande?.status ?? "gepland"),
    voltooidOp: waarden.voltooid
      ? (bestaande?.voltooidOp ?? new Date().toISOString())
      : null,
    voorbereidingGedaan: waarden.voorbereidingGedaan,
    verzetNaarId: bestaande?.verzetNaarId ?? null,
    afsprakenMetKlant: waarden.afsprakenMetKlant || null,
    notitie: waarden.notitie || null,
  };

  // Een afspraak die eerder was geannuleerd of verzet blijft dat, tenzij het
  // vinkje "voltooid" wordt gezet.
  if (
    bestaande &&
    !waarden.voltooid &&
    (bestaande.status === "geannuleerd" || bestaande.status === "verzet")
  ) {
    afspraak.status = bestaande.status;
  }

  if (bestaande) {
    const positie = gegevens.afspraken.indexOf(bestaande);
    gegevens.afspraken[positie] = afspraak;
  } else {
    gegevens.afspraken.push(afspraak);
  }

  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
  revalidatePath("/klanten");
  revalidatePath("/mijn-uren");
  revalidatePath("/beheer");

  return {
    gelukt: true,
    id: afspraak.id,
    melding: bestaande ? "Afspraak bijgewerkt." : "Afspraak opgeslagen.",
  };
}

export async function wijzigStatus(
  afspraakId: string,
  status: Afspraak["status"],
): Promise<ActieResultaat> {
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze afspraak is niet gevonden." };
  }

  afspraak.status = status;
  afspraak.voltooidOp = status === "voltooid" ? new Date().toISOString() : null;

  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
  revalidatePath("/mijn-uren");

  return { gelukt: true, melding: "Status bijgewerkt." };
}

export async function verwijderAfspraak(
  afspraakId: string,
): Promise<ActieResultaat> {
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze afspraak is niet gevonden." };
  }

  gegevens.afspraken.splice(gegevens.afspraken.indexOf(afspraak), 1);

  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
  revalidatePath("/klanten");
  revalidatePath("/mijn-uren");

  return { gelukt: true, melding: "Afspraak verwijderd." };
}

export async function bewaarKlant(invoer: unknown): Promise<ActieResultaat> {
  const gecontroleerd = klantSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();

  const bestaat = gegevens.klanten.some(
    (klant) =>
      klant.naam.toLowerCase() === waarden.naam.toLowerCase() &&
      klant.plaats.toLowerCase() === waarden.plaats.toLowerCase(),
  );
  if (bestaat) {
    return {
      gelukt: false,
      melding: "Deze school staat al in de lijst.",
      velden: { naam: "Deze school staat al in de lijst." },
    };
  }

  const klant: Klant = {
    id: nieuwId(),
    naam: waarden.naam,
    plaats: waarden.plaats,
    adres: waarden.adres || null,
    postcode: waarden.postcode || null,
    land: "NL",
    reistijdEnkelMinuten: waarden.reistijdEnkelMinuten,
    reisafstandEnkelKm: waarden.reisafstandEnkelKm ?? null,
    telefoonAlgemeen: waarden.telefoonAlgemeen || null,
    emailAlgemeen: waarden.emailAlgemeen || null,
    website: null,
    notitie: null,
    actief: true,
  };
  gegevens.klanten.push(klant);

  if (waarden.contactpersoonNaam) {
    const contactpersoon: Contactpersoon = {
      id: nieuwId(),
      klantId: klant.id,
      naam: waarden.contactpersoonNaam,
      functie: waarden.contactpersoonFunctie || null,
      telefoon: null,
      email: waarden.contactpersoonEmail || null,
      isPrimair: true,
      notitie: null,
    };
    gegevens.contactpersonen.push(contactpersoon);
  }

  // `aangemaakt_door` in de database; hier alleen ter controle dat er een
  // ingelogde medewerker is.
  void medewerker;

  revalidatePath("/afspraken");
  revalidatePath("/klanten");

  return { gelukt: true, id: klant.id, melding: "School toegevoegd." };
}

export async function bewaarUrenregel(
  invoer: unknown,
): Promise<ActieResultaat> {
  const gecontroleerd = urenregelSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();

  gegevens.urenregels.push({
    id: nieuwId(),
    medewerkerId: medewerker.id,
    datum: waarden.datum,
    afspraakId: null,
    categorie: waarden.categorie,
    uren: waarden.uren,
    toelichting: waarden.toelichting || null,
    bron: "handmatig",
  });

  revalidatePath("/mijn-uren");
  revalidatePath("/overzicht");
  revalidatePath("/beheer");

  return { gelukt: true, melding: "Uren geboekt." };
}

export async function verwijderUrenregel(
  urenregelId: string,
): Promise<ActieResultaat> {
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();
  const regel = gegevens.urenregels.find(
    (r) => r.id === urenregelId && r.medewerkerId === medewerker.id,
  );

  if (!regel || regel.bron !== "handmatig") {
    return { gelukt: false, melding: "Deze urenregel is niet gevonden." };
  }

  gegevens.urenregels.splice(gegevens.urenregels.indexOf(regel), 1);

  revalidatePath("/mijn-uren");
  revalidatePath("/beheer");

  return { gelukt: true, melding: "Urenregel verwijderd." };
}
