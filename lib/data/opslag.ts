import {
  START_ACTIVITEITSOORTEN,
  START_AFSPRAKEN,
  START_CONTACTPERSONEN,
  START_CONTRACTEN,
  START_INSTELLINGEN,
  START_KLANTEN,
  START_NIET_INZETBARE_DAGEN,
  START_PROFIELEN,
  START_URENREGELS,
} from "./startgegevens";
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
 * Tijdelijke opslag voor het prototype: alle gegevens staan in het geheugen
 * van de server. Wijzigingen blijven bewaard zolang de server draait.
 *
 * Zodra de Supabase-omgeving er is vervalt dit bestand en komen dezelfde
 * gegevens uit Postgres, met de RLS-policies uit `supabase/migrations/`.
 *
 * Dit hoort **alleen op de server** te draaien; de schermen lezen via
 * `queries.ts` en schrijven via server actions.
 */

interface Opslag {
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

// Op `globalThis` zodat de gegevens een herlaadbeurt van de module overleven;
// zonder dit zou elke wijziging in de code de demoset resetten.
const SLEUTEL = Symbol.for("kleuterspecialist.demo-opslag");

type MetOpslag = typeof globalThis & { [SLEUTEL]?: Opslag };

function maakOpslag(): Opslag {
  return {
    profielen: [...START_PROFIELEN],
    contracten: [...START_CONTRACTEN],
    klanten: [...START_KLANTEN],
    contactpersonen: [...START_CONTACTPERSONEN],
    activiteitsoorten: [...START_ACTIVITEITSOORTEN],
    afspraken: [...START_AFSPRAKEN],
    urenregels: [...START_URENREGELS],
    nietInzetbareDagen: [...START_NIET_INZETBARE_DAGEN],
    instellingen: { ...START_INSTELLINGEN },
  };
}

export function opslag(): Opslag {
  const global = globalThis as MetOpslag;
  global[SLEUTEL] ??= maakOpslag();
  return global[SLEUTEL];
}

/** Zet de demoset terug op de beginwaarden. */
export function herstelOpslag(): void {
  (globalThis as MetOpslag)[SLEUTEL] = maakOpslag();
}

/** Nieuw id. In de database doet `gen_random_uuid()` dit. */
export function nieuwId(): string {
  return crypto.randomUUID();
}
