import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  nextMonday,
  startOfYear,
  subDays,
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
 * Demogegevens voor het prototype.
 *
 * **Alles hier is verzonnen.** Geen echte scholen, geen echte personen, geen
 * leerlinggegevens (CLAUDE.md, "Privacy"). Zodra de Supabase-omgeving er is
 * vervalt dit bestand.
 *
 * De reistijden zijn zo gekozen dat de voorbeelden uit SPEC.md 5.3 in het
 * scherm terugkomen: Zwolle 60 minuten, Utrecht 110 minuten, Hengelo 15.
 */

const VANDAAG = new Date();

function dagen(aantal: number): string {
  return naarIsoDatum(aantal >= 0 ? addDays(VANDAAG, aantal) : subDays(VANDAAG, -aantal));
}

// ---------------------------------------------------------------------------
// Profielen en contract
// ---------------------------------------------------------------------------

export const DEMO_MEDEWERKER: Profiel = {
  id: "11111111-1111-4111-8111-111111111111",
  voornaam: "Iris",
  achternaam: "Veldkamp",
  email: "iris@voorbeeld.test",
  telefoon: "06 12 34 56 78",
  rol: "medewerker",
  standplaatsAdres: "Laaressingel 1",
  standplaatsPostcode: "7514 EA",
  standplaatsPlaats: "Enschede",
  inDienstVanaf: naarIsoDatum(startOfYear(VANDAAG)),
  uitDienstPer: null,
  actief: true,
};

export const DEMO_BEHEERDER: Profiel = {
  id: "22222222-2222-4222-8222-222222222222",
  voornaam: "Joost",
  achternaam: "Meijer",
  email: "joost@voorbeeld.test",
  telefoon: null,
  rol: "beheerder",
  standplaatsAdres: "Laaressingel 1",
  standplaatsPostcode: "7514 EA",
  standplaatsPlaats: "Enschede",
  inDienstVanaf: naarIsoDatum(startOfYear(VANDAAG)),
  uitDienstPer: null,
  actief: true,
};

export const DEMO_PROFIELEN: Profiel[] = [DEMO_MEDEWERKER, DEMO_BEHEERDER];

/**
 * De contracturen per week staan nog niet vast (SPEC.md hoofdstuk 2,
 * "Nog te bevestigen vóór livegang"). 24 uur is hier een aanname voor de demo
 * en is in het beheerdersportaal aan te passen.
 */
export const DEMO_CONTRACTEN: Contract[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    profielId: DEMO_MEDEWERKER.id,
    ingangsdatum: naarIsoDatum(startOfYear(VANDAAG)),
    einddatum: null,
    urenPerWeek: 24,
    normFulltime: 1659,
  },
];

// ---------------------------------------------------------------------------
// Activiteitsoorten — gelijk aan de startgegevens in de migratie
// ---------------------------------------------------------------------------

export const DEMO_ACTIVITEITSOORTEN: Activiteitsoort[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    naam: "Training",
    urenOpLocatie: 3.0,
    urenVoorbereiding: 3.0,
    kleur: "#2563eb",
    volgorde: 10,
    handmatigeUren: false,
    actief: true,
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    naam: "Observatie",
    urenOpLocatie: 3.5,
    urenVoorbereiding: 0.5,
    kleur: "#16a34a",
    volgorde: 20,
    handmatigeUren: false,
    actief: true,
  },
  {
    id: "a3333333-3333-4333-8333-333333333333",
    naam: "Anders",
    urenOpLocatie: 0.0,
    urenVoorbereiding: 0.0,
    kleur: "#78716c",
    volgorde: 30,
    handmatigeUren: true,
    actief: true,
  },
];

// ---------------------------------------------------------------------------
// Klanten — verzonnen scholen
// ---------------------------------------------------------------------------

export const DEMO_KLANTEN: Klant[] = [
  {
    id: "c1111111-1111-4111-8111-111111111111",
    naam: "Basisschool De Vlinderboom",
    plaats: "Hengelo",
    adres: "Populierenlaan 12",
    postcode: "7551 AB",
    land: "NL",
    reistijdEnkelMinuten: 15,
    reisafstandEnkelKm: 11.4,
    telefoonAlgemeen: "074 000 00 01",
    emailAlgemeen: "info@vlinderboom.test",
    website: "https://vlinderboom.test",
    notitie: "Parkeren kan achter het gebouw.",
    actief: true,
  },
  {
    id: "c2222222-2222-4222-8222-222222222222",
    naam: "OBS Het Zonnerad",
    plaats: "Enschede",
    adres: "Beukenhof 3",
    postcode: "7511 CD",
    land: "NL",
    reistijdEnkelMinuten: 10,
    reisafstandEnkelKm: 4.2,
    telefoonAlgemeen: "053 000 00 02",
    emailAlgemeen: "info@zonnerad.test",
    website: null,
    notitie: null,
    actief: true,
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    naam: "Kindcentrum De Wilgenhoek",
    plaats: "Almelo",
    adres: "Wilgenkade 45",
    postcode: "7607 EF",
    land: "NL",
    reistijdEnkelMinuten: 25,
    reisafstandEnkelKm: 24.8,
    telefoonAlgemeen: "0546 00 00 03",
    emailAlgemeen: "info@wilgenhoek.test",
    website: null,
    notitie: null,
    actief: true,
  },
  {
    id: "c4444444-4444-4444-8444-444444444444",
    naam: "Basisschool De Sleutelbloem",
    plaats: "Zwolle",
    adres: "Kastanjesingel 88",
    postcode: "8012 GH",
    land: "NL",
    reistijdEnkelMinuten: 60,
    reisafstandEnkelKm: 72.3,
    telefoonAlgemeen: "038 000 00 04",
    emailAlgemeen: "info@sleutelbloem.test",
    website: null,
    notitie: "Ingang aan de zijkant, bel bij de conciërge.",
    actief: true,
  },
  {
    id: "c5555555-5555-4555-8555-555555555555",
    naam: "OBS De Kleine Beer",
    plaats: "Deventer",
    adres: "Meidoornstraat 7",
    postcode: "7415 IJ",
    land: "NL",
    reistijdEnkelMinuten: 50,
    reisafstandEnkelKm: 61.0,
    telefoonAlgemeen: "0570 00 00 05",
    emailAlgemeen: "info@kleinebeer.test",
    website: null,
    notitie: null,
    actief: true,
  },
  {
    id: "c6666666-6666-4666-8666-666666666666",
    naam: "Basisschool De Regenboogbrug",
    plaats: "Utrecht",
    adres: "Lindenplein 21",
    postcode: "3512 KL",
    land: "NL",
    reistijdEnkelMinuten: 110,
    reisafstandEnkelKm: 152.7,
    telefoonAlgemeen: "030 000 00 06",
    emailAlgemeen: "info@regenboogbrug.test",
    website: null,
    notitie: null,
    actief: true,
  },
  {
    id: "c7777777-7777-4777-8777-777777777777",
    naam: "Jenaplanschool De Vuurvlinder",
    plaats: "Apeldoorn",
    adres: "Berkenweg 104",
    postcode: "7311 MN",
    land: "NL",
    reistijdEnkelMinuten: 75,
    reisafstandEnkelKm: 98.5,
    telefoonAlgemeen: "055 000 00 07",
    emailAlgemeen: "info@vuurvlinder.test",
    website: null,
    notitie: null,
    actief: true,
  },
];

export const DEMO_CONTACTPERSONEN: Contactpersoon[] = [
  {
    id: "d1111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[0].id,
    naam: "Annelies Bosman",
    functie: "Directeur",
    telefoon: "074 000 00 01",
    email: "a.bosman@vlinderboom.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d1222222-2222-4222-8222-222222222222",
    klantId: DEMO_KLANTEN[0].id,
    naam: "Ruben Kloosterman",
    functie: "Intern begeleider",
    telefoon: null,
    email: "r.kloosterman@vlinderboom.test",
    isPrimair: false,
    notitie: null,
  },
  {
    id: "d2111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[1].id,
    naam: "Petra Nijhuis",
    functie: "Directeur",
    telefoon: "053 000 00 02",
    email: "p.nijhuis@zonnerad.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d3111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[2].id,
    naam: "Bas Wolthuis",
    functie: "Intern begeleider",
    telefoon: null,
    email: "b.wolthuis@wilgenhoek.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d4111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[3].id,
    naam: "Miriam de Lange",
    functie: "Adjunct-directeur",
    telefoon: "038 000 00 04",
    email: "m.delange@sleutelbloem.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d5111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[4].id,
    naam: "Sanne Oostendorp",
    functie: "Directeur",
    telefoon: null,
    email: "s.oostendorp@kleinebeer.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d6111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[5].id,
    naam: "Ewout Prinsen",
    functie: "Directeur",
    telefoon: null,
    email: "e.prinsen@regenboogbrug.test",
    isPrimair: true,
    notitie: null,
  },
  {
    id: "d7111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[6].id,
    naam: "Hanneke Stoffels",
    functie: "Teamleider onderbouw",
    telefoon: null,
    email: "h.stoffels@vuurvlinder.test",
    isPrimair: true,
    notitie: null,
  },
];

// ---------------------------------------------------------------------------
// Afspraken — een mix van statussen, rond de dag van vandaag
// ---------------------------------------------------------------------------

const TRAINING = DEMO_ACTIVITEITSOORTEN[0];
const OBSERVATIE = DEMO_ACTIVITEITSOORTEN[1];

function training(
  velden: Pick<Afspraak, "id" | "klantId" | "contactpersoonId" | "titel" | "datum"> &
    Partial<Afspraak>,
): Afspraak {
  const klant = DEMO_KLANTEN.find((k) => k.id === velden.klantId);
  return {
    medewerkerId: DEMO_MEDEWERKER.id,
    activiteitsoortId: TRAINING.id,
    dagdeel: "ochtend",
    andersOmschrijving: null,
    starttijd: "09:00",
    eindtijd: "12:00",
    voorbereidingDatum: velden.datum,
    urenOpLocatie: TRAINING.urenOpLocatie,
    urenVoorbereiding: TRAINING.urenVoorbereiding,
    reistijdEnkelMinuten: klant?.reistijdEnkelMinuten ?? null,
    reisafstandEnkelKm: klant?.reisafstandEnkelKm ?? null,
    reisgegevensBron: "automatisch",
    status: "gepland",
    voltooidOp: null,
    voorbereidingGedaan: false,
    verzetNaarId: null,
    afsprakenMetKlant: null,
    notitie: null,
    ...velden,
  };
}

export const DEMO_AFSPRAKEN: Afspraak[] = [
  training({
    id: "e1111111-1111-4111-8111-111111111111",
    klantId: DEMO_KLANTEN[3].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[4].id,
    titel: "Spel en ontwikkeling in groep 1-2",
    datum: dagen(-28),
    voorbereidingDatum: dagen(-29),
    status: "voltooid",
    voltooidOp: dagen(-28),
    voorbereidingGedaan: true,
    afsprakenMetKlant: "Vervolgtraining inplannen na de vakantie.",
  }),
  training({
    id: "e2222222-2222-4222-8222-222222222222",
    klantId: DEMO_KLANTEN[0].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[0].id,
    activiteitsoortId: OBSERVATIE.id,
    titel: "Observatie kleutergroepen",
    datum: dagen(-14),
    voorbereidingDatum: dagen(-15),
    dagdeel: "hele_dag",
    starttijd: "08:45",
    eindtijd: "12:15",
    urenOpLocatie: OBSERVATIE.urenOpLocatie,
    urenVoorbereiding: OBSERVATIE.urenVoorbereiding,
    status: "voltooid",
    voltooidOp: dagen(-14),
    voorbereidingGedaan: true,
    notitie: "Terugkoppeling per e-mail verstuurd.",
  }),
  training({
    id: "e3333333-3333-4333-8333-333333333333",
    klantId: DEMO_KLANTEN[1].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[2].id,
    titel: "Beredeneerd aanbod",
    datum: dagen(-7),
    status: "voltooid",
    voltooidOp: dagen(-7),
    voorbereidingGedaan: true,
  }),
  training({
    id: "e4444444-4444-4444-8444-444444444444",
    klantId: DEMO_KLANTEN[2].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[3].id,
    titel: "Werken met kleine kring",
    datum: dagen(-3),
    status: "geannuleerd",
    // De voorbereiding was al gedaan toen de school afbelde; die uren tellen
    // wél mee (SPEC.md 5.5).
    voorbereidingGedaan: true,
    notitie: "Afgezegd door de school wegens ziekte.",
  }),
  training({
    id: "e5555555-5555-4555-8555-555555555555",
    klantId: DEMO_KLANTEN[5].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[6].id,
    titel: "Rijke speelleeromgeving",
    datum: dagen(2),
    voorbereidingDatum: dagen(1),
    dagdeel: "hele_dag",
    starttijd: "09:30",
    eindtijd: "15:00",
  }),
  training({
    id: "e6666666-6666-4666-8666-666666666666",
    klantId: DEMO_KLANTEN[4].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[5].id,
    activiteitsoortId: OBSERVATIE.id,
    titel: "Observatie instroomgroep",
    datum: dagen(6),
    voorbereidingDatum: dagen(5),
    urenOpLocatie: OBSERVATIE.urenOpLocatie,
    urenVoorbereiding: OBSERVATIE.urenVoorbereiding,
    dagdeel: "middag",
    starttijd: "12:30",
    eindtijd: "16:00",
  }),
  training({
    id: "e7777777-7777-4777-8777-777777777777",
    klantId: DEMO_KLANTEN[6].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[7].id,
    titel: "Jonge kind en zelfsturing",
    datum: dagen(13),
    afsprakenMetKlant: "Vooraf een rondleiding door het gebouw.",
  }),
  training({
    id: "e8888888-8888-4888-8888-888888888888",
    klantId: DEMO_KLANTEN[0].id,
    contactpersoonId: DEMO_CONTACTPERSONEN[1].id,
    titel: "Vervolgtraining spelbegeleiding",
    datum: dagen(21),
    dagdeel: "anders",
    andersOmschrijving: "Avondbijeenkomst met het hele team",
    starttijd: "16:00",
    eindtijd: "19:00",
  }),
];

// ---------------------------------------------------------------------------
// Handmatige urenregels
// ---------------------------------------------------------------------------

export const DEMO_URENREGELS: Urenregel[] = [
  {
    id: "f1111111-1111-4111-8111-111111111111",
    medewerkerId: DEMO_MEDEWERKER.id,
    datum: dagen(-21),
    afspraakId: null,
    categorie: "administratie",
    uren: 2.0,
    toelichting: "Offertes en planning",
    bron: "handmatig",
  },
  {
    id: "f2222222-2222-4222-8222-222222222222",
    medewerkerId: DEMO_MEDEWERKER.id,
    datum: dagen(-10),
    afspraakId: null,
    categorie: "scholing",
    uren: 6.0,
    toelichting: "Studiedag jonge kind",
    bron: "handmatig",
  },
  {
    id: "f3333333-3333-4333-8333-333333333333",
    medewerkerId: DEMO_MEDEWERKER.id,
    datum: dagen(-5),
    afspraakId: null,
    categorie: "acquisitie",
    uren: 1.5,
    toelichting: "Netwerkbijeenkomst besturen",
    bron: "handmatig",
  },
  {
    id: "f4444444-4444-4444-8444-444444444444",
    medewerkerId: DEMO_MEDEWERKER.id,
    datum: dagen(-5),
    afspraakId: null,
    categorie: "reistijd",
    uren: 1.0,
    toelichting: "Reis naar de netwerkbijeenkomst (geen klantbezoek)",
    bron: "handmatig",
  },
  {
    id: "f5555555-5555-4555-8555-555555555555",
    medewerkerId: DEMO_MEDEWERKER.id,
    datum: dagen(-2),
    afspraakId: null,
    categorie: "overleg",
    uren: 1.25,
    toelichting: "Voortgangsgesprek",
    bron: "handmatig",
  },
];

// ---------------------------------------------------------------------------
// Niet-inzetbare dagen
// ---------------------------------------------------------------------------

interface Vakantieblok {
  omschrijving: string;
  /** Eerste maandag op of na deze datum in het jaar. */
  vanafMaandDag: [maand: number, dag: number];
  weken: number;
}

/**
 * Bij benadering de schoolvakanties van regio Noord: één voorjaarsweek, één
 * meiweek, zes weken zomer, één herfstweek en twee weken kerst. Samen ongeveer
 * 55 weekdagen, waarmee het aantal inzetbare dagen rond de 206 uitkomt — de
 * controlewaarde uit SPEC.md 5.4.
 *
 * **Dit zijn geen officiële data.** De beheerder voert de echte vakantiedata
 * per schooljaar in bij Beheer › Niet-inzetbare dagen.
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

  function voegToe(datum: string, soort: NietInzetbareDag["soort"], omschrijving: string) {
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
    voegToe(naarIsoDatum(new Date(jaar, maand, dag)), "feestdag", feestdag.omschrijving);
  }

  return dagenLijst;
}

const HUIDIG_JAAR = VANDAAG.getFullYear();

export const DEMO_NIET_INZETBARE_DAGEN: NietInzetbareDag[] = [
  ...maakNietInzetbareDagen(HUIDIG_JAAR),
  ...maakNietInzetbareDagen(HUIDIG_JAAR + 1),
];

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

export const DEMO_INSTELLINGEN: Instellingen = {
  eigenReistijdUrenPerDag: 2.0,
  kilometervergoedingPerKm: 0.23,
  reistijdAfrondingMinuten: 5,
  maxUrenPerDagWaarschuwing: 12.0,
};
