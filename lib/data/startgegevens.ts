import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  nextMonday,
  startOfYear,
} from "date-fns";
import { naarIsoDatum } from "@/lib/formatteer";
import type {
  Activiteitsoort,
  Afspraak,
  Contactpersoon,
  Contract,
  Instellingen,
  Klant,
  NietInzetbareDag,
  Profiel,
  Urenregel,
} from "./types";

/**
 * Startgegevens waarmee het portaal begint.
 *
 * Hier staan **geen voorbeeldscholen en geen voorbeeldafspraken meer**: het
 * portaal start leeg en wordt met eigen gegevens gevuld. Wat hier wél staat is
 * de inrichting die de app nodig heeft om te kunnen rekenen — het profiel, het
 * contract, de soorten trainingen en de vakantiedagen.
 *
 * Nooit echte persoonsgegevens in versiebeheer (CLAUDE.md, "Privacy").
 */

const VANDAAG = new Date();

// ---------------------------------------------------------------------------
// Profielen en contract
//
// Zolang er geen Supabase Auth is, draait het portaal op dit ene profiel.
// Zodra inloggen werkt komen de profielen uit `profielen` in de database.
// ---------------------------------------------------------------------------

export const HUIDIGE_MEDEWERKER: Profiel = {
  id: "11111111-1111-4111-8111-111111111111",
  voornaam: "Medewerker",
  achternaam: "De Kleuterspecialist",
  email: "medewerker@voorbeeld.test",
  telefoon: null,
  rol: "medewerker",
  standplaatsAdres: "Laaressingel",
  standplaatsPostcode: null,
  standplaatsPlaats: "Enschede",
  inDienstVanaf: naarIsoDatum(startOfYear(VANDAAG)),
  uitDienstPer: null,
  actief: true,
};

export const BEHEERDER: Profiel = {
  id: "22222222-2222-4222-8222-222222222222",
  voornaam: "Beheerder",
  achternaam: "De Kleuterspecialist",
  email: "beheer@voorbeeld.test",
  telefoon: null,
  rol: "beheerder",
  standplaatsAdres: "Laaressingel",
  standplaatsPostcode: null,
  standplaatsPlaats: "Enschede",
  inDienstVanaf: naarIsoDatum(startOfYear(VANDAAG)),
  uitDienstPer: null,
  actief: true,
};

export const START_PROFIELEN: Profiel[] = [HUIDIGE_MEDEWERKER, BEHEERDER];

/**
 * De contracturen per week staan nog niet vast (SPEC.md hoofdstuk 2,
 * "Nog te bevestigen vóór livegang"). Pas dit aan bij Beheer zodra het
 * werkelijke aantal bekend is; de jaarnorm volgt er vanzelf uit.
 */
export const START_CONTRACTEN: Contract[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    profielId: HUIDIGE_MEDEWERKER.id,
    ingangsdatum: naarIsoDatum(startOfYear(VANDAAG)),
    einddatum: null,
    urenPerWeek: 24,
    normFulltime: 1659,
  },
];

// ---------------------------------------------------------------------------
// Soorten trainingen
//
// Deze uren bepalen wat een afspraak oplevert; ze staan nergens in de code.
// De beheerder past ze aan en voegt eigen soorten toe bij Beheer.
// ---------------------------------------------------------------------------

export const START_ACTIVITEITSOORTEN: Activiteitsoort[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    naam: "Training",
    urenOpLocatie: 3.0,
    urenVoorbereiding: 3.0,
    kleur: "#026666",
    volgorde: 10,
    handmatigeUren: false,
    actief: true,
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    naam: "Observatie",
    urenOpLocatie: 3.5,
    // Eén uur voorbereiding. SPEC.md 2 en 5.1 noemen nog 0,50; die waarde is
    // in overleg bijgesteld en staat in de database, niet in de code.
    urenVoorbereiding: 1.0,
    kleur: "#95c11f",
    volgorde: 20,
    handmatigeUren: false,
    actief: true,
  },
];

// ---------------------------------------------------------------------------
// Klanten, afspraken en uren — leeg. Dit vult de medewerker zelf.
// ---------------------------------------------------------------------------

export const START_KLANTEN: Klant[] = [];
export const START_CONTACTPERSONEN: Contactpersoon[] = [];
export const START_AFSPRAKEN: Afspraak[] = [];
export const START_URENREGELS: Urenregel[] = [];

// ---------------------------------------------------------------------------
// Niet-inzetbare dagen
// ---------------------------------------------------------------------------

interface Vakantieblok {
  omschrijving: string;
  /** Eerste maandag op of na deze datum in het jaar. Maand is nulgebaseerd. */
  vanafMaandDag: [maand: number, dag: number];
  weken: number;
}

/**
 * Bij benadering de schoolvakanties van regio Noord: één voorjaarsweek, één
 * meiweek, zes weken zomer, één herfstweek en twee weken kerst. Samen ongeveer
 * 55 weekdagen, waarmee het aantal inzetbare dagen rond de 206 uitkomt — de
 * controlewaarde uit SPEC.md 5.4.
 *
 * **Dit zijn geen officiële data.** Vervang ze per schooljaar door de echte
 * vakantiedata van regio Noord voordat de urenverantwoording wordt gebruikt.
 */
const VAKANTIEBLOKKEN: Vakantieblok[] = [
  { omschrijving: "Voorjaarsvakantie", vanafMaandDag: [1, 14], weken: 1 },
  { omschrijving: "Meivakantie", vanafMaandDag: [3, 25], weken: 1 },
  { omschrijving: "Zomervakantie", vanafMaandDag: [6, 15], weken: 6 },
  { omschrijving: "Herfstvakantie", vanafMaandDag: [9, 15], weken: 1 },
  { omschrijving: "Kerstvakantie", vanafMaandDag: [11, 20], weken: 2 },
];

/** Losse feestdagen die buiten de vakantieblokken vallen. */
const FEESTDAGEN: Array<{ maandDag: [number, number]; omschrijving: string }> = [
  { maandDag: [3, 27], omschrijving: "Koningsdag" },
  { maandDag: [4, 5], omschrijving: "Bevrijdingsdag" },
];

function maakNietInzetbareDagen(jaar: number): NietInzetbareDag[] {
  const dagenLijst: NietInzetbareDag[] = [];
  const gezien = new Set<string>();

  function voegToe(
    datum: string,
    soort: NietInzetbareDag["soort"],
    omschrijving: string,
  ) {
    if (gezien.has(datum)) return;
    gezien.add(datum);
    dagenLijst.push({
      id: `${jaar}-${datum}`,
      datum,
      soort,
      omschrijving,
      regio: "Noord",
    });
  }

  for (const blok of VAKANTIEBLOKKEN) {
    const [maand, dag] = blok.vanafMaandDag;
    const start = nextMonday(new Date(jaar, maand, dag));
    const eind = addDays(addWeeks(start, blok.weken), -1);
    for (const datum of eachDayOfInterval({ start, end: eind })) {
      voegToe(naarIsoDatum(datum), "schoolvakantie", blok.omschrijving);
    }
  }

  for (const feestdag of FEESTDAGEN) {
    const [maand, dag] = feestdag.maandDag;
    voegToe(
      naarIsoDatum(new Date(jaar, maand, dag)),
      "feestdag",
      feestdag.omschrijving,
    );
  }

  return dagenLijst;
}

const HUIDIG_JAAR = VANDAAG.getFullYear();

export const START_NIET_INZETBARE_DAGEN: NietInzetbareDag[] = [
  ...maakNietInzetbareDagen(HUIDIG_JAAR),
  ...maakNietInzetbareDagen(HUIDIG_JAAR + 1),
];

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

export const START_INSTELLINGEN: Instellingen = {
  // Twee uur per dag eigen reistijd: één uur heen en één uur terug. Reistijd
  // daarboven is declarabel (SPEC.md 5.2).
  eigenReistijdUrenPerDag: 2.0,
  kilometervergoedingPerKm: 0.23,
  reistijdAfrondingMinuten: 5,
  maxUrenPerDagWaarschuwing: 12.0,
};
