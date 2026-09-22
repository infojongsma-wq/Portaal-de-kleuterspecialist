import {
  berekenDagen,
  berekenJaarnorm,
  declarabeleReistijdUren,
  teltLocatieUren,
  teltReistijd,
  teltVoorbereidingUren,
  totaalUren,
  type AfspraakInvoer,
  type JaarnormUitkomst,
  type Telwijze,
  type UrenCategorie,
  type UrenregelInvoer,
} from "@/lib/uren";
import { werkset, type Werkset } from "./werkset";
import type {
  Activiteitsoort,
  AfgeleideUrenregel,
  Afspraak,
  AfspraakMetContext,
  Contactpersoon,
  Contract,
  Instellingen,
  Klant,
  NietInzetbareDag,
  Profiel,
  Urenregel,
} from "./types";

/**
 * Leesfuncties voor de schermen. Draaien op de server.
 *
 * Elke functie haalt de werkset op — alles wat de ingelogde gebruiker mag zien,
 * in één keer uit Supabase — en rekent daar verder in het geheugen mee. Wát er
 * in die werkset zit bepaalt Row Level Security in Postgres; de functies
 * hieronder filteren dus op bruikbaarheid, niet op bevoegdheid.
 *
 * De werkset is per aanvraag gecachet, dus meerdere aanroepen kosten niet
 * meerdere databasebezoeken.
 *
 * Bovenaan staan zuivere hulpfuncties die op een meegegeven werkset werken.
 * Die zijn bewust synchroon: ze dienen als sorteer- en omzetfuncties, en daar
 * kun je niet op wachten.
 */

// ---------------------------------------------------------------------------
// Zuivere hulpfuncties
// ---------------------------------------------------------------------------

/** Sorteert op datum; afspraken zonder datum komen achteraan. */
export function opDatum(
  a: { datum: string | null },
  b: { datum: string | null },
): number {
  if (a.datum === b.datum) return 0;
  if (!a.datum) return 1;
  if (!b.datum) return -1;
  return a.datum.localeCompare(b.datum);
}

/** Valt een datum binnen een periode? Een lege datum nooit. */
function binnenPeriode(
  datum: string | null,
  vanaf: string,
  totEnMet: string,
): boolean {
  return datum !== null && datum >= vanaf && datum <= totEnMet;
}

export function naarAfspraakInvoer(afspraak: Afspraak): AfspraakInvoer {
  return {
    id: afspraak.id,
    datum: afspraak.datum,
    voorbereidingDatum: afspraak.voorbereidingDatum,
    urenOpLocatie: afspraak.urenOpLocatie,
    urenVoorbereiding: afspraak.urenVoorbereiding,
    reistijdEnkelMinuten: afspraak.reistijdEnkelMinuten,
    status: afspraak.status,
    voorbereidingGedaan: afspraak.voorbereidingGedaan,
  };
}

export function naarUrenregelInvoer(regel: Urenregel): UrenregelInvoer {
  return {
    datum: regel.datum,
    categorie: regel.categorie,
    uren: regel.uren,
  };
}

function afsprakenVan(gegevens: Werkset, medewerkerId: string): Afspraak[] {
  return gegevens.afspraken
    .filter((afspraak) => afspraak.medewerkerId === medewerkerId)
    .sort(opDatum);
}

function handmatigeRegelsVan(
  gegevens: Werkset,
  medewerkerId: string,
): Urenregel[] {
  return gegevens.urenregels
    .filter((regel) => regel.medewerkerId === medewerkerId)
    .filter((regel) => regel.bron === "handmatig")
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

function contractOp(
  gegevens: Werkset,
  medewerkerId: string,
  datum: string,
): Contract | null {
  const passend = gegevens.contracten
    .filter((contract) => contract.profielId === medewerkerId)
    .filter((contract) => contract.ingangsdatum <= datum)
    .filter((contract) => !contract.einddatum || contract.einddatum >= datum)
    .sort((a, b) => b.ingangsdatum.localeCompare(a.ingangsdatum));
  return passend[0] ?? null;
}

function metContext(
  gegevens: Werkset,
  afspraken: Afspraak[],
): AfspraakMetContext[] {
  return afspraken.flatMap((afspraak) => {
    const klant = gegevens.klanten.find((k) => k.id === afspraak.klantId);
    const activiteitsoort = gegevens.activiteitsoorten.find(
      (s) => s.id === afspraak.activiteitsoortId,
    );
    if (!klant || !activiteitsoort) return [];

    return [
      {
        ...afspraak,
        klant,
        activiteitsoort,
        contactpersoon:
          gegevens.contactpersonen.find(
            (p) => p.id === afspraak.contactpersoonId,
          ) ?? null,
      },
    ];
  });
}

function urenVanAfspraakMet(
  instellingen: Instellingen,
  afspraak: Afspraak,
  telwijze: Telwijze,
) {
  const opLocatie = teltLocatieUren(afspraak.status, telwijze)
    ? afspraak.urenOpLocatie
    : 0;
  const voorbereiding = teltVoorbereidingUren(
    afspraak.status,
    afspraak.voorbereidingGedaan,
    telwijze,
  )
    ? afspraak.urenVoorbereiding
    : 0;
  const reistijd =
    teltReistijd(afspraak.status, telwijze) && afspraak.reistijdEnkelMinuten
      ? declarabeleReistijdUren(
          afspraak.reistijdEnkelMinuten,
          instellingen.eigenReistijdUrenPerDag,
        )
      : 0;

  return {
    opLocatie,
    voorbereiding,
    reistijd,
    totaal: opLocatie + voorbereiding + reistijd,
  };
}

// ---------------------------------------------------------------------------
// Profielen en inrichting
// ---------------------------------------------------------------------------

/**
 * Het profiel van de ingelogde gebruiker. De rol komt uit `profielen` en nooit
 * uit een claim die de client kan zetten (SPEC.md 7).
 */
export async function huidigeMedewerker(): Promise<Profiel> {
  return (await werkset()).ik;
}

export async function isBeheerder(): Promise<boolean> {
  return (await werkset()).ik.rol === "beheerder";
}

export async function haalProfielen(): Promise<Profiel[]> {
  return (await werkset()).profielen;
}

export async function haalInstellingen(): Promise<Instellingen> {
  return (await werkset()).instellingen;
}

export async function haalActiviteitsoorten(): Promise<Activiteitsoort[]> {
  return (await werkset()).activiteitsoorten
    .filter((soort) => soort.actief)
    .sort(
      (a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"),
    );
}

/** Ook de soorten die op non-actief staan; voor het beheerdersportaal. */
export async function haalAlleActiviteitsoorten(): Promise<Activiteitsoort[]> {
  return [...(await werkset()).activiteitsoorten].sort(
    (a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"),
  );
}

/**
 * De soorten die de medewerker kan kiezen: alleen die met vaste uren. Soorten
 * met `handmatigeUren` vragen om zelf ingevulde uren, en die velden ziet de
 * medewerker niet meer.
 */
export async function haalTrainingsoorten(): Promise<Activiteitsoort[]> {
  return (await haalActiviteitsoorten()).filter(
    (soort) => !soort.handmatigeUren,
  );
}

// ---------------------------------------------------------------------------
// Klanten
// ---------------------------------------------------------------------------

export async function haalKlanten(): Promise<Klant[]> {
  return (await werkset()).klanten
    .filter((klant) => klant.actief)
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export async function haalKlant(klantId: string): Promise<Klant | null> {
  return (await werkset()).klanten.find((klant) => klant.id === klantId) ?? null;
}

/** Zoekt op naam en plaats, vanaf twee tekens (SPEC.md 6.2). */
export async function zoekKlanten(term: string): Promise<Klant[]> {
  const gezocht = term.trim().toLowerCase();
  if (gezocht.length < 2) return [];
  return (await haalKlanten()).filter(
    (klant) =>
      klant.naam.toLowerCase().includes(gezocht) ||
      klant.plaats.toLowerCase().includes(gezocht),
  );
}

export async function haalContactpersonen(
  klantId?: string,
): Promise<Contactpersoon[]> {
  const alle = (await werkset()).contactpersonen;
  const gefilterd = klantId
    ? alle.filter((persoon) => persoon.klantId === klantId)
    : alle;
  return [...gefilterd].sort((a, b) => {
    if (a.isPrimair !== b.isPrimair) return a.isPrimair ? -1 : 1;
    return a.naam.localeCompare(b.naam, "nl");
  });
}

// ---------------------------------------------------------------------------
// Niet-inzetbare dagen
// ---------------------------------------------------------------------------

export async function haalNietInzetbareDagen(): Promise<NietInzetbareDag[]> {
  return [...(await werkset()).nietInzetbareDagen].sort((a, b) =>
    a.datum.localeCompare(b.datum),
  );
}

export async function haalNietInzetbareDatums(): Promise<string[]> {
  return (await werkset()).nietInzetbareDagen.map((dag) => dag.datum);
}

// ---------------------------------------------------------------------------
// Afspraken
// ---------------------------------------------------------------------------

export async function haalAfspraken(medewerkerId: string): Promise<Afspraak[]> {
  return afsprakenVan(await werkset(), medewerkerId);
}

export async function haalAfspraak(
  afspraakId: string,
): Promise<Afspraak | null> {
  return (await werkset()).afspraken.find((a) => a.id === afspraakId) ?? null;
}

/** Afspraken met klant, contactpersoon en activiteitsoort erbij. */
export async function haalAfsprakenMetContext(
  medewerkerId: string,
): Promise<AfspraakMetContext[]> {
  const gegevens = await werkset();
  return metContext(gegevens, afsprakenVan(gegevens, medewerkerId));
}

export async function haalAfsprakenVoorKlant(
  klantId: string,
): Promise<AfspraakMetContext[]> {
  const gegevens = await werkset();
  return metContext(gegevens, afsprakenVan(gegevens, gegevens.ik.id)).filter(
    (afspraak) => afspraak.klantId === klantId,
  );
}

/**
 * De trainingen die met een school zijn afgesproken: alles wat nog loopt, met
 * of zonder datum. Geannuleerde en verzette afspraken vallen eruit, voltooide
 * ook — die staan onder "uitgevoerd".
 */
export async function haalAfgesprokenTrainingen(
  klantId: string,
): Promise<AfspraakMetContext[]> {
  return (await haalAfsprakenVoorKlant(klantId))
    .filter((afspraak) => afspraak.status === "gepland")
    .sort(opDatum);
}

// ---------------------------------------------------------------------------
// Uren
// ---------------------------------------------------------------------------

export async function haalHandmatigeUrenregels(
  medewerkerId: string,
): Promise<Urenregel[]> {
  return handmatigeRegelsVan(await werkset(), medewerkerId);
}

/** Het contract dat op een datum geldt. */
export async function haalContract(
  medewerkerId: string,
  datum: string,
): Promise<Contract | null> {
  return contractOp(await werkset(), medewerkerId, datum);
}

/**
 * Alle contracten van een medewerker, nieuwste eerst.
 *
 * `haalContract` geeft alleen het contract dat op een bepaalde dag geldt. Voor
 * het beheerscherm is dat te weinig: een contract dat volgende maand ingaat of
 * een verkeerd ingevoerde regel moet je ook kunnen zien.
 */
export async function haalContracten(
  medewerkerId: string,
): Promise<Contract[]> {
  return (await werkset()).contracten
    .filter((contract) => contract.profielId === medewerkerId)
    .sort((a, b) => b.ingangsdatum.localeCompare(a.ingangsdatum));
}

/** Alle uren van een medewerker in een periode, per telwijze. */
export async function urenInPeriode(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): Promise<number> {
  const gegevens = await werkset();
  const { instellingen } = gegevens;

  const afspraken = afsprakenVan(gegevens, medewerkerId)
    .map(naarAfspraakInvoer)
    .filter(
      (afspraak) =>
        binnenPeriode(afspraak.datum, vanaf, totEnMet) ||
        binnenPeriode(afspraak.voorbereidingDatum, vanaf, totEnMet),
    );

  const urenregels = handmatigeRegelsVan(gegevens, medewerkerId)
    .filter((regel) => regel.datum >= vanaf && regel.datum <= totEnMet)
    .map(naarUrenregelInvoer);

  const dagen = berekenDagen({
    afspraken,
    handmatigeUrenregels: urenregels,
    eigenReistijdUrenPerDag: instellingen.eigenReistijdUrenPerDag,
    maxUrenPerDagWaarschuwing: instellingen.maxUrenPerDagWaarschuwing,
    telwijze,
  }).filter((dag) => dag.datum >= vanaf && dag.datum <= totEnMet);

  return totaalUren(dagen);
}

/**
 * Alle urenregels van een periode: de regels die automatisch uit de afspraken
 * volgen én de handmatig geboekte regels, door elkaar op datum.
 *
 * De automatische regels worden niet opgeslagen — ze zijn volledig af te
 * leiden uit de afspraken, en hier op het moment van tonen berekend. Dat
 * voorkomt dat opgeslagen uren en afspraken uit elkaar kunnen lopen.
 */
export async function urenregelsInPeriode(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): Promise<AfgeleideUrenregel[]> {
  const gegevens = await werkset();
  const { instellingen, klanten } = gegevens;
  const afspraken = afsprakenVan(gegevens, medewerkerId);
  const regels: AfgeleideUrenregel[] = [];

  for (const afspraak of afspraken) {
    const klant = klanten.find((k) => k.id === afspraak.klantId);
    const omschrijving = `${afspraak.titel}${klant ? ` — ${klant.naam}` : ""}`;

    if (
      binnenPeriode(afspraak.datum, vanaf, totEnMet) &&
      teltLocatieUren(afspraak.status, telwijze) &&
      afspraak.urenOpLocatie > 0
    ) {
      regels.push({
        id: `${afspraak.id}-locatie`,
        datum: afspraak.datum!,
        categorie: "op_locatie",
        uren: afspraak.urenOpLocatie,
        toelichting: omschrijving,
        bron: "automatisch",
        afspraakId: afspraak.id,
      });
    }

    if (
      binnenPeriode(afspraak.voorbereidingDatum, vanaf, totEnMet) &&
      teltVoorbereidingUren(
        afspraak.status,
        afspraak.voorbereidingGedaan,
        telwijze,
      ) &&
      afspraak.urenVoorbereiding > 0
    ) {
      regels.push({
        id: `${afspraak.id}-voorbereiding`,
        datum: afspraak.voorbereidingDatum!,
        categorie: "voorbereiding",
        uren: afspraak.urenVoorbereiding,
        toelichting: omschrijving,
        bron: "automatisch",
        afspraakId: afspraak.id,
      });
    }
  }

  // Reistijd geldt per dag: de verste bestemming één keer, min de eigen tijd.
  const reisPerDag = new Map<
    string,
    { minuten: number; bestemmingen: number }
  >();
  for (const afspraak of afspraken) {
    if (!binnenPeriode(afspraak.datum, vanaf, totEnMet)) continue;
    if (!teltReistijd(afspraak.status, telwijze)) continue;
    const minuten = afspraak.reistijdEnkelMinuten ?? 0;
    if (minuten <= 0) continue;
    const huidig = reisPerDag.get(afspraak.datum!) ?? {
      minuten: 0,
      bestemmingen: 0,
    };
    reisPerDag.set(afspraak.datum!, {
      minuten: Math.max(huidig.minuten, minuten),
      bestemmingen: huidig.bestemmingen + 1,
    });
  }

  for (const [datum, reis] of reisPerDag) {
    const uren = declarabeleReistijdUren(
      reis.minuten,
      instellingen.eigenReistijdUrenPerDag,
    );
    if (uren <= 0) continue;
    regels.push({
      id: `reis-${datum}`,
      datum,
      categorie: "reistijd",
      uren,
      toelichting:
        reis.bestemmingen > 1
          ? `Reistijd boven het uur, verste van ${reis.bestemmingen} bestemmingen`
          : "Reistijd boven het uur enkele reis",
      bron: "automatisch",
      afspraakId: null,
    });
  }

  for (const regel of handmatigeRegelsVan(gegevens, medewerkerId)) {
    if (regel.datum < vanaf || regel.datum > totEnMet) continue;
    regels.push({
      id: regel.id,
      datum: regel.datum,
      categorie: regel.categorie,
      uren: regel.uren,
      toelichting: regel.toelichting,
      bron: "handmatig",
      afspraakId: regel.afspraakId,
    });
  }

  return regels.sort(
    (a, b) =>
      a.datum.localeCompare(b.datum) || a.categorie.localeCompare(b.categorie),
  );
}

/**
 * Uitsplitsing per categorie over een periode (SPEC.md 6.6). Locatie-,
 * voorbereidings- en reistijduren komen uit de afspraken; de overige
 * categorieën uit de handmatige urenregels.
 */
export async function urenPerCategorie(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): Promise<Array<{ categorie: UrenCategorie; uren: number }>> {
  const regels = await urenregelsInPeriode(
    medewerkerId,
    vanaf,
    totEnMet,
    telwijze,
  );
  const totalen = new Map<UrenCategorie, number>();

  for (const regel of regels) {
    if (regel.uren <= 0) continue;
    totalen.set(
      regel.categorie,
      (totalen.get(regel.categorie) ?? 0) + regel.uren,
    );
  }

  return [...totalen.entries()]
    .map(([categorie, uren]) => ({
      categorie,
      uren: Math.round(uren * 100) / 100,
    }))
    .sort((a, b) => b.uren - a.uren);
}

/** De jaarnormbalans van een medewerker (SPEC.md 5.4). */
export async function jaarnormBalans(
  medewerkerId: string,
  jaar: number,
  peildatum: string,
): Promise<JaarnormUitkomst | null> {
  const gegevens = await werkset();
  const profiel = gegevens.profielen.find((p) => p.id === medewerkerId);
  const contract = contractOp(gegevens, medewerkerId, peildatum);
  if (!profiel || !contract) return null;

  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  const [gerealiseerdeUren, geplandeUren] = await Promise.all([
    urenInPeriode(medewerkerId, jaarStart, jaarEind, "gerealiseerd"),
    urenInPeriode(medewerkerId, jaarStart, jaarEind, "gepland"),
  ]);

  return berekenJaarnorm({
    jaar,
    urenPerWeek: contract.urenPerWeek,
    normFulltime: contract.normFulltime,
    inDienstVanaf: profiel.inDienstVanaf,
    uitDienstPer: profiel.uitDienstPer,
    gerealiseerdeUren,
    geplandeUren,
  });
}

/**
 * De uren van één afspraak, zoals ze in het overzicht worden getoond.
 *
 * De reistijd is die van deze afspraak op zichzelf. Staan er meerdere
 * afspraken op één dag, dan geldt de reistijd van de verste bestemming één
 * keer per dag — kijk voor het dagtotaal bij `urenInPeriode`.
 */
export async function urenVanAfspraak(
  afspraak: Afspraak,
  telwijze: Telwijze = "gepland",
) {
  return urenVanAfspraakMet(await haalInstellingen(), afspraak, telwijze);
}

/**
 * Dezelfde berekening, maar zonder te wachten. Voor lijsten die per rij de
 * uren tonen: haal de instellingen dan één keer op en geef ze hier mee.
 */
export function urenVanAfspraakSync(
  instellingen: Instellingen,
  afspraak: Afspraak,
  telwijze: Telwijze = "gepland",
) {
  return urenVanAfspraakMet(instellingen, afspraak, telwijze);
}
