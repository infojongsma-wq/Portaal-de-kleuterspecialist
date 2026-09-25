import { describe, it } from "vitest";

/**
 * Testeis 7 uit SPEC.md hoofdstuk 9: medewerker A mag op geen enkele manier bij
 * de afspraken of uren van medewerker B.
 *
 * Deze test hoort niet in `lib/uren/` thuis — hij toetst de Row Level Security
 * in Postgres, niet de rekenregels. Hij kan pas draaien tegen een echte
 * Supabase-omgeving met twee testgebruikers.
 *
 * De policies staan in `supabase/migrations/`. Zolang deze tests openstaan is
 * fase 1 uit SPEC.md hoofdstuk 8 niet afgerond.
 */
describe("autorisatie: medewerker A versus medewerker B (SPEC.md 9.7)", () => {
  it.todo("medewerker A leest geen afspraken van medewerker B");
  it.todo("medewerker A wijzigt geen afspraken van medewerker B");
  it.todo("medewerker A leest geen urenregels van medewerker B");
  it.todo("medewerker A boekt geen urenregel op naam van medewerker B");
  it.todo("medewerker A leest het contract van medewerker B niet");
  it.todo("medewerker A heeft geen toegang tot het wijzigingslog");
  it.todo("de beheerder leest de afspraken en uren van beide medewerkers");
});
