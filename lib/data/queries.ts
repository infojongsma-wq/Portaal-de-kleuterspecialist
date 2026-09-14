import { berekenJaarnorm, type JaarnormUitkomst } from "@/lib/uren";
import {
  teltLocatieUren,
  teltReistijd,
  teltVoorbereidingUren,
} from "@/lib/uren";
import { berekenDagen, totaalUren } from "@/lib/uren";
import { declarabeleReistijdUren } from "@/lib/uren";
import type {
  AfspraakInvoer,
  Telwijze,
  UrenCategorie,
  UrenregelInvoer,
} from "@/lib/uren";
import { opslag } from "./opslag";
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
 * Bij de overstap naar Supabase blijven de handtekeningen gelijk en verandert
 * alleen de implementatie: `opslag()` wordt dan een query op Postgres.
 */

/**
 * De ingelogde gebruiker. Zolang er geen Supabase Auth is, is dat vast de
 * demomedewerker. De rol komt hoe dan ook uit `profielen` en nooit uit een
 * claim die de client kan zetten (SPEC.md 7).
 */
export function huidigeMedewerker(): Profiel {
  const profiel = opslag().profielen.find((p) => p.rol === "medewerker");
  if (!profiel) throw new Error("Geen medewerkersprofiel gevonden.");
  return profiel;
}

export function huidigeBeheerder(): Profiel | null {
  return opslag().profielen.find((p) => p.rol === "beheerder") ?? null;
}

export function haalProfielen(): Profiel[] {
  return opslag().profielen;
}

export function haalInstellingen(): Instellingen {
  return opslag().instellingen;
}

export function haalActiviteitsoorten(): Activiteitsoort[] {
  return opslag()
    .activiteitsoorten.filter((soort) => soort.actief)
    .sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));
}

/** Ook de soorten die op non-actief staan; voor het beheerdersportaal. */
export function haalAlleActiviteitsoorten(): Activiteitsoort[] {
  return [...opslag().activiteitsoorten].sort(
    (a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"),
  );
}

/**
 * De soorten die de medewerker kan kiezen: alleen die met vaste uren.
 *
 * Soorten met `handmatigeUren` vragen om zelf ingevulde uren, en die velden
 * ziet de medewerker niet meer. Ze blijven wel bestaan voor het beheer.
 */
export function haalTrainingsoorten(): Activiteitsoort[] {
  return haalActiviteitsoorten().filter((soort) => !soort.handmatigeUren);
}

export function haalKlanten(): Klant[] {
  return opslag()
    .klanten.filter((klant) => klant.actief)
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export function haalKlant(klantId: string): Klant | null {
  return opslag().klanten.find((klant) => klant.id === klantId) ?? null;
}

/** Zoekt op naam en plaats, vanaf twee tekens (SPEC.md 6.2). */
export function zoekKlanten(term: string): Klant[] {
  const gezocht = term.trim().toLowerCase();
  if (gezocht.length < 2) return [];
  return haalKlanten().filter(
    (klant) =>
      klant.naam.toLowerCase().includes(gezocht) ||
      klant.plaats.toLowerCase().includes(gezocht),
  );
}

export function haalContactpersonen(klantId?: string): Contactpersoon[] {
  const alle = opslag().contactpersonen;
  const gefilterd = klantId
    ? alle.filter((persoon) => persoon.klantId === klantId)
    : alle;
  return [...gefilterd].sort((a, b) => {
    if (a.isPrimair !== b.isPrimair) return a.isPrimair ? -1 : 1;
    return a.naam.localeCompare(b.naam, "nl");
  });
}

export function haalNietInzetbareDagen(): NietInzetbareDag[] {
  return [...opslag().nietInzetbareDagen].sort((a, b) =>
    a.datum.localeCompare(b.datum),
  );
}

export function haalNietInzetbareDatums(): string[] {
  return opslag().nietInzetbareDagen.map((dag) => dag.datum);
}

export function haalAfspraken(medewerkerId: string): Afspraak[] {
  return opslag()
    .afspraken.filter((afspraak) => afspraak.medewerkerId === medewerkerId)
    .sort(opDatum);
}

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

export function haalAfspraak(afspraakId: string): Afspraak | null {
  return opslag().afspraken.find((a) => a.id === afspraakId) ?? null;
}

/** Afspraken met klant, contactpersoon en activiteitsoort erbij. */
export function haalAfsprakenMetContext(
  medewerkerId: string,
): AfspraakMetContext[] {
  const { klanten, contactpersonen, activiteitsoorten } = opslag();

  return haalAfspraken(medewerkerId).flatMap((afspraak) => {
    const klant = klanten.find((k) => k.id === afspraak.klantId);
    const activiteitsoort = activiteitsoorten.find(
      (s) => s.id === afspraak.activiteitsoortId,
    );
    if (!klant || !activiteitsoort) return [];

    return [
      {
        ...afspraak,
        klant,
        activiteitsoort,
        contactpersoon:
          contactpersonen.find((p) => p.id === afspraak.contactpersoonId) ??
          null,
      },
    ];
  });
}

export function haalAfsprakenVoorKlant(klantId: string): AfspraakMetContext[] {
  return haalAfsprakenMetContext(huidigeMedewerker().id).filter(
    (afspraak) => afspraak.klantId === klantId,
  );
}

/**
 * De trainingen die met een school zijn afgesproken: alles wat nog loopt, met
 * of zonder datum. Geannuleerde en verzette afspraken vallen eruit, voltooide
 * ook — die staan onder "uitgevoerd".
 */
export function haalAfgesprokenTrainingen(
  klantId: string,
): AfspraakMetContext[] {
  return haalAfsprakenVoorKlant(klantId)
    .filter((afspraak) => afspraak.status === "gepland")
    .sort(opDatum);
}

export function haalUrenregels(medewerkerId: string): Urenregel[] {
  return opslag()
    .urenregels.filter((regel) => regel.medewerkerId === medewerkerId)
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function haalHandmatigeUrenregels(medewerkerId: string): Urenregel[] {
  return haalUrenregels(medewerkerId).filter(
    (regel) => regel.bron === "handmatig",
  );
}

/** Het contract dat op een datum geldt. */
export function haalContract(
  medewerkerId: string,
  datum: string,
): Contract | null {
  const contracten = opslag()
    .contracten.filter((contract) => contract.profielId === medewerkerId)
    .filter((contract) => contract.ingangsdatum <= datum)
    .filter((contract) => !contract.einddatum || contract.einddatum >= datum)
    .sort((a, b) => b.ingangsdatum.localeCompare(a.ingangsdatum));
  return contracten[0] ?? null;
}

// ---------------------------------------------------------------------------
// Omzetten naar de invoer die `lib/uren` verwacht
// ---------------------------------------------------------------------------

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

/** Alle uren van een medewerker in een periode, per telwijze. */
export function urenInPeriode(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): number {
  const instellingen = haalInstellingen();

  const afspraken = haalAfspraken(medewerkerId)
    .map(naarAfspraakInvoer)
    .filter(
      (afspraak) =>
        binnenPeriode(afspraak.datum, vanaf, totEnMet) ||
        binnenPeriode(afspraak.voorbereidingDatum, vanaf, totEnMet),
    );

  const urenregels = haalHandmatigeUrenregels(medewerkerId)
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
export function urenregelsInPeriode(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): AfgeleideUrenregel[] {
  const instellingen = haalInstellingen();
  const { klanten } = opslag();
  const regels: AfgeleideUrenregel[] = [];

  for (const afspraak of haalAfspraken(medewerkerId)) {
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
  const reisPerDag = new Map<string, { minuten: number; bestemmingen: number }>();
  for (const afspraak of haalAfspraken(medewerkerId)) {
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

  for (const regel of haalHandmatigeUrenregels(medewerkerId)) {
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
    (a, b) => a.datum.localeCompare(b.datum) || a.categorie.localeCompare(b.categorie),
  );
}

/**
 * Uitsplitsing per categorie over een periode (SPEC.md 6.6).
 * Locatie-, voorbereidings- en reistijduren komen uit de afspraken; de overige
 * categorieën uit de handmatige urenregels.
 */
export function urenPerCategorie(
  medewerkerId: string,
  vanaf: string,
  totEnMet: string,
  telwijze: Telwijze,
): Array<{ categorie: UrenCategorie; uren: number }> {
  const instellingen = haalInstellingen();
  const afspraken = haalAfspraken(medewerkerId);
  const totalen = new Map<UrenCategorie, number>();

  function tel(categorie: UrenCategorie, uren: number) {
    if (uren <= 0) return;
    totalen.set(categorie, (totalen.get(categorie) ?? 0) + uren);
  }

  for (const afspraak of afspraken) {
    if (
      binnenPeriode(afspraak.datum, vanaf, totEnMet) &&
      teltLocatieUren(afspraak.status, telwijze)
    ) {
      tel("op_locatie", afspraak.urenOpLocatie);
    }
    if (
      binnenPeriode(afspraak.voorbereidingDatum, vanaf, totEnMet) &&
      teltVoorbereidingUren(
        afspraak.status,
        afspraak.voorbereidingGedaan,
        telwijze,
      )
    ) {
      tel("voorbereiding", afspraak.urenVoorbereiding);
    }
  }

  // Reistijd wordt per dag bepaald: één keer de verste bestemming, één keer de
  // eigen tijd eraf.
  const reisPerDag = new Map<string, number>();
  for (const afspraak of afspraken) {
    if (!binnenPeriode(afspraak.datum, vanaf, totEnMet)) continue;
    if (!teltReistijd(afspraak.status, telwijze)) continue;
    const datum = afspraak.datum!;
    const minuten = afspraak.reistijdEnkelMinuten ?? 0;
    reisPerDag.set(datum, Math.max(reisPerDag.get(datum) ?? 0, minuten));
  }
  for (const minuten of reisPerDag.values()) {
    if (minuten > 0) {
      tel(
        "reistijd",
        declarabeleReistijdUren(minuten, instellingen.eigenReistijdUrenPerDag),
      );
    }
  }

  for (const regel of haalHandmatigeUrenregels(medewerkerId)) {
    if (regel.datum < vanaf || regel.datum > totEnMet) continue;
    tel(regel.categorie, regel.uren);
  }

  return [...totalen.entries()]
    .map(([categorie, uren]) => ({ categorie, uren: Math.round(uren * 100) / 100 }))
    .sort((a, b) => b.uren - a.uren);
}

/** De jaarnormbalans van een medewerker (SPEC.md 5.4). */
export function jaarnormBalans(
  medewerkerId: string,
  jaar: number,
  peildatum: string,
): JaarnormUitkomst | null {
  const profiel = opslag().profielen.find((p) => p.id === medewerkerId);
  const contract = haalContract(medewerkerId, peildatum);
  if (!profiel || !contract) return null;

  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  return berekenJaarnorm({
    jaar,
    urenPerWeek: contract.urenPerWeek,
    normFulltime: contract.normFulltime,
    nietInzetbareDatums: haalNietInzetbareDatums(),
    inDienstVanaf: profiel.inDienstVanaf,
    uitDienstPer: profiel.uitDienstPer,
    peildatum,
    gerealiseerdeUren: urenInPeriode(
      medewerkerId,
      jaarStart,
      jaarEind,
      "gerealiseerd",
    ),
    geplandeUren: urenInPeriode(medewerkerId, jaarStart, jaarEind, "gepland"),
  });
}

/**
 * De uren van één afspraak, zoals ze in het overzicht worden getoond: locatie,
 * voorbereiding en het aandeel reistijd van die dag.
 */
export function urenVanAfspraak(
  afspraak: Afspraak,
  telwijze: Telwijze = "gepland",
): { opLocatie: number; voorbereiding: number; reistijd: number; totaal: number } {
  const instellingen = haalInstellingen();

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
