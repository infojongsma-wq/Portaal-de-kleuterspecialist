import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { verstuurWeekmail } from "../versturen";

/**
 * De volgorde van de weekmail (SPEC.md 4.13 en 6.6): eerst vastleggen dat hij
 * gaat, dan versturen, dan vastleggen wat erin stond. Met een nagebootste
 * database en mailserver; verzonnen gegevens (CLAUDE.md).
 */

const verstuurd: { onderwerp: string; tekst: string }[] = [];
let mailFaalt = false;

vi.mock("../smtp", () => ({
  mailInstellingen: () =>
    process.env.PROEF_ZONDER_MAIL
      ? { instellingen: null, ontbreekt: ["SMTP_HOST"] }
      : {
          instellingen: {
            host: "smtp.voorbeeld.nl",
            port: 465,
            gebruiker: "portaal@voorbeeld.nl",
            wachtwoord: "proef",
            aan: "beheer@voorbeeld.nl",
          },
          ontbreekt: [],
        },
  verstuurMail: async (_: unknown, bericht: { onderwerp: string; tekst: string }) => {
    if (mailFaalt) throw Object.assign(new Error("geweigerd"), { code: "EAUTH" });
    verstuurd.push(bericht);
  },
  mailFoutMelding: (fout: { code?: string }) => `fout ${fout.code}`,
}));

type Tabel = Record<string, unknown>[];

/** Een heel klein namaak-Supabase: alleen wat de weekmail gebruikt. */
function namaakDatabase(tabellen: Record<string, Tabel>) {
  let volgnummer = 0;

  function vraag(tabel: string) {
    let rijen = () => tabellen[tabel] ?? [];
    const filters: ((rij: Record<string, unknown>) => boolean)[] = [];
    let actie: "lezen" | "invoegen" | "verwijderen" | "bijwerken" = "lezen";
    let nieuw: Record<string, unknown> = {};
    let alleenEerste = false;

    const uitvoeren = () => {
      if (actie === "invoegen") {
        const rij = { id: `mail-${++volgnummer}`, ...nieuw, verzonden_op: null };
        const dubbel =
          tabel === "weekmails" &&
          rij.automatisch === true &&
          rijen().some((r) => r.automatisch === true && r.week === rij.week);
        if (dubbel) return { data: null, error: { code: "23505" } };
        tabellen[tabel] = [...rijen(), rij];
        return { data: rij, error: null };
      }
      const geraakt = rijen().filter((rij) => filters.every((f) => f(rij)));
      if (actie === "verwijderen") {
        tabellen[tabel] = rijen().filter((rij) => !geraakt.includes(rij));
        return { data: null, error: null };
      }
      if (actie === "bijwerken") {
        for (const rij of geraakt) Object.assign(rij, nieuw);
        return { data: null, error: null };
      }
      return { data: alleenEerste ? (geraakt[0] ?? null) : geraakt, error: null };
    };

    const bouwer = {
      select: () => bouwer,
      eq: (kolom: string, waarde: unknown) => {
        filters.push((rij) => rij[kolom] === waarde);
        return bouwer;
      },
      not: (kolom: string) => {
        filters.push((rij) => rij[kolom] != null);
        return bouwer;
      },
      order: () => bouwer,
      limit: () => bouwer,
      maybeSingle: () => {
        alleenEerste = true;
        return bouwer;
      },
      single: () => {
        alleenEerste = true;
        return bouwer;
      },
      insert: (rij: Record<string, unknown>) => {
        actie = "invoegen";
        nieuw = rij;
        return bouwer;
      },
      delete: () => {
        actie = "verwijderen";
        return bouwer;
      },
      update: (waarden: Record<string, unknown>) => {
        actie = "bijwerken";
        nieuw = waarden;
        return bouwer;
      },
      upsert: (lijst: Record<string, unknown>[]) => {
        const bestaand = new Set(rijen().map((r) => r.afspraak_id));
        tabellen[tabel] = [...rijen(), ...lijst.filter((r) => !bestaand.has(r.afspraak_id))];
        rijen = () => tabellen[tabel];
        return Promise.resolve({ data: null, error: null });
      },
      then: (klaar: (waarde: unknown) => unknown, faal?: (fout: unknown) => unknown) =>
        Promise.resolve(uitvoeren()).then(klaar, faal),
    };
    return bouwer;
  }

  return { from: vraag } as unknown as SupabaseClient;
}

function startgegevens(): Record<string, Tabel> {
  return {
    profielen: [
      { id: "p1", voornaam: "Proef", achternaam: "Aalders", email: "a@voorbeeld.nl", rol: "medewerker", actief: true },
    ],
    klanten: [{ id: "k1", naam: "Basisschool De Proef", plaats: "Testdorp", actief: true }],
    activiteitsoorten: [
      { id: "s1", naam: "Training", handmatige_uren: false, actief: true, kleur: "#000", volgorde: 1 },
    ],
    afspraken: [
      { id: "a1", klant_id: "k1", medewerker_id: "p1", activiteitsoort_id: "s1", titel: "Rekenen", datum: "2026-10-20", status: "voltooid" },
      { id: "a2", klant_id: "k1", medewerker_id: "p1", activiteitsoort_id: "s1", titel: "Taal", datum: "2026-10-21", status: "voltooid" },
      { id: "a3", klant_id: "k1", medewerker_id: "p1", activiteitsoort_id: "s1", titel: "Gepland", datum: "2026-11-02", status: "gepland" },
    ],
    verstuurde_facturen: [],
    weekmail_trainingen: [],
    weekmails: [],
  };
}

const MAANDAG = new Date("2026-10-26T07:05:00Z");
const opties = { automatisch: true, nu: MAANDAG, portaalAdres: null };

describe("de weekmail versturen (SPEC.md 6.6)", () => {
  beforeEach(() => {
    verstuurd.length = 0;
    mailFaalt = false;
    delete process.env.PROEF_ZONDER_MAIL;
  });

  it("de eerste mail bevat alles wat al was afgevinkt, en legt dat vast", async () => {
    const tabellen = startgegevens();
    const uitkomst = await verstuurWeekmail(namaakDatabase(tabellen), opties);

    expect(uitkomst).toEqual({ status: "verstuurd", aantal: 2 });
    expect(verstuurd).toHaveLength(1);
    expect(verstuurd[0].tekst).toContain("Dit is de eerste weekmail");
    expect(tabellen.weekmail_trainingen.map((r) => r.afspraak_id).sort()).toEqual(["a1", "a2"]);
    expect(tabellen.weekmails[0]).toMatchObject({
      week: "2026-W44",
      automatisch: true,
      aantal_trainingen: 2,
      verzonden_op: MAANDAG.toISOString(),
    });
  });

  it("de volgende mail bevat alleen wat er sindsdien bij kwam", async () => {
    const tabellen = startgegevens();
    await verstuurWeekmail(namaakDatabase(tabellen), opties);
    tabellen.afspraken.push({
      id: "a4", klant_id: "k1", medewerker_id: "p1", activiteitsoort_id: "s1", titel: "Spelen", datum: "2026-10-28", status: "voltooid",
    });

    const uitkomst = await verstuurWeekmail(namaakDatabase(tabellen), {
      ...opties,
      nu: new Date("2026-11-02T07:05:00Z"),
    });

    expect(uitkomst).toEqual({ status: "verstuurd", aantal: 1 });
    expect(verstuurd[1].tekst).toContain("Spelen");
    expect(verstuurd[1].tekst).not.toContain("Rekenen");
  });

  it("stuurt de vaste mail geen twee keer in dezelfde week", async () => {
    const tabellen = startgegevens();
    await verstuurWeekmail(namaakDatabase(tabellen), opties);
    const tweede = await verstuurWeekmail(namaakDatabase(tabellen), opties);

    expect(tweede).toEqual({ status: "al-verstuurd" });
    expect(verstuurd).toHaveLength(1);
  });

  it("met de knop kan het wel nog een keer", async () => {
    const tabellen = startgegevens();
    await verstuurWeekmail(namaakDatabase(tabellen), opties);
    const knop = await verstuurWeekmail(namaakDatabase(tabellen), {
      ...opties,
      automatisch: false,
    });

    expect(knop).toEqual({ status: "verstuurd", aantal: 0 });
    expect(verstuurd[1].onderwerp).toContain("niets nieuws");
  });

  it("raakt niets kwijt als de mailserver weigert", async () => {
    const tabellen = startgegevens();
    mailFaalt = true;
    const uitkomst = await verstuurWeekmail(namaakDatabase(tabellen), opties);

    expect(uitkomst).toEqual({ status: "fout", melding: "fout EAUTH" });
    expect(tabellen.weekmails).toHaveLength(0);
    expect(tabellen.weekmail_trainingen).toHaveLength(0);

    // Later lukt het alsnog, met dezelfde trainingen.
    mailFaalt = false;
    expect(await verstuurWeekmail(namaakDatabase(tabellen), opties)).toEqual({
      status: "verstuurd",
      aantal: 2,
    });
  });

  it("verstuurt niets zolang de mail niet is ingesteld", async () => {
    process.env.PROEF_ZONDER_MAIL = "1";
    const tabellen = startgegevens();
    expect(await verstuurWeekmail(namaakDatabase(tabellen), opties)).toEqual({
      status: "niet-ingesteld",
      ontbreekt: ["SMTP_HOST"],
    });
    expect(tabellen.weekmails).toHaveLength(0);
  });
});
