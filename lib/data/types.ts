import type {
  AfspraakStatus,
  UrenCategorie,
} from "@/lib/uren";

/**
 * Domeintypes, één op één met het datamodel uit SPEC.md hoofdstuk 4.
 * Kolomnamen zijn in TypeScript camelCase, in de database `snake_case`.
 */

export type Rol = "beheerder" | "medewerker";
export type Dagdeel = "ochtend" | "middag" | "hele_dag" | "anders";
export type Reisgegevensbron = "automatisch" | "handmatig";
export type Urenbron = "automatisch" | "handmatig";
export type SoortNietInzetbareDag = "schoolvakantie" | "feestdag" | "overig";

export interface Profiel {
  id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string | null;
  rol: Rol;
  standplaatsAdres: string | null;
  standplaatsPostcode: string | null;
  standplaatsPlaats: string | null;
  inDienstVanaf: string | null;
  uitDienstPer: string | null;
  actief: boolean;
}

export interface Contract {
  id: string;
  profielId: string;
  ingangsdatum: string;
  einddatum: string | null;
  urenPerWeek: number;
  normFulltime: number;
}

export interface Klant {
  id: string;
  naam: string;
  plaats: string;
  adres: string | null;
  postcode: string | null;
  land: string;
  reistijdEnkelMinuten: number | null;
  reisafstandEnkelKm: number | null;
  telefoonAlgemeen: string | null;
  emailAlgemeen: string | null;
  website: string | null;
  notitie: string | null;
  actief: boolean;
}

export interface Contactpersoon {
  id: string;
  klantId: string;
  naam: string;
  functie: string | null;
  telefoon: string | null;
  email: string | null;
  isPrimair: boolean;
  notitie: string | null;
}

export interface Activiteitsoort {
  id: string;
  naam: string;
  urenOpLocatie: number;
  urenVoorbereiding: number;
  kleur: string;
  volgorde: number;
  /** `true` bij "Anders": de gebruiker vult de uren zelf in. */
  handmatigeUren: boolean;
  actief: boolean;
}

export interface Afspraak {
  id: string;
  klantId: string;
  contactpersoonId: string | null;
  medewerkerId: string;
  activiteitsoortId: string;

  titel: string;
  datum: string;
  dagdeel: Dagdeel;
  andersOmschrijving: string | null;
  starttijd: string | null;
  eindtijd: string | null;

  voorbereidingDatum: string;
  urenOpLocatie: number;
  urenVoorbereiding: number;
  reistijdEnkelMinuten: number | null;
  reisafstandEnkelKm: number | null;
  reisgegevensBron: Reisgegevensbron | null;

  status: AfspraakStatus;
  voltooidOp: string | null;
  voorbereidingGedaan: boolean;
  verzetNaarId: string | null;

  afsprakenMetKlant: string | null;
  notitie: string | null;
}

export interface Urenregel {
  id: string;
  medewerkerId: string;
  datum: string;
  afspraakId: string | null;
  categorie: UrenCategorie;
  uren: number;
  toelichting: string | null;
  bron: Urenbron;
}

export interface NietInzetbareDag {
  id: string;
  datum: string;
  soort: SoortNietInzetbareDag;
  omschrijving: string;
  regio: string;
}

export interface Instellingen {
  eigenReistijdUrenPerDag: number;
  kilometervergoedingPerKm: number | null;
  reistijdAfrondingMinuten: number;
  maxUrenPerDagWaarschuwing: number;
}

/** Een afspraak met de gegevens die de schermen erbij nodig hebben. */
export interface AfspraakMetContext extends Afspraak {
  klant: Klant;
  contactpersoon: Contactpersoon | null;
  activiteitsoort: Activiteitsoort;
}
