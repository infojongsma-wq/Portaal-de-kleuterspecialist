import { cache } from "react";

import { supabaseServer } from "@/lib/supabase/server";
import type {
  Activiteitsoort,
  Afspraak,
  Contactpersoon,
  Contract,
  Dagdeel,
  Instellingen,
  Klant,
  NietInzetbareDag,
  Profiel,
  Urenregel,
} from "./types";

/**
 * Alles wat de ingelogde gebruiker mag zien, in één keer opgehaald.
 *
 * Row Level Security in Postgres bepaalt wát er terugkomt: een medewerker
 * krijgt alleen de eigen afspraken en uren, een beheerder alles. De app hoeft
 * daar zelf niets meer aan te filteren.
 *
 * Het gaat om één medewerker met hooguit een paar honderd afspraken per jaar.
 * In één keer alles ophalen en in het geheugen doorrekenen is daarmee sneller
 * en eenvoudiger dan per scherm losse query's stellen — en het houdt de
 * rekenfuncties in `lib/uren/` zuiver: die zien alleen gewone objecten.
 *
 * `cache` zorgt dat dit per aanvraag één keer gebeurt, hoe vaak een scherm het
 * ook opvraagt.
 */

export interface Werkset {
  /** Het profiel van de ingelogde gebruiker. */
  ik: Profiel;
  profielen: Profiel[];
  contracten: Contract[];
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  activiteitsoorten: Activiteitsoort[];
  afspraken: Afspraak[];
  urenregels: Urenregel[];
  nietInzetbareDagen: NietInzetbareDag[];
  instellingen: Instellingen;
}

/**
 * Postgres levert `numeric` als tekst aan, niet als getal — anders zou de
 * precisie onderweg verloren gaan. Zonder deze omzetting wordt "3.50" + "1.00"
 * de tekst "3.501.00" in plaats van 4,5.
 */
function getal(waarde: unknown): number {
  if (waarde === null || waarde === undefined) return 0;
  return typeof waarde === "number" ? waarde : Number(waarde);
}

function getalOfNull(waarde: unknown): number | null {
  if (waarde === null || waarde === undefined || waarde === "") return null;
  return typeof waarde === "number" ? waarde : Number(waarde);
}

type Rij = Record<string, unknown>;

function naarProfiel(rij: Rij): Profiel {
  return {
    id: rij.id as string,
    voornaam: rij.voornaam as string,
    achternaam: rij.achternaam as string,
    email: rij.email as string,
    telefoon: (rij.telefoon as string) ?? null,
    rol: rij.rol as Profiel["rol"],
    standplaatsAdres: (rij.standplaats_adres as string) ?? null,
    standplaatsPostcode: (rij.standplaats_postcode as string) ?? null,
    standplaatsPlaats: (rij.standplaats_plaats as string) ?? null,
    inDienstVanaf: (rij.in_dienst_vanaf as string) ?? null,
    uitDienstPer: (rij.uit_dienst_per as string) ?? null,
    actief: Boolean(rij.actief),
    heeftAccount: rij.auth_gebruiker_id != null,
  };
}

function naarContract(rij: Rij): Contract {
  return {
    id: rij.id as string,
    profielId: rij.profiel_id as string,
    ingangsdatum: rij.ingangsdatum as string,
    einddatum: (rij.einddatum as string) ?? null,
    urenPerWeek: getal(rij.uren_per_week),
    normFulltime: getal(rij.norm_fulltime),
  };
}

function naarKlant(rij: Rij): Klant {
  return {
    id: rij.id as string,
    naam: rij.naam as string,
    plaats: rij.plaats as string,
    adres: (rij.adres as string) ?? null,
    postcode: (rij.postcode as string) ?? null,
    land: (rij.land as string) ?? "NL",
    reistijdEnkelMinuten: getalOfNull(rij.reistijd_enkel_minuten),
    reisafstandEnkelKm: getalOfNull(rij.reisafstand_enkel_km),
    telefoonAlgemeen: (rij.telefoon_algemeen as string) ?? null,
    emailAlgemeen: (rij.email_algemeen as string) ?? null,
    website: (rij.website as string) ?? null,
    notitie: (rij.notitie as string) ?? null,
    actief: Boolean(rij.actief),
  };
}

function naarContactpersoon(rij: Rij): Contactpersoon {
  return {
    id: rij.id as string,
    klantId: rij.klant_id as string,
    naam: rij.naam as string,
    functie: (rij.functie as string) ?? null,
    telefoon: (rij.telefoon as string) ?? null,
    email: (rij.email as string) ?? null,
    isPrimair: Boolean(rij.is_primair),
    notitie: (rij.notitie as string) ?? null,
  };
}

function naarActiviteitsoort(rij: Rij): Activiteitsoort {
  return {
    id: rij.id as string,
    naam: rij.naam as string,
    urenOpLocatie: getal(rij.uren_op_locatie),
    urenVoorbereiding: getal(rij.uren_voorbereiding),
    kleur: rij.kleur as string,
    volgorde: getal(rij.volgorde),
    handmatigeUren: Boolean(rij.handmatige_uren),
    actief: Boolean(rij.actief),
  };
}

function naarAfspraak(rij: Rij): Afspraak {
  return {
    id: rij.id as string,
    klantId: rij.klant_id as string,
    contactpersoonId: (rij.contactpersoon_id as string) ?? null,
    medewerkerId: rij.medewerker_id as string,
    activiteitsoortId: rij.activiteitsoort_id as string,
    titel: rij.titel as string,
    datum: (rij.datum as string) ?? null,
    dagdelen: ((rij.dagdelen as Dagdeel[]) ?? []) as Dagdeel[],
    andersOmschrijving: (rij.anders_omschrijving as string) ?? null,
    starttijd: (rij.starttijd as string) ?? null,
    eindtijd: (rij.eindtijd as string) ?? null,
    voorbereidingDatum: (rij.voorbereiding_datum as string) ?? null,
    urenOpLocatie: getal(rij.uren_op_locatie),
    urenVoorbereiding: getal(rij.uren_voorbereiding),
    reistijdEnkelMinuten: getalOfNull(rij.reistijd_enkel_minuten),
    reisafstandEnkelKm: getalOfNull(rij.reisafstand_enkel_km),
    reisgegevensBron: (rij.reisgegevens_bron as Afspraak["reisgegevensBron"]) ?? null,
    status: rij.status as Afspraak["status"],
    voltooidOp: (rij.voltooid_op as string) ?? null,
    voorbereidingGedaan: Boolean(rij.voorbereiding_gedaan),
    verzetNaarId: (rij.verzet_naar_id as string) ?? null,
    afsprakenMetKlant: (rij.afspraken_met_klant as string) ?? null,
    notitie: (rij.notitie as string) ?? null,
  };
}

function naarUrenregel(rij: Rij): Urenregel {
  return {
    id: rij.id as string,
    medewerkerId: rij.medewerker_id as string,
    datum: rij.datum as string,
    afspraakId: (rij.afspraak_id as string) ?? null,
    categorie: rij.categorie as Urenregel["categorie"],
    uren: getal(rij.uren),
    toelichting: (rij.toelichting as string) ?? null,
    bron: rij.bron as Urenregel["bron"],
  };
}

function naarNietInzetbareDag(rij: Rij): NietInzetbareDag {
  return {
    id: rij.id as string,
    datum: rij.datum as string,
    soort: rij.soort as NietInzetbareDag["soort"],
    omschrijving: rij.omschrijving as string,
    regio: rij.regio as string,
  };
}

function naarInstellingen(rij: Rij | null): Instellingen {
  return {
    eigenReistijdUrenPerDag: rij ? getal(rij.eigen_reistijd_uren_per_dag) : 2.0,
    kilometervergoedingPerKm: rij
      ? getalOfNull(rij.kilometervergoeding_per_km)
      : null,
    reistijdAfrondingMinuten: rij ? getal(rij.reistijd_afronding_minuten) : 5,
    maxUrenPerDagWaarschuwing: rij
      ? getal(rij.max_uren_per_dag_waarschuwing)
      : 12.0,
  };
}

/** Fout die de schermen kunnen herkennen en in gewone taal kunnen tonen. */
export class GeenProfielFout extends Error {
  constructor(email: string | null) {
    super(
      `Er hoort een profiel bij dit account, maar dat is niet gevonden${
        email ? ` (${email})` : ""
      }. Maak het aan in de tabel profielen, of laat de beheerder je opnieuw uitnodigen.`,
    );
    this.name = "GeenProfielFout";
  }
}

export const werkset = cache(async (): Promise<Werkset> => {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Niet ingelogd.");
  }

  const [
    profielen,
    contracten,
    klanten,
    contactpersonen,
    activiteitsoorten,
    afspraken,
    urenregels,
    nietInzetbareDagen,
    instellingen,
  ] = await Promise.all([
    supabase.from("profielen").select("*"),
    supabase.from("contracten").select("*"),
    supabase.from("klanten").select("*"),
    supabase.from("contactpersonen").select("*"),
    supabase.from("activiteitsoorten").select("*"),
    supabase.from("afspraken").select("*"),
    supabase.from("urenregels").select("*"),
    supabase.from("niet_inzetbare_dagen").select("*"),
    supabase.from("instellingen").select("*").maybeSingle(),
  ]);

  const eersteFout = [
    profielen.error,
    contracten.error,
    klanten.error,
    contactpersonen.error,
    activiteitsoorten.error,
    afspraken.error,
    urenregels.error,
    nietInzetbareDagen.error,
    instellingen.error,
  ].find(Boolean);

  if (eersteFout) {
    throw new Error(
      `De gegevens konden niet worden opgehaald: ${eersteFout.message}. ` +
        "Staat het databaseschema er wel in? Zie PUBLICEREN.md stap 2.",
    );
  }

  const alleProfielen = (profielen.data ?? []).map(naarProfiel);
  const mijnRij = (profielen.data ?? []).find(
    (rij) => (rij as Rij).auth_gebruiker_id === user.id,
  );

  if (!mijnRij) throw new GeenProfielFout(user.email ?? null);

  return {
    ik: naarProfiel(mijnRij as Rij),
    profielen: alleProfielen,
    contracten: (contracten.data ?? []).map(naarContract),
    klanten: (klanten.data ?? []).map(naarKlant),
    contactpersonen: (contactpersonen.data ?? []).map(naarContactpersoon),
    activiteitsoorten: (activiteitsoorten.data ?? []).map(naarActiviteitsoort),
    afspraken: (afspraken.data ?? []).map(naarAfspraak),
    urenregels: (urenregels.data ?? []).map(naarUrenregel),
    nietInzetbareDagen: (nietInzetbareDagen.data ?? []).map(naarNietInzetbareDag),
    instellingen: naarInstellingen((instellingen.data as Rij) ?? null),
  };
});
