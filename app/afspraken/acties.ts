"use server";

import { revalidatePath } from "next/cache";
import { huidigeMedewerker } from "@/lib/data/queries";
import { nieuwId, opslag } from "@/lib/data/opslag";
import type {
  Activiteitsoort,
  Afspraak,
  Contactpersoon,
  Klant,
} from "@/lib/data/types";
import { afrondAutomatischeReistijdMinuten } from "@/lib/uren";
import {
  activiteitsoortSchema,
  afgesprokenTrainingenSchema,
  afspraakSchema,
  klantSchema,
  urenregelSchema,
} from "@/lib/validatie/afspraak";

/**
 * Alle schrijfacties lopen via server actions met een zod-schema (CLAUDE.md,
 * "Architectuur"). De browser schrijft nooit rechtstreeks naar de opslag.
 *
 * De uren en de reistijd van een afspraak worden **hier** bepaald, uit de
 * activiteitsoort en de school. Ze komen niet uit het formulier, want de
 * medewerker ziet die velden niet meer.
 *
 * Automatische urenregels worden niet weggeschreven: die zijn volledig af te
 * leiden uit de afspraken, en `lib/uren` doet dat op het moment van tonen.
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

function ververs() {
  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
  revalidatePath("/klanten");
  revalidatePath("/mijn-uren");
  revalidatePath("/beheer");
}

/**
 * Uren en reistijd afleiden. De reistijd wordt afgerond op hele stappen, want
 * hij komt nu altijd automatisch uit de klantgegevens (SPEC.md 5.6).
 */
function afgeleideGegevens(soort: Activiteitsoort, klant: Klant) {
  const { reistijdAfrondingMinuten } = opslag().instellingen;
  return {
    urenOpLocatie: soort.urenOpLocatie,
    urenVoorbereiding: soort.urenVoorbereiding,
    reistijdEnkelMinuten:
      klant.reistijdEnkelMinuten === null
        ? null
        : afrondAutomatischeReistijdMinuten(
            klant.reistijdEnkelMinuten,
            reistijdAfrondingMinuten,
          ),
    reisafstandEnkelKm: klant.reisafstandEnkelKm,
    reisgegevensBron: "automatisch" as const,
  };
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

  const klant = gegevens.klanten.find((k) => k.id === waarden.klantId);
  if (!klant) return { gelukt: false, melding: "Deze school bestaat niet." };

  const soort = gegevens.activiteitsoorten.find(
    (s) => s.id === waarden.activiteitsoortId,
  );
  if (!soort) {
    return { gelukt: false, melding: "Dit soort training bestaat niet." };
  }

  const bestaande = waarden.id
    ? gegevens.afspraken.find((afspraak) => afspraak.id === waarden.id)
    : undefined;

  // Een medewerker komt niet aan de afspraken van een ander (SPEC.md 7).
  if (bestaande && bestaande.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze afspraak is niet van jou." };
  }

  const datum = waarden.datum || null;

  const afspraak: Afspraak = {
    id: bestaande?.id ?? nieuwId(),
    klantId: waarden.klantId,
    contactpersoonId: waarden.contactpersoonId || null,
    medewerkerId: medewerker.id,
    activiteitsoortId: waarden.activiteitsoortId,
    titel: waarden.titel,
    datum,
    dagdelen: waarden.dagdelen,
    andersOmschrijving: waarden.dagdelen.includes("anders")
      ? waarden.andersOmschrijving || null
      : null,
    starttijd: waarden.starttijd || null,
    eindtijd: waarden.eindtijd || null,
    // De voorbereiding wordt op dezelfde dag geboekt als het bezoek. Het
    // datumveld daarvoor is uit het formulier gehaald; de kolom blijft bestaan
    // zodat het beheer hem later alsnog kan verzetten (SPEC.md 5.1).
    voorbereidingDatum: bestaande?.voorbereidingDatum ?? datum,
    ...afgeleideGegevens(soort, klant),
    status: waarden.voltooid ? "voltooid" : (bestaande?.status ?? "gepland"),
    voltooidOp: waarden.voltooid
      ? (bestaande?.voltooidOp ?? new Date().toISOString())
      : null,
    // Is de training gedaan, dan is de voorbereiding dat ook. Bij annuleren
    // wordt er apart naar gevraagd (zie `annuleerAfspraak`).
    voorbereidingGedaan: waarden.voltooid
      ? true
      : (bestaande?.voorbereidingGedaan ?? false),
    verzetNaarId: bestaande?.verzetNaarId ?? null,
    afsprakenMetKlant: waarden.afsprakenMetKlant || null,
    notitie: waarden.notitie || null,
  };

  // Verzet de afspraak van datum, dan verschuift de voorbereiding mee zolang
  // die niet los is gezet.
  if (bestaande && bestaande.voorbereidingDatum === bestaande.datum) {
    afspraak.voorbereidingDatum = datum;
  }

  // Een eerder geannuleerde of verzette afspraak blijft dat, tenzij het vinkje
  // "voltooid" wordt gezet.
  if (
    bestaande &&
    !waarden.voltooid &&
    (bestaande.status === "geannuleerd" || bestaande.status === "verzet")
  ) {
    afspraak.status = bestaande.status;
  }

  if (bestaande) {
    gegevens.afspraken[gegevens.afspraken.indexOf(bestaande)] = afspraak;
  } else {
    gegevens.afspraken.push(afspraak);
  }

  ververs();

  return {
    gelukt: true,
    id: afspraak.id,
    melding: bestaande ? "Afspraak bijgewerkt." : "Afspraak opgeslagen.",
  };
}

/**
 * Trainingen in één keer aan een school hangen, zonder datum. Ze komen als
 * "nog in te plannen" in de lijst van de school te staan.
 */
export async function voegAfgesprokenTrainingenToe(
  invoer: unknown,
): Promise<ActieResultaat> {
  const gecontroleerd = afgesprokenTrainingenSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Kies minstens één soort training.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const { klantId, activiteitsoortIds } = gecontroleerd.data;
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();

  const klant = gegevens.klanten.find((k) => k.id === klantId);
  if (!klant) return { gelukt: false, melding: "Deze school bestaat niet." };

  const primair = gegevens.contactpersonen.find(
    (persoon) => persoon.klantId === klantId && persoon.isPrimair,
  );

  let toegevoegd = 0;
  for (const soortId of activiteitsoortIds) {
    const soort = gegevens.activiteitsoorten.find((s) => s.id === soortId);
    if (!soort || soort.handmatigeUren) continue;

    gegevens.afspraken.push({
      id: nieuwId(),
      klantId,
      contactpersoonId: primair?.id ?? null,
      medewerkerId: medewerker.id,
      activiteitsoortId: soort.id,
      // De naam van de soort is de werktitel; die is in het formulier aan te
      // passen zodra de training wordt ingepland.
      titel: soort.naam,
      datum: null,
      dagdelen: ["ochtend"],
      andersOmschrijving: null,
      starttijd: null,
      eindtijd: null,
      voorbereidingDatum: null,
      ...afgeleideGegevens(soort, klant),
      status: "gepland",
      voltooidOp: null,
      voorbereidingGedaan: false,
      verzetNaarId: null,
      afsprakenMetKlant: null,
      notitie: null,
    });
    toegevoegd += 1;
  }

  if (toegevoegd === 0) {
    return { gelukt: false, melding: "Er is niets toegevoegd." };
  }

  ververs();
  return {
    gelukt: true,
    melding:
      toegevoegd === 1
        ? "Training toegevoegd aan de school."
        : `${toegevoegd} trainingen toegevoegd aan de school.`,
  };
}

/** Een training uit de lijst van de school een datum geven, of die weghalen. */
export async function planTrainingIn(
  afspraakId: string,
  datum: string | null,
): Promise<ActieResultaat> {
  if (datum !== null && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { gelukt: false, melding: "Dat is geen geldige datum." };
  }

  const gegevens = opslag();
  const medewerker = huidigeMedewerker();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze training is niet gevonden." };
  }
  if (datum === null && afspraak.status === "voltooid") {
    return {
      gelukt: false,
      melding: "Een voltooide training kun je niet terugzetten naar ongepland.",
    };
  }

  afspraak.datum = datum;
  afspraak.voorbereidingDatum = datum;

  ververs();
  return {
    gelukt: true,
    melding: datum ? "Datum vastgelegd." : "Terug naar nog in te plannen.",
  };
}

/**
 * Een afspraak annuleren. Er wordt gevraagd of de voorbereiding al was gedaan,
 * want die uren tellen dan wél mee (SPEC.md 5.5). Zonder die vraag zou gedaan
 * werk stilzwijgend uit de urenverantwoording vallen.
 */
export async function annuleerAfspraak(
  afspraakId: string,
  voorbereidingGedaan: boolean,
): Promise<ActieResultaat> {
  const gegevens = opslag();
  const medewerker = huidigeMedewerker();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== medewerker.id) {
    return { gelukt: false, melding: "Deze afspraak is niet gevonden." };
  }

  afspraak.status = "geannuleerd";
  afspraak.voltooidOp = null;
  afspraak.voorbereidingGedaan = voorbereidingGedaan;

  ververs();
  return {
    gelukt: true,
    melding: voorbereidingGedaan
      ? "Afspraak geannuleerd. De voorbereidingsuren blijven meetellen."
      : "Afspraak geannuleerd.",
  };
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

  ververs();
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

  ververs();
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

  ververs();
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

  ververs();
  return { gelukt: true, melding: "Urenregel verwijderd." };
}

// ---------------------------------------------------------------------------
// Beheer: soorten trainingen (SPEC.md 4.5 en 6.6)
// ---------------------------------------------------------------------------

/**
 * Wijzigt een bestaande afspraak niet met terugwerkende kracht: de uren zijn
 * bij het opslaan overgenomen in de afspraak zelf, zoals SPEC.md 4.6
 * voorschrijft. Een nieuwe soort of gewijzigde uren gelden dus vanaf nu.
 */
export async function bewaarActiviteitsoort(
  invoer: unknown,
): Promise<ActieResultaat> {
  const gecontroleerd = activiteitsoortSchema.safeParse(invoer);
  if (!gecontroleerd.success) {
    return {
      gelukt: false,
      melding: "Niet alle velden zijn goed ingevuld.",
      velden: veldfouten(gecontroleerd.error.issues),
    };
  }

  const waarden = gecontroleerd.data;
  const gegevens = opslag();

  const bestaande = waarden.id
    ? gegevens.activiteitsoorten.find((soort) => soort.id === waarden.id)
    : undefined;

  const naamInGebruik = gegevens.activiteitsoorten.some(
    (soort) =>
      soort.id !== bestaande?.id &&
      soort.naam.toLowerCase() === waarden.naam.toLowerCase(),
  );
  if (naamInGebruik) {
    return {
      gelukt: false,
      melding: "Er bestaat al een soort met deze naam.",
      velden: { naam: "Er bestaat al een soort met deze naam." },
    };
  }

  const soort: Activiteitsoort = {
    id: bestaande?.id ?? nieuwId(),
    naam: waarden.naam,
    urenOpLocatie: waarden.urenOpLocatie,
    urenVoorbereiding: waarden.urenVoorbereiding,
    kleur: waarden.kleur,
    volgorde: waarden.volgorde,
    // Soorten die het beheer hier aanmaakt hebben altijd vaste uren; de
    // medewerker vult namelijk geen uren meer in.
    handmatigeUren: bestaande?.handmatigeUren ?? false,
    actief: waarden.actief,
  };

  if (bestaande) {
    gegevens.activiteitsoorten[gegevens.activiteitsoorten.indexOf(bestaande)] =
      soort;
  } else {
    gegevens.activiteitsoorten.push(soort);
  }

  ververs();
  return {
    gelukt: true,
    id: soort.id,
    melding: bestaande ? "Soort bijgewerkt." : "Soort toegevoegd.",
  };
}

/**
 * Verwijderen kan alleen als er nog geen afspraak aan hangt. Anders zou de
 * herkomst van de uren verdwijnen; dan is op non-actief zetten de weg.
 */
export async function verwijderActiviteitsoort(
  soortId: string,
): Promise<ActieResultaat> {
  const gegevens = opslag();
  const soort = gegevens.activiteitsoorten.find((s) => s.id === soortId);
  if (!soort) {
    return { gelukt: false, melding: "Dit soort training is niet gevonden." };
  }

  const inGebruik = gegevens.afspraken.filter(
    (afspraak) => afspraak.activiteitsoortId === soortId,
  ).length;

  if (inGebruik > 0) {
    return {
      gelukt: false,
      melding: `Er ${inGebruik === 1 ? "hangt 1 afspraak" : `hangen ${inGebruik} afspraken`} aan dit soort. Zet het op non-actief in plaats van verwijderen.`,
    };
  }

  gegevens.activiteitsoorten.splice(
    gegevens.activiteitsoorten.indexOf(soort),
    1,
  );

  ververs();
  return { gelukt: true, melding: "Soort verwijderd." };
}
