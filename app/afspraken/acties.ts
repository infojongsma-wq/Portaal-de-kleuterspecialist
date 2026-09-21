"use server";

import { revalidatePath } from "next/cache";
import { parseISO, subDays } from "date-fns";

import { formatteerDatum, naarIsoDatum } from "@/lib/formatteer";
import { werkset } from "@/lib/data/werkset";
import { supabaseServer } from "@/lib/supabase/server";
import type { Activiteitsoort, Klant } from "@/lib/data/types";
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
 * "Architectuur"). De browser schrijft nooit rechtstreeks naar de database.
 *
 * De verbinding gebruikt de sessie van de ingelogde gebruiker, dus Row Level
 * Security bepaalt wat er werkelijk mag. De controles hieronder zijn er voor
 * begrijpelijke meldingen, niet als beveiliging — die zit in Postgres.
 *
 * De uren en de reistijd van een afspraak worden hier bepaald, uit de
 * activiteitsoort en de school. Ze komen niet uit het formulier, want de
 * medewerker ziet die velden niet meer.
 *
 * Automatische urenregels worden niet weggeschreven: die zijn volledig af te
 * leiden uit de afspraken. Alleen handmatige uren worden opgeslagen.
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

/** Databasefouten in gewone taal, zonder technische ruis door te geven. */
function fout(melding: string, oorzaak?: { message: string }): ActieResultaat {
  return {
    gelukt: false,
    melding: oorzaak ? `${melding} (${oorzaak.message})` : melding,
  };
}

/**
 * Uren en reistijd afleiden. De reistijd wordt afgerond op hele stappen, want
 * hij komt altijd automatisch uit de klantgegevens (SPEC.md 5.6).
 */
function afgeleideGegevens(
  soort: Activiteitsoort,
  klant: Klant,
  afrondingMinuten: number,
) {
  return {
    uren_op_locatie: soort.urenOpLocatie,
    uren_voorbereiding: soort.urenVoorbereiding,
    reistijd_enkel_minuten:
      klant.reistijdEnkelMinuten === null
        ? null
        : afrondAutomatischeReistijdMinuten(
            klant.reistijdEnkelMinuten,
            afrondingMinuten,
          ),
    reisafstand_enkel_km: klant.reisafstandEnkelKm,
    reisgegevens_bron: "automatisch" as const,
  };
}

// ---------------------------------------------------------------------------
// Afspraken
// ---------------------------------------------------------------------------

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
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  const klant = gegevens.klanten.find((k) => k.id === waarden.klantId);
  if (!klant) return fout("Deze school bestaat niet.");

  const soort = gegevens.activiteitsoorten.find(
    (s) => s.id === waarden.activiteitsoortId,
  );
  if (!soort) return fout("Dit soort training bestaat niet.");

  const bestaande = waarden.id
    ? gegevens.afspraken.find((afspraak) => afspraak.id === waarden.id)
    : undefined;

  if (bestaande && bestaande.medewerkerId !== gegevens.ik.id) {
    return fout("Deze afspraak is niet van jou.");
  }

  const datum = waarden.datum || null;

  // De voorbereiding wordt op dezelfde dag geboekt als het bezoek. Verzet je
  // een afspraak, dan schuift de voorbereiding mee zolang die niet los stond.
  const voorbereidingDatum =
    bestaande && bestaande.voorbereidingDatum !== bestaande.datum
      ? bestaande.voorbereidingDatum
      : datum;

  const rij = {
    klant_id: waarden.klantId,
    contactpersoon_id: waarden.contactpersoonId || null,
    medewerker_id: gegevens.ik.id,
    activiteitsoort_id: waarden.activiteitsoortId,
    titel: waarden.titel,
    datum,
    dagdelen: waarden.dagdelen,
    anders_omschrijving: waarden.dagdelen.includes("anders")
      ? waarden.andersOmschrijving || null
      : null,
    starttijd: waarden.starttijd || null,
    eindtijd: waarden.eindtijd || null,
    voorbereiding_datum: voorbereidingDatum,
    ...afgeleideGegevens(
      soort,
      klant,
      gegevens.instellingen.reistijdAfrondingMinuten,
    ),
    status: waarden.voltooid
      ? "voltooid"
      : // Een eerder geannuleerde of verzette afspraak blijft dat.
        (bestaande?.status === "geannuleerd" || bestaande?.status === "verzet"
          ? bestaande.status
          : "gepland"),
    voltooid_op: waarden.voltooid
      ? (bestaande?.voltooidOp ?? new Date().toISOString())
      : null,
    // Is de training gedaan, dan is de voorbereiding dat ook. Bij annuleren
    // wordt er apart naar gevraagd (zie `annuleerAfspraak`).
    voorbereiding_gedaan: waarden.voltooid
      ? true
      : (bestaande?.voorbereidingGedaan ?? false),
    afspraken_met_klant: waarden.afsprakenMetKlant || null,
    notitie: waarden.notitie || null,
    gewijzigd_door: gegevens.ik.id,
  };

  if (bestaande) {
    const { error } = await supabase
      .from("afspraken")
      .update(rij)
      .eq("id", bestaande.id);
    if (error) return fout("De afspraak kon niet worden bijgewerkt.", error);
    ververs();
    return { gelukt: true, id: bestaande.id, melding: "Afspraak bijgewerkt." };
  }

  const { data, error } = await supabase
    .from("afspraken")
    .insert(rij)
    .select("id")
    .single();
  if (error) return fout("De afspraak kon niet worden opgeslagen.", error);

  ververs();
  return { gelukt: true, id: data?.id, melding: "Afspraak opgeslagen." };
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
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  const klant = gegevens.klanten.find((k) => k.id === klantId);
  if (!klant) return fout("Deze school bestaat niet.");

  const primair = gegevens.contactpersonen.find(
    (persoon) => persoon.klantId === klantId && persoon.isPrimair,
  );

  const rijen = activiteitsoortIds.flatMap((soortId) => {
    const soort = gegevens.activiteitsoorten.find((s) => s.id === soortId);
    if (!soort || soort.handmatigeUren) return [];

    return [
      {
        klant_id: klantId,
        contactpersoon_id: primair?.id ?? null,
        medewerker_id: gegevens.ik.id,
        activiteitsoort_id: soort.id,
        // De naam van de soort is de werktitel; die is aan te passen zodra de
        // training wordt ingepland.
        titel: soort.naam,
        datum: null,
        dagdelen: ["ochtend"],
        anders_omschrijving: null,
        starttijd: null,
        eindtijd: null,
        voorbereiding_datum: null,
        ...afgeleideGegevens(
          soort,
          klant,
          gegevens.instellingen.reistijdAfrondingMinuten,
        ),
        status: "gepland" as const,
        voltooid_op: null,
        voorbereiding_gedaan: false,
        afspraken_met_klant: null,
        notitie: null,
        gewijzigd_door: gegevens.ik.id,
      },
    ];
  });

  if (rijen.length === 0) return fout("Er is niets toegevoegd.");

  const { error } = await supabase.from("afspraken").insert(rijen);
  if (error) return fout("De trainingen konden niet worden opgeslagen.", error);

  ververs();
  return {
    gelukt: true,
    melding:
      rijen.length === 1
        ? "Training toegevoegd aan de school."
        : `${rijen.length} trainingen toegevoegd aan de school.`,
  };
}

/** Een training uit de lijst van de school een datum geven, of die weghalen. */
export async function planTrainingIn(
  afspraakId: string,
  datum: string | null,
): Promise<ActieResultaat> {
  if (datum !== null && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return fout("Dat is geen geldige datum.");
  }

  const gegevens = await werkset();
  const supabase = await supabaseServer();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== gegevens.ik.id) {
    return fout("Deze training is niet gevonden.");
  }
  if (datum === null && afspraak.status === "voltooid") {
    return fout(
      "Een voltooide training kun je niet terugzetten naar ongepland.",
    );
  }

  const { error } = await supabase
    .from("afspraken")
    .update({
      datum,
      voorbereiding_datum: datum,
      gewijzigd_door: gegevens.ik.id,
    })
    .eq("id", afspraakId);
  if (error) return fout("De datum kon niet worden vastgelegd.", error);

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
  const gegevens = await werkset();
  const supabase = await supabaseServer();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== gegevens.ik.id) {
    return fout("Deze afspraak is niet gevonden.");
  }

  const { error } = await supabase
    .from("afspraken")
    .update({
      status: "geannuleerd",
      voltooid_op: null,
      voorbereiding_gedaan: voorbereidingGedaan,
      gewijzigd_door: gegevens.ik.id,
    })
    .eq("id", afspraakId);
  if (error) return fout("De afspraak kon niet worden geannuleerd.", error);

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
  const gegevens = await werkset();
  const supabase = await supabaseServer();
  const afspraak = gegevens.afspraken.find((a) => a.id === afspraakId);

  if (!afspraak || afspraak.medewerkerId !== gegevens.ik.id) {
    return fout("Deze afspraak is niet gevonden.");
  }

  const { error } = await supabase
    .from("afspraken")
    .delete()
    .eq("id", afspraakId);
  if (error) return fout("De afspraak kon niet worden verwijderd.", error);

  ververs();
  return { gelukt: true, melding: "Afspraak verwijderd." };
}

// ---------------------------------------------------------------------------
// Klanten
// ---------------------------------------------------------------------------

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
  const gegevens = await werkset();
  const supabase = await supabaseServer();

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

  const { data, error } = await supabase
    .from("klanten")
    .insert({
      naam: waarden.naam,
      plaats: waarden.plaats,
      adres: waarden.adres || null,
      postcode: waarden.postcode || null,
      land: "NL",
      reistijd_enkel_minuten: waarden.reistijdEnkelMinuten,
      reisafstand_enkel_km: waarden.reisafstandEnkelKm ?? null,
      telefoon_algemeen: waarden.telefoonAlgemeen || null,
      email_algemeen: waarden.emailAlgemeen || null,
      aangemaakt_door: gegevens.ik.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return fout("De school kon niet worden opgeslagen.", error ?? undefined);
  }

  if (waarden.contactpersoonNaam) {
    const { error: contactFout } = await supabase
      .from("contactpersonen")
      .insert({
        klant_id: data.id,
        naam: waarden.contactpersoonNaam,
        functie: waarden.contactpersoonFunctie || null,
        email: waarden.contactpersoonEmail || null,
        is_primair: true,
      });
    if (contactFout) {
      // De school staat er wel; alleen de contactpersoon niet.
      ververs();
      return {
        gelukt: true,
        id: data.id,
        melding:
          "School toegevoegd, maar de contactpersoon kon niet worden opgeslagen.",
      };
    }
  }

  ververs();
  return { gelukt: true, id: data.id, melding: "School toegevoegd." };
}

// ---------------------------------------------------------------------------
// Handmatige uren
// ---------------------------------------------------------------------------

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
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("urenregels").insert({
    medewerker_id: gegevens.ik.id,
    datum: waarden.datum,
    afspraak_id: null,
    categorie: waarden.categorie,
    uren: waarden.uren,
    toelichting: waarden.toelichting || null,
    bron: "handmatig",
  });
  if (error) return fout("De uren konden niet worden geboekt.", error);

  ververs();
  return { gelukt: true, melding: "Uren geboekt." };
}

export async function verwijderUrenregel(
  urenregelId: string,
): Promise<ActieResultaat> {
  const gegevens = await werkset();
  const supabase = await supabaseServer();
  const regel = gegevens.urenregels.find(
    (r) => r.id === urenregelId && r.medewerkerId === gegevens.ik.id,
  );

  if (!regel || regel.bron !== "handmatig") {
    return fout("Deze urenregel is niet gevonden.");
  }

  const { error } = await supabase
    .from("urenregels")
    .delete()
    .eq("id", urenregelId);
  if (error) return fout("De urenregel kon niet worden verwijderd.", error);

  ververs();
  return { gelukt: true, melding: "Urenregel verwijderd." };
}

// ---------------------------------------------------------------------------
// Beheer: soorten trainingen (SPEC.md 4.5 en 6.6)
// ---------------------------------------------------------------------------

/**
 * Wijzigt bestaande afspraken niet met terugwerkende kracht: de uren zijn bij
 * het opslaan overgenomen in de afspraak zelf, zoals SPEC.md 4.6 voorschrijft.
 * Een nieuwe soort of gewijzigde uren gelden dus vanaf nu.
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
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  if (gegevens.ik.rol !== "beheerder") {
    return fout("Alleen de beheerder kan soorten trainingen wijzigen.");
  }

  const naamInGebruik = gegevens.activiteitsoorten.some(
    (soort) =>
      soort.id !== waarden.id &&
      soort.naam.toLowerCase() === waarden.naam.toLowerCase(),
  );
  if (naamInGebruik) {
    return {
      gelukt: false,
      melding: "Er bestaat al een soort met deze naam.",
      velden: { naam: "Er bestaat al een soort met deze naam." },
    };
  }

  const rij = {
    naam: waarden.naam,
    uren_op_locatie: waarden.urenOpLocatie,
    uren_voorbereiding: waarden.urenVoorbereiding,
    kleur: waarden.kleur,
    volgorde: waarden.volgorde,
    actief: waarden.actief,
  };

  if (waarden.id) {
    const { error } = await supabase
      .from("activiteitsoorten")
      .update(rij)
      .eq("id", waarden.id);
    if (error) return fout("De soort kon niet worden bijgewerkt.", error);
    ververs();
    return { gelukt: true, id: waarden.id, melding: "Soort bijgewerkt." };
  }

  const { data, error } = await supabase
    .from("activiteitsoorten")
    // Soorten die het beheer hier aanmaakt hebben altijd vaste uren; de
    // medewerker vult namelijk geen uren meer in.
    .insert({ ...rij, handmatige_uren: false })
    .select("id")
    .single();
  if (error) return fout("De soort kon niet worden opgeslagen.", error);

  ververs();
  return { gelukt: true, id: data?.id, melding: "Soort toegevoegd." };
}

/**
 * Verwijderen kan alleen als er nog geen afspraak aan hangt. Anders zou de
 * herkomst van de uren verdwijnen; dan is op non-actief zetten de weg.
 */
export async function verwijderActiviteitsoort(
  soortId: string,
): Promise<ActieResultaat> {
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  if (gegevens.ik.rol !== "beheerder") {
    return fout("Alleen de beheerder kan soorten trainingen verwijderen.");
  }

  const soort = gegevens.activiteitsoorten.find((s) => s.id === soortId);
  if (!soort) return fout("Dit soort training is niet gevonden.");

  const inGebruik = gegevens.afspraken.filter(
    (afspraak) => afspraak.activiteitsoortId === soortId,
  ).length;

  if (inGebruik > 0) {
    return fout(
      `Er ${inGebruik === 1 ? "hangt 1 afspraak" : `hangen ${inGebruik} afspraken`} aan dit soort. Zet het op non-actief in plaats van verwijderen.`,
    );
  }

  const { error } = await supabase
    .from("activiteitsoorten")
    .delete()
    .eq("id", soortId);
  if (error) return fout("De soort kon niet worden verwijderd.", error);

  ververs();
  return { gelukt: true, melding: "Soort verwijderd." };
}

// ---------------------------------------------------------------------------
// Beheer: contract van een medewerker (SPEC.md 4.2 en 6.6)
// ---------------------------------------------------------------------------

/**
 * Legt de contracturen per week vast. De jaarnorm wordt altijd berekend als
 * `norm_fulltime × werktijdfactor` en nooit los ingevoerd (SPEC.md 4.2).
 *
 * Bij een urenwijziging hoort een nieuw contract met een nieuwe ingangsdatum;
 * het lopende contract krijgt dan een einddatum.
 */
export async function bewaarContract(
  profielId: string,
  urenPerWeek: number,
  ingangsdatum: string,
  /**
   * De jaarurennorm bij een voltijds dienstverband. Laat je dit weg, dan houdt
   * het contract de norm die er al staat — en bij een nieuw contract de
   * standaard uit de database. Het getal hoort daar thuis en niet in de code
   * (CLAUDE.md, "Rekenregels — nooit hardcoderen").
   */
  normFulltime?: number | null,
): Promise<ActieResultaat> {
  const gegevens = await werkset();
  const supabase = await supabaseServer();

  if (gegevens.ik.rol !== "beheerder") {
    return fout("Alleen de beheerder kan contracten vastleggen.");
  }
  if (!Number.isFinite(urenPerWeek) || urenPerWeek <= 0 || urenPerWeek > 40) {
    return fout("Vul een aantal uren per week tussen 0 en 40 in.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ingangsdatum)) {
    return fout("Vul een geldige ingangsdatum in.");
  }
  if (
    normFulltime != null &&
    (!Number.isFinite(normFulltime) || normFulltime < 500 || normFulltime > 2500)
  ) {
    return fout(
      "Vul een jaarurennorm tussen 500 en 2500 uur in, of laat het veld leeg.",
    );
  }

  // Alleen meesturen als er een waarde is ingevuld; anders blijft staan wat er
  // al stond.
  const normVeld = normFulltime != null ? { norm_fulltime: normFulltime } : {};

  const lopend = gegevens.contracten
    .filter((contract) => contract.profielId === profielId)
    .filter((contract) => !contract.einddatum)
    .sort((a, b) => b.ingangsdatum.localeCompare(a.ingangsdatum))[0];

  if (lopend) {
    if (lopend.ingangsdatum === ingangsdatum) {
      const { error } = await supabase
        .from("contracten")
        .update({ uren_per_week: urenPerWeek, ...normVeld })
        .eq("id", lopend.id);
      if (error) return fout("Het contract kon niet worden bijgewerkt.", error);
      ververs();
      return { gelukt: true, melding: "Contract bijgewerkt." };
    }

    // Een datum vóór het lopende contract is geen nieuwe afspraak maar een
    // verbetering: de vorige invoer stond op de verkeerde dag. Er een tweede
    // contract naast zetten zou betekenen dat het lopende contract eindigt
    // vóórdat het begint — precies wat de database weigert.
    if (ingangsdatum < lopend.ingangsdatum) {
      const inDeWeg = gegevens.contracten
        .filter((contract) => contract.profielId === profielId)
        .filter((contract) => contract.id !== lopend.id)
        .find(
          (contract) =>
            (contract.einddatum ?? contract.ingangsdatum) >= ingangsdatum,
        );

      if (inDeWeg) {
        return fout(
          `Er staat al een contract dat op ${formatteerDatum(inDeWeg.ingangsdatum)} ingaat of nog loopt. Kies een ingangsdatum daarna, of pas eerst dat contract aan.`,
        );
      }

      const { error } = await supabase
        .from("contracten")
        .update({
          ingangsdatum,
          uren_per_week: urenPerWeek,
          ...normVeld,
          gewijzigd_op: new Date().toISOString(),
        })
        .eq("id", lopend.id);

      if (error) return fout("Het contract kon niet worden bijgewerkt.", error);
      ververs();
      return {
        gelukt: true,
        melding: `Contract aangepast: gaat nu in op ${formatteerDatum(ingangsdatum)}.`,
      };
    }

    // Het vorige contract loopt tot de dag vóór de nieuwe ingangsdatum.
    const dagErvoor = naarIsoDatum(subDays(parseISO(ingangsdatum), 1));
    const { error } = await supabase
      .from("contracten")
      .update({ einddatum: dagErvoor })
      .eq("id", lopend.id);
    if (error) {
      return fout("Het vorige contract kon niet worden afgesloten.", error);
    }
  }

  const { error } = await supabase.from("contracten").insert({
    profiel_id: profielId,
    ingangsdatum,
    uren_per_week: urenPerWeek,
    // Zonder ingevulde norm neemt het nieuwe contract de norm over van het
    // contract dat eraan voorafging, zodat een urenwijziging de jaarnorm niet
    // ongemerkt terugzet.
    ...(normVeld.norm_fulltime != null
      ? normVeld
      : lopend
        ? { norm_fulltime: lopend.normFulltime }
        : {}),
  });
  if (error) return fout("Het contract kon niet worden opgeslagen.", error);

  ververs();
  return { gelukt: true, melding: "Contract vastgelegd." };
}
